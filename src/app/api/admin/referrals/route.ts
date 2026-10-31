import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { adminSupabase } from '@/lib/supabase-server'
import { getPlan } from '@/lib/plans'

export const dynamic = 'force-dynamic'

const isYearPlan = (planId: string | null | undefined) => {
  const plan = getPlan(planId)
  return plan?.kind === 'annual' || (plan?.kind === 'bundle' && plan.months === 12)
}

// The 1-year plan a referred customer bought (approved order or completed payment), if any
async function boughtYearPlan(userIds: string[]) {
  const bought = new Map<string, { planName: string; date: string }>()
  if (!userIds.length) return bought
  const [ordersRes, paymentsRes] = await Promise.all([
    adminSupabase.from('pending_signups').select('user_id, plan_id, status, created_at').in('user_id', userIds).eq('status', 'approved').limit(5000),
    adminSupabase.from('payments').select('user_id, plan_id, payment_method, status, created_at').in('user_id', userIds).eq('status', 'completed').limit(5000),
  ])
  for (const r of [...(ordersRes.data || []), ...(paymentsRes.data || []).filter((p: any) => p.payment_method !== 'backfill')]) {
    if (!isYearPlan(r.plan_id) || bought.has(r.user_id)) continue
    bought.set(r.user_id, { planName: getPlan(r.plan_id)!.name, date: r.created_at })
  }
  return bought
}

// Admin: everyone who started a trial with a referral username, and whether the referrer is owed a free month
export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: referred, error } = await adminSupabase
    .from('users')
    .select('id, email, name, created_at, referred_by, referred_by_user_id, referral_reward_at')
    .not('referred_by', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) {
    if (/referred_by|referral_reward_at/.test(error.message || '')) {
      return NextResponse.json({ needsMigration: true, referrals: [] })
    }
    console.error('referrals load error:', error)
    return NextResponse.json({ error: 'Could not load referrals' }, { status: 500 })
  }

  const rows = referred || []
  const referrerIds = Array.from(new Set(rows.map((r) => r.referred_by_user_id).filter(Boolean))) as string[]
  const [bought, referrersRes, linesRes] = await Promise.all([
    boughtYearPlan(rows.map((r) => r.id)),
    referrerIds.length ? adminSupabase.from('users').select('id, email').in('id', referrerIds) : Promise.resolve({ data: [] as any[] }),
    referrerIds.length ? adminSupabase.from('user_subscriptions').select('user_id, iptv_username, expires_at').in('user_id', referrerIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const referrerEmail = new Map((referrersRes.data || []).map((u: any) => [u.id, u.email]))
  const referrerLine = new Map((linesRes.data || []).map((s: any) => [s.user_id, s]))

  const referrals = rows.map((r) => {
    const buy = bought.get(r.id)
    const line = r.referred_by_user_id ? referrerLine.get(r.referred_by_user_id) : null
    return {
      userId: r.id,
      email: r.email,
      name: r.name,
      signedUpAt: r.created_at,
      referrerUsername: line?.iptv_username || r.referred_by,
      referrerEmail: (r.referred_by_user_id && referrerEmail.get(r.referred_by_user_id)) || null,
      referrerExpiresAt: line?.expires_at || null,
      boughtPlan: buy?.planName || null,
      boughtAt: buy?.date || null,
      rewardGivenAt: r.referral_reward_at,
      status: r.referral_reward_at ? 'given' : buy ? 'due' : 'trial',
    }
  })

  return NextResponse.json({
    referrals,
    due: referrals.filter((r) => r.status === 'due').length,
  })
}

// Admin: mark the free month as given (after adding 1 month to the referrer's line in the IPTV panel).
// Body: { referredUserId }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const userId = typeof body?.referredUserId === 'string' ? body.referredUserId : ''
  if (!userId) return NextResponse.json({ error: 'Choose a referral.' }, { status: 400 })

  const { data: user } = await adminSupabase
    .from('users')
    .select('id, email, referred_by, referred_by_user_id, referral_reward_at')
    .eq('id', userId)
    .maybeSingle()
  if (!user || !user.referred_by) return NextResponse.json({ error: 'This customer wasn’t referred by anyone.' }, { status: 404 })
  if (user.referral_reward_at) return NextResponse.json({ error: 'The free month for this referral was already given.' }, { status: 409 })
  if (!(await boughtYearPlan([userId])).has(userId)) {
    return NextResponse.json({ error: 'This customer hasn’t bought a 1-year plan yet, so no free month is due.' }, { status: 400 })
  }

  const { data: updated, error } = await adminSupabase
    .from('users')
    .update({ referral_reward_at: new Date().toISOString() })
    .eq('id', userId)
    .is('referral_reward_at', null)
    .select('id')
  if (error) {
    console.error('referral reward save error:', error)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
  if (!updated || !updated.length) return NextResponse.json({ error: 'The free month for this referral was already given.' }, { status: 409 })

  return NextResponse.json({ success: true, message: `Marked as given. Make sure 1 month is added to ${user.referred_by} in your IPTV panel.` })
}
