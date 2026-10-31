import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { signup, getSessionCookieName } from '@/lib/auth'
import { clientIp, signupBlocked, record } from '@/lib/rate-limit'

const MIN_PASSWORD = 8

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
    const email = clean(body?.email, 200)
    const password = typeof body?.password === 'string' ? body.password : ''
    const name = clean(body?.name, 100)
    const phone = clean(body?.phone, 30)

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    if (password.length < MIN_PASSWORD || password.length > 200) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD} characters` },
        { status: 400 }
      )
    }

    const ip = clientIp(request.headers)
    if (await signupBlocked(ip)) {
      return NextResponse.json(
        { error: 'Too many new accounts from this network. Please try again later or contact support.' },
        { status: 429 }
      )
    }

    const result = await signup({ email, password, name: name || undefined, phone: phone || undefined })

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    await record('signup', email, ip).catch(() => {})

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
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
