import { adminSupabase } from '@/lib/supabase-server'

// Simple database-backed limiter for login and signup attempts.
// Table: wktv.auth_attempts (see supabase-migrations/2026-10-24-security.sql).
// If the table is missing or the check fails, requests are allowed (fail open)
// so a database hiccup never locks everyone out.

type Kind = 'login_fail' | 'signup'

export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  return (fwd ? fwd.split(',')[0] : headers.get('x-real-ip') || '').trim().slice(0, 64) || 'unknown'
}

async function countSince(kind: Kind, field: 'email' | 'ip', value: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString()
  const { count, error } = await adminSupabase
    .from('auth_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('kind', kind)
    .eq(field, value)
    .gte('created_at', since)
  if (error) return 0
  return count || 0
}

export async function record(kind: Kind, email: string | null, ip: string): Promise<void> {
  await adminSupabase.from('auth_attempts').insert({ kind, email: email ? email.toLowerCase().slice(0, 200) : null, ip })
}

// Login: max 5 failed tries per email and 25 per IP address in 15 minutes
export async function loginBlocked(email: string, ip: string): Promise<boolean> {
  try {
    const [byEmail, byIp] = await Promise.all([
      countSince('login_fail', 'email', email.toLowerCase(), 15),
      countSince('login_fail', 'ip', ip, 15),
    ])
    return byEmail >= 5 || byIp >= 25
  } catch {
    return false
  }
}

// Signup: max 5 new accounts per IP address per hour
export async function signupBlocked(ip: string): Promise<boolean> {
  try {
    return (await countSince('signup', 'ip', ip, 60)) >= 5
  } catch {
    return false
  }
}
