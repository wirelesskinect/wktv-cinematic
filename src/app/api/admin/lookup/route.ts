import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { nxtConfigured, findLine, NxtError } from '@/lib/nxt'
import { lookupExpiry } from '@/lib/panel-lookup'

export const dynamic = 'force-dynamic'

// Admin: look up a line on the IPTV panel by username (and password, which the NXT API requires)
export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const username = req.nextUrl.searchParams.get('username')
    const password = req.nextUrl.searchParams.get('password')
    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 })
    }

    if (nxtConfigured()) {
      if (!password) return NextResponse.json({ error: 'The panel needs the line password too' }, { status: 400 })
      const line = await findLine(username, password)
      if (!line) return NextResponse.json({ error: 'Line not found on the panel' }, { status: 404 })
      return NextResponse.json({
        username: line.username,
        lineId: line.id,
        enabled: line.enabled,
        expireTimestamp: line.expiresAt ? Math.floor(line.expiresAt.getTime() / 1000) : null,
        expireDate: line.expiresAt ? line.expiresAt.toISOString() : null,
      })
    }

    const expires = await lookupExpiry(username, password)
    if (!expires) return NextResponse.json({ error: 'Lookup unavailable or line not found' }, { status: 404 })
    return NextResponse.json({
      username,
      expireTimestamp: Math.floor(expires.getTime() / 1000),
      expireDate: expires.toISOString(),
    })
  } catch (err: any) {
    console.error('[LOOKUP] Error:', err?.message)
    const msg = err instanceof NxtError ? `IPTV panel: ${err.message}` : 'Lookup failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
