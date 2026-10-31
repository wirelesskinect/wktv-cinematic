import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { adminSupabase } from '@/lib/supabase-server'
import { getPlan, type Plan } from '@/lib/plans'
import { nxtConfigured, packageIdForPlan, findLine, extendLine, setLineEnabled, NxtError } from '@/lib/nxt'
import { insertPayment } from '@/lib/sales'

export const dynamic = 'force-dynamic'

const PAID_WITH = ['cashapp', 'zelle', 'venmo', 'cash', 'other'] as const

// Expiry used only when the IPTV panel isn't connected (manual mode)
function addPlanTime(plan: Plan, from: Date): Date {
  const d = new Date(from)
  if (plan.kind === 'lifetime') d.setFullYear(d.getFullYear() + 100)
  else if (plan.kind === 'annual') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + ((plan as any).months || 1))
  return d
}

// Admin: renew (extend) a customer's existing TV line for a payment received outside the website.
// Body: { userId, planId, paidWith, note? }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  const plan = getPlan(body?.planId)
  const paidWith = (PAID_WITH as readonly string[]).includes(body?.paidWith) ? body.paidWith : 'other'
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 120) : ''
  if (!userId || !plan || plan.kind === 'trial') {
    return NextResponse.json({ error: 'Choose a customer and a renewal plan.' }, { status: 400 })
  }

  const [{ data: user }, { data: sub }] = await Promise.all([
    adminSupabase.from('users').select('id, email').eq('id', userId).maybeSingle(),
    adminSupabase.from('user_subscriptions').select('*').eq('user_id', userId).maybeSingle(),
  ])
  if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  if (!sub?.iptv_username) {
    return NextResponse.json({ error: 'This account has no TV line yet. Use “Add plan” to connect their line first.' }, { status: 400 })
  }

  // If they already placed an order on the site, approve that instead so it isn't renewed twice
  const { data: waiting } = await adminSupabase
    .from('pending_signups')
    .select('id, plan_name')
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .limit(1)
  if (waiting && waiting.length && !body?.ignoreWaitingOrder) {
    return NextResponse.json({
      error: `This customer already has an order waiting (${waiting[0].plan_name}). Approve it in the Orders list below instead, so the line isn't extended twice.`,
      waitingOrder: true,
    }, { status: 409 })
  }

  let expiresAt: Date | null = null
  let mode: 'panel' | 'manual' = 'manual'

  if (nxtConfigured()) {
    const packageId = packageIdForPlan(plan.id)
    if (!packageId) {
      return NextResponse.json({ error: `No panel package is set for "${plan.name}". Add "${plan.id}" to NXT_PACKAGE_MAP in Vercel first.` }, { status: 400 })
    }
    if (!sub.iptv_password) {
      return NextResponse.json({ error: `No password is saved for "${sub.iptv_username}". Click “Edit plan”, enter their TV password, save, then renew.` }, { status: 400 })
    }
    try {
      const line = await findLine(sub.iptv_username, sub.iptv_password)
      if (!line) {
        return NextResponse.json({ error: `Couldn’t find "${sub.iptv_username}" on the panel with the saved password. Click “Edit plan” to fix the password, then renew. Nothing was changed.` }, { status: 409 })
      }
      expiresAt = await extendLine(line.id, packageId)
      if (line.enabled === false) await setLineEnabled(line.id, true)
      if (!expiresAt) expiresAt = (await findLine(sub.iptv_username, sub.iptv_password))?.expiresAt || null
      mode = 'panel'
    } catch (err) {
      console.error('admin renew panel error:', err)
      const msg = err instanceof NxtError ? `IPTV panel: ${err.message}` : 'The panel didn’t respond. Nothing was changed; try again.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } else {
    const current = sub.expires_at ? new Date(sub.expires_at) : null
    expiresAt = addPlanTime(plan, current && current > new Date() ? current : new Date())
  }

  const { error: subError } = await adminSupabase
    .from('user_subscriptions')
    .update({
      plan_id: plan.id,
      plan_name: plan.name,
      connections: plan.connections,
      price_cents: plan.price * 100,
      status: 'active',
      expires_at: expiresAt ? expiresAt.toISOString() : sub.expires_at,
      payment_method: paidWith,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id)
  if (subError) {
    console.error('admin renew save error:', subError)
    return NextResponse.json({ error: `The line was ${mode === 'panel' ? 'extended on the panel' : 'renewed'}, but saving to the website failed: ${subError.message}. Don’t renew again; refresh and check the date.` }, { status: 500 })
  }

  await insertPayment({
    user_id: userId,
    subscription_id: sub.id,
    amount_cents: plan.price * 100,
    payment_method: paidWith,
    payment_reference: `Manual renewal by admin${note ? `: ${note}` : ''}`,
    status: 'completed',
    plan_id: plan.id,
  })

  const when = expiresAt ? expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'unknown'
  return NextResponse.json({
    success: true,
    message: mode === 'panel'
      ? `Renewed ${sub.iptv_username} with ${plan.name} on the IPTV panel. New expiration: ${when}.`
      : `Renewed ${sub.iptv_username} with ${plan.name} (manual mode, panel not connected: extend it in your panel too). New expiration: ${when}.`,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  })
}
