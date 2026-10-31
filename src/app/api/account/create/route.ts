import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// Retired endpoint (old card-payment / automation flow). Kept as a stub so it can't be
// switched back on by accident. Orders now go through /api/payment/cashapp and
// are activated by an admin from /admin, which talks to the IPTV panel directly.
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
