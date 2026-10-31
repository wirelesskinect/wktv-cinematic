import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { logout, getSessionCookieName } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(getSessionCookieName())?.value
    
    if (token) {
      await logout(token)
    }
    
    const response = NextResponse.json({ success: true })
    response.cookies.delete(getSessionCookieName())
    
    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
