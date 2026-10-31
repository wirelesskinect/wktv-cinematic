import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// Debug endpoint disabled for security (it exposed session details).
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
