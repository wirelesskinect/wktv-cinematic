import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession, getSessionCookieName } from '@/lib/auth'
import { insertPayment } from '@/lib/sales'
import { getPlan, paymentNoteCode, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/plans'
import { normalizeUsername, usernameError, passwordError } from '@/lib/iptv-login'
import { isTrialDevice } from '@/lib/devices'
import { US_STATES } from '@/lib/shipping'

export const dynamic = 'force-dynamic'

// Admin client for database operations
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: { schema: 'wktv' },
    auth: { autoRefreshToken: false, persistSession: false }
  }
)

// Send Pushover notification
async function sendPushover(title: string, message: string) {
  const PUSHOVER_APP_TOKEN = process.env.PUSHOVER_APP_TOKEN
  const PUSHOVER_USER_KEY = process.env.WKTV_PUSHOVER_USER_KEY

  if (!PUSHOVER_APP_TOKEN || !PUSHOVER_USER_KEY) {
    console.log('Pushover not configured, skipping notification')
    return
  }

  try {
    await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: PUSHOVER_APP_TOKEN,
        user: PUSHOVER_USER_KEY,
        title,
        message,
        sound: 'cashregister',
      }),
    })
  } catch (err) {
    console.error('Pushover notification failed:', err)
  }
}

const SHIP_STATES = new Set(US_STATES)

// Shipping address for box bundles. Returns the one-line address, or an error message.
function readShipping(raw: any): { line: string } | { error: string } {
  const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '')
  const name = clean(raw?.name, 80)
  const street = clean(raw?.street, 120)
  const unit = clean(raw?.unit, 40)
  const city = clean(raw?.city, 60)
  const state = clean(raw?.state, 2).toUpperCase()
  const zip = clean(raw?.zip, 10)
  if (!name) return { error: 'Please enter the name to ship your box to.' }
  if (!street) return { error: 'Please enter your street address.' }
  if (!city) return { error: 'Please enter your city.' }
  if (!SHIP_STATES.has(state)) return { error: 'Please choose your state.' }
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { error: 'Please enter a valid 5-digit ZIP code.' }
  return { line: `${name}, ${street}${unit ? ` ${unit}` : ''}, ${city}, ${state} ${zip}` }
}

