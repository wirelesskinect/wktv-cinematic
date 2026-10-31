import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { adminSupabase } from '@/lib/supabase-server'
import { getPlan } from '@/lib/plans'
import { recordHistoricSale } from '@/lib/sales'

export const dynamic = 'force-dynamic'

const monthKey = (d: string | Date) => new Date(d).toISOString().slice(0, 7) // YYYY-MM

// Admin: sales & signups dashboard data
export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [usersRes, paymentsRes, ordersRes, subsRes] = await Promise.all([
    adminSupabase.from('users').select('id, email, name, created_at').limit(5000),
    adminSupabase.from('payments').select('*').eq('status', 'completed').order('created_at', { ascending: false }).limit(5000),
    adminSupabase.from('pending_signups').select('user_id, plan_id, amount_cents, status, created_at').eq('status', 'approved').limit(5000),
    adminSupabase.from('user_subscriptions').select('user_id, iptv_username, plan_id, connections, status, expires_at').limit(5000),
  ])
  if (usersRes.error || paymentsRes.error) {
    console.error('sales load error:', usersRes.error || paymentsRes.error)
    return NextResponse.json({ error: 'Could not load sales data' }, { status: 500 })
  }
  const users = usersRes.data || []
  const payments = paymentsRes.data || []
  const orders = ordersRes.data || []
  const subs = subsRes.data || []
  const emailById = new Map(users.map((u) => [u.id, u.email]))

  // Older payments don't store the plan: match them to the approved order with the same amount
  const planFor = (p: any): string | null => {
    if (p.plan_id) return p.plan_id
    const o = orders.find((x) => x.user_id === p.user_id && x.amount_cents === p.amount_cents)
    return o?.plan_id || null
  }

  const now = new Date()
  const thisMonth = monthKey(now)
  const byMonth = new Map<string, { month: string; real: number; historic: number; signups: number; sales: number }>()
  const bump = (m: string) => {
    if (!byMonth.has(m)) byMonth.set(m, { month: m, real: 0, historic: 0, signups: 0, sales: 0 })
    return byMonth.get(m)!
  }
  for (const u of users) bump(monthKey(u.created_at)).signups++

  const byPlan = new Map<string, { planId: string; name: string; sales: number; cents: number; historicCents: number }>()
  let realCents = 0
  let historicCents = 0
  for (const p of payments) {
    const isHistoric = p.payment_method === 'backfill'
    const cents = p.amount_cents || 0
    const m = bump(monthKey(p.created_at))
    m.sales++
    if (isHistoric) { historicCents += cents; m.historic += cents } else { realCents += cents; m.real += cents }
    const pid = planFor(p) || 'unknown'
    const plan = getPlan(pid)
    const row = byPlan.get(pid) || { planId: pid, name: plan?.name || 'Plan not recorded', sales: 0, cents: 0, historicCents: 0 }
    row.sales++
    row.cents += cents
    if (isHistoric) row.historicCents += cents
    byPlan.set(pid, row)
  }

  // Fill in empty months so the chart has no gaps (up to the last 24 months)
  const keys = Array.from(byMonth.keys()).sort()
  const months: { month: string; real: number; historic: number; signups: number; sales: number }[] = []
  if (keys.length) {
    const start = new Date(`${keys[0]}-01T00:00:00Z`)
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
    while (monthKey(cursor) <= thisMonth) {
      months.push(byMonth.get(monthKey(cursor)) || { month: monthKey(cursor), real: 0, historic: 0, signups: 0, sales: 0 })
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  }

  const activeSubs = subs.filter((s) => s.iptv_username && (!s.expires_at || new Date(s.expires_at) > now))
  const paidUsers = new Set(payments.map((p) => p.user_id))
  const backfillCandidates = subs.filter((s) => {
    const plan = getPlan(s.plan_id)
    return s.iptv_username && plan && plan.kind !== 'trial' && !paidUsers.has(s.user_id)
  }).length

  return NextResponse.json({
    totals: {
      accounts: users.length,
      accountsThisMonth: users.filter((u) => monthKey(u.created_at) === thisMonth).length,
      realCents,
      historicCents,
      totalCents: realCents + historicCents,
      thisMonthCents: byMonth.get(thisMonth) ? byMonth.get(thisMonth)!.real + byMonth.get(thisMonth)!.historic : 0,
      sales: payments.length,
      activeLines: activeSubs.length,
      activeConnections: activeSubs.reduce((n, s) => n + (s.connections || getPlan(s.plan_id)?.connections || 1), 0),
      backfillCandidates,
    },
    months: months.slice(-24),
    plans: Array.from(byPlan.values()).sort((a, b) => b.cents - a.cents),
    recent: payments.slice(0, 25).map((p) => ({
      id: p.id,
      date: p.created_at,
      email: emailById.get(p.user_id) || '(deleted account)',
      plan: getPlan(planFor(p))?.name || 'Plan not recorded',
      amountCents: p.amount_cents || 0,
      method: p.payment_method,
      historic: p.payment_method === 'backfill',
      note: p.payment_reference || '',
    })),
  })
}

// Admin: add historic sales for customers who were connected before the dashboard existed
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (body?.action !== 'backfill') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const { data: subs } = await adminSupabase.from('user_subscriptions').select('user_id, iptv_username, plan_id, expires_at').limit(5000)
  let added = 0
  for (const s of subs || []) {
    if (!s.iptv_username || !s.plan_id) continue
    if (await recordHistoricSale(s.user_id, s.plan_id, s.expires_at ? new Date(s.expires_at) : null)) added++
  }
  return NextResponse.json({ success: true, added, message: added ? `Added ${added} historic sale${added > 1 ? 's' : ''}.` : 'Nothing to add: every connected customer is already counted.' })
}
