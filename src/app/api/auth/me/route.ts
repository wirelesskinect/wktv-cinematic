import { NextRequest, NextResponse } from 'next/server'
import { getSession, getSessionCookieName } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Returns the signed-in user (or null). Never exposes internal error details.
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(getSessionCookieName())?.value
    if (!token) {
      return NextResponse.json({ user: null })
    }
    const user = await getSession(token)
    return NextResponse.json({ user: user || null })
  } catch (error) {
    console.error('auth/me error:', error)
    return NextResponse.json({ user: null })
  }
}
