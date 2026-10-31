import { nxtConfigured, findLine } from '@/lib/nxt'

// Looks up a line's expiry on the IPTV panel.
// Uses the secure NXT panel API when it's connected. The old automation server
// is only used if AUTOMATION_URL is set on purpose (and should be HTTPS).
export async function lookupExpiry(iptvUsername: string, iptvPassword?: string | null): Promise<Date | null> {
  if (!iptvUsername) return null

  if (nxtConfigured()) {
    if (!iptvPassword) return null
    try {
      const line = await findLine(iptvUsername, iptvPassword)
      return line?.expiresAt || null
    } catch (err) {
      console.error('Panel lookup failed:', err)
      return null
    }
  }

  const automationUrl = (process.env.AUTOMATION_URL || '').trim()
  if (!automationUrl) return null
  try {
    const res = await fetch(`${automationUrl.replace(/\/$/, '')}/api/lookup/${encodeURIComponent(iptvUsername)}`, {
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.expireTimestamp ? new Date(Number(data.expireTimestamp) * 1000) : null
  } catch {
    return null
  }
}
