import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SESSION_COOKIE_NAME = 'wktv_session'

// Only protect these routes - redirect to login if not authenticated
const protectedRoutes = ['/dashboard', '/admin']

// Create supabase client for checking sessions
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'wktv' }
    }
  )
}

async function getSessionUser(token: string) {
  if (!token) return null
  
  const supabase = getSupabaseAdmin()
  
  const { data: session, error } = await supabase
    .from('sessions')
    .select(`
      id,
      expires_at,
      user:users (
        id,
        email,
        name,
        role
      )
    `)
    .eq('token', token)
    .single()
  
  if (error || !session) return null
  
  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('sessions').delete().eq('token', token)
    return null
  }
  
  return session.user
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Independent cinematic preview: fail closed until integrations are reviewed.
  // Keep all existing backend handlers intact; no preview request reaches them.
  if (process.env.WKTV_CINEMATIC_LIVE_ENABLED !== 'true' &&
      (path.startsWith('/api/') || ['/pay', '/signup', '/renew', '/dashboard', '/admin'].some(route => path === route || path.startsWith(route + '/')))) {
    return NextResponse.json({ error: 'Preview only. Account, payment and admin actions are disabled until integrations are verified.' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
  }
  
  // Only check protected routes
  if (!protectedRoutes.some(route => path.startsWith(route))) {
    return NextResponse.next()
  }
  
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const user = token ? await getSessionUser(token) : null
  
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  
  // Admin route check
  if (path.startsWith('/admin') && (user as any).role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/pay/:path*',
    '/signup/:path*',
    '/renew/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
  ],
}
