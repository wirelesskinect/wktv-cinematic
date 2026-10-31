import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { login, getSessionCookieName } from '@/lib/auth'
import { clientIp, loginBlocked, record } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const ip = clientIp(request.headers)
    if (await loginBlocked(email, ip)) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Please wait 15 minutes and try again, or contact support.' },
        { status: 429 }
      )
    }

    const result = await login({ email, password })

    if ('error' in result) {
      await record('login_fail', email, ip).catch(() => {})
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      )
    }

    // Set session cookie
    const response = NextResponse.json({ user: result.user })
    response.cookies.set(getSessionCookieName(), result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
