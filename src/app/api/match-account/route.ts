import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// Disabled for security: this old endpoint let anyone link any account to an
// active subscription without logging in. Admins link accounts from /admin instead.
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