// Creates a plan request: a Cash App payment for paid plans, or a free-trial request.
// Only the plan ID and Cash App name are taken from the browser. The price, plan name,
// and renewal status are all decided here on the server.
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(getSessionCookieName())?.value
    const user = token ? await getSession(token) : null
    if (!user) {
      return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const plan = getPlan(body?.planId)
    if (!plan) {
      return NextResponse.json({ error: 'Please choose a valid plan.' }, { status: 400 })
    }

    const isFreeTrial = plan.price === 0
    // How they paid (Cash App, Zelle or Venmo) and the name/handle they paid from
    const method: PaymentMethod = PAYMENT_METHODS.includes(body?.paymentMethod) ? body.paymentMethod : 'cashapp'
    const methodLabel = PAYMENT_METHOD_LABELS[method]
    const cashAppName = typeof body?.cashAppName === 'string' ? body.cashAppName.trim() : ''
    if (!isFreeTrial) {
      if (!cashAppName) {
        return NextResponse.json({ error: `Please enter the name or ${method === 'zelle' ? 'phone/email' : 'handle'} you paid from on ${methodLabel}.` }, { status: 400 })
      }
      if (cashAppName.length > 60) {
        return NextResponse.json({ error: 'That name is too long.' }, { status: 400 })
      }
    }

    // Box bundles ship to the customer, so they need a shipping address
    let shipTo: string | null = null
    if (plan.ships) {
      const shipping = readShipping(body?.shipping)
      if ('error' in shipping) {
        return NextResponse.json({ error: shipping.error, field: 'shipping' }, { status: 400 })
      }
      shipTo = shipping.line
    }

    // Free trial: one per account
    if (isFreeTrial) {
      const { data: priorTrials } = await adminSupabase
        .from('pending_signups')
        .select('id')
        .eq('user_id', user.id)
        .eq('plan_id', 'trial-free')
        .limit(1)
      if (priorTrials && priorTrials.length) {
        return NextResponse.json({ error: 'This account has already requested a free trial. Choose a plan to keep watching.' }, { status: 409 })
      }
    }

    // Don't allow stacking the same request while one is still waiting for review
    const { data: openRequests } = await adminSupabase
      .from('pending_signups')
      .select('id')
      .eq('user_id', user.id)
      .eq('plan_id', plan.id)
      .eq('status', 'pending')
      .limit(1)
    if (openRequests && openRequests.length) {
      return NextResponse.json({ error: 'You already have a request for this plan waiting for confirmation. We’ll activate it shortly.' }, { status: 409 })
    }

    // Renewal = the customer already has a line on file
    const { data: existingSub } = await adminSupabase
      .from('user_subscriptions')
      .select('id, iptv_username')
      .eq('user_id', user.id)
      .limit(1)
    const isRenewal = !!(existingSub && existingSub.length)
    const hasLine = !!(existingSub && existingSub[0]?.iptv_username)

    // New customers choose the username and password they'll type into the TV app
    let requestedUsername: string | null = null
    let requestedPassword: string | null = null
    if (!hasLine) {
      const uname = normalizeUsername(body?.iptvUsername)
      const pword = typeof body?.iptvPassword === 'string' ? body.iptvPassword.trim() : ''
      const problem = usernameError(uname) || passwordError(pword, uname)
      if (problem) {
        return NextResponse.json({ error: problem, field: 'iptv' }, { status: 400 })
      }
      const [{ data: takenLine }, { data: takenRequest }] = await Promise.all([
        adminSupabase.from('user_subscriptions').select('id').eq('iptv_username', uname).limit(1),
        adminSupabase
          .from('pending_signups')
          .select('id')
          .eq('requested_username', uname)
          .in('status', ['pending', 'processing'])
          .neq('user_id', user.id)
          .limit(1),
      ])
      if ((takenLine && takenLine.length) || (takenRequest && takenRequest.length)) {
        return NextResponse.json({ error: 'That username is already taken. Please choose another.', field: 'iptv' }, { status: 409 })
      }
      requestedUsername = uname
      requestedPassword = pword
    }

    // Free trial referral: must match an existing customer's TV username exactly (capital letters count)
    let referrer: { userId: string; username: string } | null = null
    const referralInput = typeof body?.referralUsername === 'string' ? body.referralUsername.trim() : ''
    if (isFreeTrial && referralInput) {
      const notFound = NextResponse.json(
        { error: 'We couldn’t find that referral username. Check the spelling (capital letters count) or leave it blank.', field: 'referral' },
        { status: 400 }
      )
      if (referralInput.length > 64) return notFound
      const { data: refLine } = await adminSupabase
        .from('user_subscriptions')
        .select('user_id, iptv_username')
        .eq('iptv_username', referralInput)
        .limit(1)
      const match = refLine && refLine[0]
      if (!match || match.iptv_username !== referralInput) return notFound
      if (match.user_id === user.id || referralInput === requestedUsername) {
        return NextResponse.json({ error: 'You can’t use your own username as the referral.', field: 'referral' }, { status: 400 })
      }
      referrer = { userId: match.user_id, username: match.iptv_username }
    }

    const amountCents = plan.price * 100
    const userName = user.name || user.email?.split('@')[0] || 'Unknown'
    const userPhone = user.phone || null
    const userEmail = user.email || ''

    const baseRow = {
      user_id: user.id,
      name: userName,
      email: userEmail,
      phone: userPhone,
      plan_id: plan.id,
      plan_name: plan.name,
      amount_cents: amountCents,
      payment_method: isFreeTrial ? 'trial' : method,
      cashapp_name: isFreeTrial ? null : cashAppName,
      notes: [shipTo ? `Ship to: ${shipTo} · Box: ${plan.device}` : '', isTrialDevice(body?.device) ? `Device: ${body.device}` : '', referrer ? `Referred by: ${referrer.username}` : '']
        .filter(Boolean)
        .join(' · ') || null,
      status: 'pending',
    }
    let { data: signup, error: signupError } = await adminSupabase
      .from('pending_signups')
      .insert({ ...baseRow, requested_username: requestedUsername, requested_password: requestedPassword })
      .select()
      .single()
    // Database not updated yet (missing login columns): save the order anyway
    if (signupError && /requested_(username|password)/.test(signupError.message || '')) {
      console.error('pending_signups is missing the requested_username/password columns; run the 2026-10-25 migration')
      ;({ data: signup, error: signupError } = await adminSupabase.from('pending_signups').insert(baseRow).select().single())
    }

    if (signupError) {
      console.error('Failed to create pending signup:', signupError)
      return NextResponse.json({ error: 'Could not submit your request. Please try again.' }, { status: 500 })
    }

    // Remember who referred this customer (first referral only)
    if (referrer) {
      const { error: refError } = await adminSupabase
        .from('users')
        .update({ referred_by: referrer.username, referred_by_user_id: referrer.userId })
        .eq('id', user.id)
        .is('referred_by', null)
      if (refError) console.error('Could not save referral (run the 2026-10-26 referrals migration?):', refError)
    }

    if (!isFreeTrial) {
      const paymentError = await insertPayment({
        user_id: user.id,
        amount_cents: amountCents,
        payment_method: method,
        payment_reference: `${cashAppName} (note ${paymentNoteCode(plan)})`,
        status: 'pending',
        plan_id: plan.id,
      })
      if (paymentError) {
        console.error('Failed to create payment record:', paymentError)
      }
    }

    await sendPushover(
      isFreeTrial
        ? '🎁 WKTV Free Trial Request'
        : `${shipTo ? '📦 WKTV Box Order' : `💰 WKTV ${isRenewal ? 'Renewal' : 'Payment'}`} - $${plan.price} via ${methodLabel}`,
      `Plan: ${plan.name}\nCustomer: ${userName}\nEmail: ${userEmail}` +
        (isFreeTrial ? '' : `\n${methodLabel}: ${cashAppName}\nNote code: ${paymentNoteCode(plan)}`) +
        (shipTo ? `\nShip ${plan.device} to: ${shipTo}` : '') +
        (requestedUsername ? `\nWants username: ${requestedUsername}` : '') +
        (isTrialDevice(body?.device) ? `\nDevice: ${body.device}` : '') +
        (referrer ? `\nReferred by: ${referrer.username}` : '') +
        (userPhone ? `\nPhone: ${userPhone}` : '')
    )

    return NextResponse.json({
      success: true,
      message: isFreeTrial ? 'Free trial requested' : 'Payment submitted for verification',
      signupId: signup.id,
    })
  } catch (error: any) {
    console.error('Plan request error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
