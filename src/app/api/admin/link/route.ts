import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { adminSupabase } from '@/lib/supabase-server'
import { getPlan } from '@/lib/plans'
import { nxtConfigured, findLine } from '@/lib/nxt'
import { recordHistoricSale } from '@/lib/sales'

export const dynamic = 'force-dynamic'

// Admin: attach an existing customer's IPTV line (and plan + expiration) to their website account.
// Body: { email, iptvUsername, iptvPassword?, planId?, expiresAt? (YYYY-MM-DD) }
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const iptvUsername = typeof body?.iptvUsername === 'string' ? body.iptvUsername.trim() : ''
    const iptvPassword = typeof body?.iptvPassword === 'string' ? body.iptvPassword.trim() : ''
    const plan = body?.planId ? getPlan(body.planId) : null
    const expiresInput = typeof body?.expiresAt === 'string' ? body.expiresAt.trim() : ''

    if (!email || !iptvUsername) {
      return NextResponse.json({ error: 'Customer email and IPTV username are required.' }, { status: 400 })
    }
    if (body?.planId && !plan) {
      return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 })
    }

    // The customer needs a website account first
    const { data: user } = await adminSupabase.from('users').select('id, email').eq('email', email).maybeSingle()
    if (!user) {
      return NextResponse.json({ error: `No website account for ${email}. Ask the customer to sign up at wktv.live first (any plan choice is fine), then try again.` }, { status: 404 })
    }

    // Don't let one line be attached to two accounts
    const { data: taken } = await adminSupabase.from('user_subscriptions').select('user_id').eq('iptv_username', iptvUsername).limit(1)
    if (taken && taken.length && taken[0].user_id !== user.id) {
      return NextResponse.json({ error: `Line "${iptvUsername}" is already attached to a different account.` }, { status: 409 })
    }

    // Expiration: the panel is the source of truth when we can read it; otherwise use what was typed
    let expiresAt: Date | null = null
    let source = 'manual'
    let panelNote = ''
    if (nxtConfigured() && iptvPassword) {
      try {
        const line = await findLine(iptvUsername, iptvPassword)
        if (line?.expiresAt) {
          expiresAt = line.expiresAt
          source = 'panel'
        } else if (!line) {
          panelNote = ' (The panel didn’t find a line with that username and password, so the date you entered was used. Double-check the password.)'
        }
      } catch (err) {
        console.error('admin link panel lookup failed:', err)
      }
    }
    if (!expiresAt && expiresInput) {
      const d = new Date(`${expiresInput}T23:59:00`)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Expiration date is not valid.' }, { status: 400 })
      expiresAt = d
    }
    if (!expiresAt && plan?.kind !== 'lifetime') {
      return NextResponse.json({ error: `Enter the expiration date${nxtConfigured() ? ', or the line password so it can be read from the panel' : ''}.${panelNote}` }, { status: 400 })
    }
    if (!expiresAt && plan?.kind === 'lifetime') {
      expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 100)
    }

    const row: Record<string, unknown> = {
      user_id: user.id,
      iptv_username: iptvUsername,
      status: 'active',
      expires_at: expiresAt!.toISOString(),
      payment_method: 'existing',
      updated_at: new Date().toISOString(),
    }
    if (iptvPassword) row.iptv_password = iptvPassword
    if (plan) {
      row.plan_id = plan.id
      row.plan_name = plan.name
      row.connections = plan.connections
      row.price_cents = plan.price * 100
    }

    const { data: existing } = await adminSupabase.from('user_subscriptions').select('id, plan_name').eq('user_id', user.id).maybeSingle()
    const { error } = existing
      ? await adminSupabase.from('user_subscriptions').update(row).eq('id', existing.id)
      : await adminSupabase.from('user_subscriptions').insert({ plan_name: 'WKTV plan', ...row })
    if (error) {
      console.error('Admin link save error:', error)
      return NextResponse.json({ error: `Couldn’t save: ${error.message}` }, { status: 500 })
    }

    // Sales dashboard: count this existing customer's plan once (annual started 30+ days ago = last year's price)
    const historic = plan ? await recordHistoricSale(user.id, plan.id, expiresAt) : false

    return NextResponse.json({
      success: true,
      message: `Linked ${iptvUsername} to ${email}. Expires ${expiresAt!.toLocaleDateString('en-US')} (${source === 'panel' ? 'read from the panel' : 'as entered'}).${historic ? ' Added to the sales dashboard as a historic sale.' : ''}${panelNote}`,
    })
  } catch (error: any) {
    console.error('Admin link error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
