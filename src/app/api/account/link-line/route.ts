import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-server'
import { getSession, getSessionCookieName } from '@/lib/auth'
import { nxtConfigured, findLine, NxtError } from '@/lib/nxt'
import { clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Existing customers connect the IPTV line they already have to their website account.
// Ownership is proven by the line's own username + password, checked live on the panel.
export async function POST(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value
  const user = token ? await getSession(token) : null
  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  if (!nxtConfigured()) {
    return NextResponse.json({ error: 'This isn’t available right now. Please contact support and we’ll connect your plan for you.' }, { status: 503 })
  }

  // Max 5 wrong tries per account and 15 per network in 15 minutes
  const ip = clientIp(request.headers)
  const since = new Date(Date.now() - 15 * 60_000).toISOString()
  const [byUser, byIp] = await Promise.all([
    adminSupabase.from('auth_attempts').select('id', { count: 'exact', head: true }).eq('kind', 'link_fail').eq('email', user.email.toLowerCase()).gte('created_at', since),
    adminSupabase.from('auth_attempts').select('id', { count: 'exact', head: true }).eq('kind', 'link_fail').eq('ip', ip).gte('created_at', since),
  ])
  if ((byUser.count || 0) >= 5 || (byIp.count || 0) >= 15) {
    return NextResponse.json({ error: 'Too many tries. Please wait 15 minutes, or contact support and we’ll connect it for you.' }, { status: 429 })
  }
  const recordFail = () => adminSupabase.from('auth_attempts').insert({ kind: 'link_fail', email: user.email.toLowerCase(), ip })

  const body = await request.json().catch(() => ({}))
  const username = typeof body?.iptvUsername === 'string' ? body.iptvUsername.trim() : ''
  const password = typeof body?.iptvPassword === 'string' ? body.iptvPassword.trim() : ''
  if (!username || !password || username.length > 64 || password.length > 64) {
    return NextResponse.json({ error: 'Enter the username and password you use in the TV app.' }, { status: 400 })
  }

  // Already has a line on this account?
  const { data: mine } = await adminSupabase
    .from('user_subscriptions')
    .select('id, iptv_username')
    .eq('user_id', user.id)
    .maybeSingle()
  if (mine?.iptv_username) {
    return NextResponse.json({ error: 'Your account already has a TV login connected. Contact support to change it.' }, { status: 409 })
  }

  let line
  try {
    line = await findLine(username, password)
  } catch (err) {
    console.error('link-line panel error:', err)
    const msg = err instanceof NxtError ? 'We couldn’t reach the TV service right now. Please try again in a few minutes.' : 'Something went wrong. Please try again.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
  if (!line) {
    await recordFail()
    return NextResponse.json({ error: 'That username and password don’t match an active WKTV line. Check them in your TV app and try again.' }, { status: 400 })
  }

  // A line can only belong to one website account
  const { data: taken } = await adminSupabase
    .from('user_subscriptions')
    .select('id, user_id')
    .eq('iptv_username', line.username)
    .limit(1)
  if (taken && taken.length && taken[0].user_id !== user.id) {
    return NextResponse.json({ error: 'That TV login is already connected to another account. Please contact support.' }, { status: 409 })
  }

  const row = {
    user_id: user.id,
    iptv_username: line.username,
    iptv_password: password,
    status: 'active',
    expires_at: line.expiresAt ? line.expiresAt.toISOString() : null,
    plan_name: 'WKTV plan',
    payment_method: 'existing',
    updated_at: new Date().toISOString(),
  }
  const { error } = mine
    ? await adminSupabase.from('user_subscriptions').update(row).eq('id', mine.id)
    : await adminSupabase.from('user_subscriptions').insert(row)
  if (error) {
    console.error('link-line save error:', error)
    return NextResponse.json({ error: 'We matched your line but couldn’t save it. Please contact support.' }, { status: 500 })
  }

  // Let the owner know (best effort)
  const PUSHOVER_APP_TOKEN = process.env.PUSHOVER_APP_TOKEN
  const PUSHOVER_USER_KEY = process.env.WKTV_PUSHOVER_USER_KEY || process.env.PUSHOVER_USER_KEY
  if (PUSHOVER_APP_TOKEN && PUSHOVER_USER_KEY) {
    await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: PUSHOVER_APP_TOKEN,
        user: PUSHOVER_USER_KEY,
        title: '🔗 WKTV: Existing customer connected',
        message: `${user.name || user.email} (${user.email}) connected line ${line.username}`,
        priority: -1,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
