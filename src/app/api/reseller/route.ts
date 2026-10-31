import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-server'
import { clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// "Become a reseller" form on the homepage.
// Saves the inquiry for admin review and sends a Pushover alert.
// Sending an inquiry grants nothing: no reseller account, no panel access, no credits.

const LIMIT = 5 // inquiries per visitor (network)…
const WINDOW_MINUTES = 10 // …per 10 minutes

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : ''

async function sendPushover(title: string, message: string) {
  const token = process.env.PUSHOVER_APP_TOKEN
  const user = process.env.WKTV_PUSHOVER_USER_KEY || process.env.PUSHOVER_USER_KEY
  if (!token || !user) {
    console.log('Pushover not configured, skipping reseller alert')
    return
  }
  try {
    await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, user, title, message, priority: 0, sound: 'cashregister' }),
    })
  } catch (err) {
    console.error('Reseller Pushover alert failed:', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // Hidden trap field: real visitors never see or fill it. Pretend success so bots learn nothing.
    if (clean(body.company_website, 200)) {
      return NextResponse.json({ success: true })
    }

    const firstName = clean(body.firstName, 60)
    const lastName = clean(body.lastName, 60)
    const email = clean(body.email, 200).toLowerCase()
    const phone = clean(body.phone, 30)

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'Please enter your first and last name.' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    if (phone && !/^[0-9+().\-\s]{7,30}$/.test(phone)) {
      return NextResponse.json({ error: 'Please check your contact number, or leave it blank.' }, { status: 400 })
    }

    // Spam guard: max 5 inquiries per network every 10 minutes
    const ip = clientIp(req.headers)
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()
    const { count } = await adminSupabase
      .from('auth_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'reseller')
      .eq('ip', ip)
      .gte('created_at', since)
    if ((count || 0) >= LIMIT) {
      return NextResponse.json(
        { error: 'You’ve sent several requests in the last few minutes. Please wait a little and try again.' },
        { status: 429 },
      )
    }
    await adminSupabase.from('auth_attempts').insert({ kind: 'reseller', email, ip })

    // Save for admin review
    const { error: saveError } = await adminSupabase
      .from('reseller_inquiries')
      .insert({ first_name: firstName, last_name: lastName, email, phone: phone || null })
    if (saveError) console.error('Reseller inquiry save failed:', saveError.message)

    // Alert the owner. If saving failed (for example the database update hasn't been run yet),
    // the alert still goes out so the lead isn't lost, and it says so.
    const lines = [`${firstName} ${lastName}`, email, phone ? `Phone: ${phone}` : 'Phone: not given']
    if (saveError) lines.push('', '⚠️ Not saved to the admin panel. Run the reseller inquiries SQL in Supabase.')
    else lines.push('', 'Review it in the WKTV admin panel → Reseller inquiries.')
    await sendPushover('New WKTV reseller inquiry', lines.join('\n'))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reseller inquiry error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
