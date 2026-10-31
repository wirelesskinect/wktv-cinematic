import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { adminSupabase } from '@/lib/supabase-server'
import { getPlan, type Plan } from '@/lib/plans'
import { randomInt } from 'crypto'
import {
  nxtConfigured,
  packageIdForPlan,
  createLine,
  findLine,
  extendLine,
  setLineEnabled,
  generateCredentials,
  NxtError,
} from '@/lib/nxt'

export const dynamic = 'force-dynamic'

// Expiry used only when the IPTV panel isn't connected (manual mode)
function manualExpiry(plan: Plan, from: Date): Date {
  const d = new Date(from)
  if (plan.kind === 'lifetime') d.setFullYear(d.getFullYear() + 100)
  else if (plan.duration === '24 hours') d.setDate(d.getDate() + 1)
  else if (plan.duration === '1 year') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + (plan.months || 1))
  return d
}

export async function POST(request: NextRequest) {
  const admin = await getAdminFromRequest(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const signupId = body?.signupId
  if (!signupId) {
    return NextResponse.json({ error: 'Missing signupId' }, { status: 400 })
  }

  // Claim the request first so a double-click can't create two lines
  const { data: claimed } = await adminSupabase
    .from('pending_signups')
    .update({ status: 'processing' })
    .eq('id', signupId)
    .eq('status', 'pending')
    .select('*')
  const signup = claimed && claimed[0]
  if (!signup) {
    return NextResponse.json({ error: 'This request was already processed (or not found).' }, { status: 409 })
  }

  const release = () => adminSupabase.from('pending_signups').update({ status: 'pending' }).eq('id', signupId)

  try {
    const plan = getPlan(signup.plan_id)
    if (!plan) {
      await release()
      return NextResponse.json({ error: `Unknown plan "${signup.plan_id}"` }, { status: 400 })
    }
    const isFreeTrial = plan.price === 0
    // Box bundles: start with a 24-hour line so the box can be set up and tested.
    // The 2 months / 1 year of service is added by hand on the panel right before shipping.
    const isBox = plan.kind === 'bundle'

    const { data: existing } = await adminSupabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', signup.user_id)
      .maybeSingle()

    let username: string
    let password: string
    let expiresAt: Date | null = null
    let panelLineId: string | null = null
    let mode: 'created' | 'extended' | 'manual'

    if (nxtConfigured() && isBox && existing?.iptv_username && existing?.iptv_password) {
      // Customer already has a line: leave it alone, the service is added by hand on the panel
      username = existing.iptv_username
      password = existing.iptv_password
      expiresAt = existing.expires_at ? new Date(existing.expires_at) : null
      mode = 'manual'
    } else if (nxtConfigured()) {
      const packageKey = isBox ? 'trial-free' : plan.id
      const packageId = packageIdForPlan(packageKey)
      if (!packageId) {
        await release()
        return NextResponse.json(
          { error: `No panel package is set for "${isBox ? 'Free 24-Hour Trial (used for box orders)' : plan.name}". Add "${packageKey}" to NXT_PACKAGE_MAP in Vercel, then approve again.` },
          { status: 400 }
        )
      }

      // Renewal: extend the customer's existing line instead of making a new one
      const line = !isFreeTrial && !isBox && existing?.iptv_username && existing?.iptv_password
        ? await findLine(existing.iptv_username, existing.iptv_password)
        : null

      if (line) {
        expiresAt = await extendLine(line.id, packageId)
        if (line.enabled === false) await setLineEnabled(line.id, true)
        if (!expiresAt) expiresAt = (await findLine(existing.iptv_username, existing.iptv_password))?.expiresAt || null
        username = existing.iptv_username
        password = existing.iptv_password
        panelLineId = line.id
        mode = 'extended'
      } else {
        // Use the login the customer chose at checkout (older orders get a generated one)
        const generated = generateCredentials()
        const wanted = signup.requested_username || generated.username
        const wantedPassword = signup.requested_password || generated.password
        const description = `WKTV:${signup.email || signup.user_id}`

        // If that name is already used on the panel, add 2 digits (up to 3 tries)
        let created = null as Awaited<ReturnType<typeof createLine>> | null
        for (let attempt = 0; attempt < 4 && !created; attempt++) {
          const tryName = attempt === 0 ? wanted : `${wanted.slice(0, 14)}${randomInt(10, 100)}`
          try {
            created = await createLine({ packageId, trial: isFreeTrial || isBox, username: tryName, password: wantedPassword, description })
          } catch (err) {
            const taken = err instanceof NxtError && /taken|exist|already/i.test(err.message)
            if (!taken || attempt === 3) throw err
          }
        }
        username = created!.username
        password = created!.password
        expiresAt = created!.expiresAt
        mode = 'created'
      }
    } else {
      // Manual mode: keep a renewing customer's login, otherwise make one for you to enter in the panel
      if (existing?.iptv_username && !isFreeTrial) {
        username = existing.iptv_username
        password = existing.iptv_password
        const current = existing.expires_at ? new Date(existing.expires_at) : null
        expiresAt = manualExpiry(plan, current && current > new Date() ? current : new Date())
      } else {
        const creds = generateCredentials()
        username = signup.requested_username || creds.username
        password = signup.requested_password || creds.password
        expiresAt = manualExpiry(plan, new Date())
      }
      mode = 'manual'
    }

    const { error: subError } = await adminSupabase
      .from('user_subscriptions')
      .upsert(
        {
          user_id: signup.user_id,
          iptv_username: username,
          iptv_password: password,
          plan_id: plan.id,
          plan_name: plan.name,
          price_cents: plan.price * 100,
          connections: plan.connections,
          status: 'active',
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          payment_method: isFreeTrial ? 'trial' : (signup.payment_method || 'cashapp'),
          payment_reference: signup.cashapp_name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (subError) {
      console.error('Failed to save subscription:', subError)
      // The panel line may already exist, so don't put the request back to pending
      await adminSupabase
        .from('pending_signups')
        .update({ status: 'error', notes: `Line ${mode} on panel (${username}) but saving failed: ${subError.message}` })
        .eq('id', signupId)
      return NextResponse.json({ error: `Panel step done (${username}) but saving to the database failed. Check this order before retrying.` }, { status: 500 })
    }

    await adminSupabase.from('pending_signups').update({ status: 'approved' }).eq('id', signupId)
    await adminSupabase
      .from('payments')
      .update({ status: 'completed' })
      .eq('user_id', signup.user_id)
      .eq('status', 'pending')

    const renamed = mode === 'created' && signup.requested_username && signup.requested_username !== username
    const boxNote = isBox
      ? mode === 'created'
        ? ` 24-hour line created for setup. Before shipping the ${plan.device} box, add ${plan.duration} of service with ${plan.connections} connection${plan.connections > 1 ? 's' : ''} to this line on your panel.`
        : ` Box order: add ${plan.duration} of service with ${plan.connections} connection${plan.connections > 1 ? 's' : ''} to this customer's line on your panel before shipping the ${plan.device} box.`
      : ''
    const message = isBox ? `Box order approved (${username}).${boxNote}${renamed ? ` "${signup.requested_username}" was taken on the panel, so it was created as "${username}".` : ''}` :
      renamed ? `New line created on the IPTV panel. "${signup.requested_username}" was already taken there, so it was created as "${username}" (shown on the customer's account page).` :
      mode === 'created' ? 'New line created on the IPTV panel.' :
      mode === 'extended' ? 'Existing line extended on the IPTV panel.' :
      'Approved in manual mode (panel not connected): create or extend this line in your IPTV panel.'

    return NextResponse.json({
      success: true,
      mode,
      message,
      panelLineId,
      credentials: { username, password },
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    })
  } catch (error: any) {
    console.error('Error approving signup:', error)
    await release()
    const msg = error instanceof NxtError ? `IPTV panel: ${error.message}` : 'Approval failed. Nothing was saved; you can try again.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
