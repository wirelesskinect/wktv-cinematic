import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// Retired: the old support chat forwarded messages to a third-party server over plain http.
// Nothing on the site uses it anymore. Support messages go through /api/support.
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
