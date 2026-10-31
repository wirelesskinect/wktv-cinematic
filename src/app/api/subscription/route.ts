import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { adminSupabase } from '@/lib/supabase-server'
import { getSession, getSessionCookieName } from '@/lib/auth'
import { lookupExpiry } from '@/lib/panel-lookup'

export async function GET(request: NextRequest) {
  try {
    // Get user from custom auth session
    const token = request.cookies.get(getSessionCookieName())?.value
    const user = token ? await getSession(token) : null
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const effectiveUserId = user.id

    // Most recent plan request still waiting for admin confirmation (if any)
    const { data: openRequests } = await adminSupabase
      .from('pending_signups')
      .select('plan_name, amount_cents, payment_method, created_at, requested_username')
      .eq('user_id', effectiveUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
    const pendingRequest = openRequests && openRequests.length
      ? { planName: openRequests[0].plan_name, amount: Math.round((openRequests[0].amount_cents || 0) / 100), method: openRequests[0].payment_method, requestedAt: openRequests[0].created_at, username: openRequests[0].requested_username || null }
      : null
    
    // Check for linked subscription
    const { data: subscription, error } = await adminSupabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', effectiveUserId)
      .single()
    
    if (error || !subscription) {
      if (pendingRequest) {
        return NextResponse.json({ status: 'pending', pendingRequest })
      }
      // Check if pending review
      const { data: pending } = await adminSupabase
        .from('pending_matches')
        .select('*')
        .eq('user_id', effectiveUserId)
        .single()
      
      if (pending) {
        return NextResponse.json({
          status: 'pending',
          message: 'Your account is pending setup.',
        })
      }
      
      return NextResponse.json({ 
        status: 'unlinked',
      })
    }
    
    // Fetch real expiry from IPTV panel
    let expiryDate = subscription.expires_at ? new Date(subscription.expires_at) : null
    const panelExpiry = subscription.iptv_username
      ? await lookupExpiry(subscription.iptv_username, subscription.iptv_password)
      : null

    // Use panel expiry if available (it's the source of truth)
    if (panelExpiry) {
      expiryDate = panelExpiry

      // Sync back to database if different
      const dbExpiry = subscription.expires_at ? new Date(subscription.expires_at).getTime() : 0
      if (Math.abs(expiryDate.getTime() - dbExpiry) > 86400000) { // >1 day difference
        await adminSupabase
          .from('user_subscriptions')
          .update({ expires_at: expiryDate.toISOString() })
          .eq('id', subscription.id)
      }
    }

    const now = new Date()
    const daysRemaining = expiryDate 
      ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null
    
    return NextResponse.json({
      status: daysRemaining === null ? subscription.status : (daysRemaining > 0 ? 'active' : 'expired'),
      username: subscription.iptv_username,
      // Only ever returned to the signed-in owner of this line
      password: subscription.iptv_password || null,
      expiryDate: expiryDate 
        ? expiryDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'Unknown',
      daysRemaining: daysRemaining !== null ? Math.max(0, daysRemaining) : null,
      planName: subscription.plan_name || 'WKTV Premium',
      pendingRequest,
      // Full subscription object for renew page
      subscription: {
        id: subscription.id,
        iptv_username: subscription.iptv_username,
        plan_name: subscription.plan_name,
        price_cents: subscription.price_cents,
        status: subscription.status,
        expires_at: expiryDate ? expiryDate.toISOString() : subscription.expires_at,
        auto_renew: subscription.auto_renew,
      }
    })
  } catch (err) {
    console.error('Subscription error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
