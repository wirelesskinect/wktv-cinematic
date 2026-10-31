import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { adminSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Admin: list every website account with its TV line and order count
export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [usersRes, subsRes, ordersRes] = await Promise.all([
    adminSupabase.from('users').select('id, email, name, phone, role, created_at').order('created_at', { ascending: false }).limit(1000),
    adminSupabase.from('user_subscriptions').select('user_id, iptv_username, plan_id, plan_name, status, expires_at').limit(2000),
    adminSupabase.from('pending_signups').select('user_id, status').limit(5000),
  ])
  if (usersRes.error) {
    console.error('accounts list error:', usersRes.error)
    return NextResponse.json({ error: 'Could not load accounts' }, { status: 500 })
  }

  const subs = new Map((subsRes.data || []).map((s) => [s.user_id, s]))
  const orders = new Map<string, { total: number; pending: number }>()
  for (const o of ordersRes.data || []) {
    const c = orders.get(o.user_id) || { total: 0, pending: 0 }
    c.total++
    if (o.status === 'pending' || o.status === 'processing') c.pending++
    orders.set(o.user_id, c)
  }

  const accounts = (usersRes.data || []).map((u) => {
    const s = subs.get(u.id)
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      createdAt: u.created_at,
      tvLogin: s?.iptv_username || null,
      planId: s?.plan_id || null,
      planName: s?.plan_name || null,
      planStatus: s?.status || null,
      expiresAt: s?.expires_at || null,
      orders: orders.get(u.id)?.total || 0,
      pendingOrders: orders.get(u.id)?.pending || 0,
      isYou: u.id === admin.id,
    }
  })

  return NextResponse.json({ accounts })
}

// Admin: permanently delete a website account and everything attached to it.
// Body: { userId, confirmEmail } — confirmEmail must match the account's email.
// Admin accounts (including your own) can't be deleted here.
export async function DELETE(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  const confirmEmail = typeof body?.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : ''
  if (!userId) return NextResponse.json({ error: 'Missing account' }, { status: 400 })

  const { data: user } = await adminSupabase.from('users').select('id, email, role').eq('id', userId).maybeSingle()
  if (!user) return NextResponse.json({ error: 'Account not found (it may already be deleted).' }, { status: 404 })
  if (user.id === admin.id || user.role === 'admin') {
    return NextResponse.json({ error: 'Admin accounts can’t be deleted from here.' }, { status: 403 })
  }
  if (confirmEmail !== (user.email || '').toLowerCase()) {
    return NextResponse.json({ error: 'The email you typed doesn’t match. Nothing was deleted.' }, { status: 400 })
  }

  const { data: sub } = await adminSupabase.from('user_subscriptions').select('iptv_username').eq('user_id', userId).maybeSingle()

  // Remove everything tied to the account, then the account itself.
  // Support messages are kept for your records but no longer linked to the account.
  const steps = [
    adminSupabase.from('sessions').delete().eq('user_id', userId),
    adminSupabase.from('user_subscriptions').delete().eq('user_id', userId),
    adminSupabase.from('pending_signups').delete().eq('user_id', userId),
    adminSupabase.from('pending_matches').delete().eq('user_id', userId),
    adminSupabase.from('payments').delete().eq('user_id', userId),
    adminSupabase.from('support_requests').update({ user_id: null }).eq('user_id', userId),
  ]
  for (const step of steps) {
    const { error } = await step
    if (error) {
      console.error('delete account step failed:', error)
      return NextResponse.json({ error: `Couldn’t finish deleting: ${error.message}. Some related records may already be removed; try again.` }, { status: 500 })
    }
  }
  const { error: userError } = await adminSupabase.from('users').delete().eq('id', userId)
  if (userError) {
    console.error('delete user failed:', userError)
    return NextResponse.json({ error: `Couldn’t delete the account: ${userError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Deleted ${user.email}.` + (sub?.iptv_username ? ` Their TV line "${sub.iptv_username}" is still on your IPTV panel. Delete or disable it there if it was a test.` : ''),
  })
}
