// Direct connection to the NXT IPTV reseller panel API (HTTPS only).
// Endpoints and auth follow the panel's official WHMCS module ("NXT by Kak"):
//   https://<panel DNS>/api/wclient/v1/...
//   headers: Authorization: Bearer <token>, username: <reseller user>, password: <reseller pass>
//
// Settings (Vercel → Settings → Environment Variables):
//   NXT_API_TOKEN     – the API token from the NXT reseller panel (required to turn this on)
//   NXT_PANEL_DNS     – panel address, e.g. "panel.example.com" (falls back to IPTV_PANEL_URL)
//   IPTV_PANEL_USER   – reseller username
//   IPTV_PANEL_PASS   – reseller password
//   NXT_PACKAGE_MAP   – JSON that maps each WKTV plan to a panel package ID,
//                       e.g. {"trial-free":12,"monthly-1":3,"annual-5":9}

import { randomInt } from 'crypto'

export class NxtError extends Error {}

function panelHost(): string {
  const raw = (process.env.NXT_PANEL_DNS || process.env.IPTV_PANEL_URL || '').trim()
  // Accept "https://host/", "http://host", or "host" and keep only the host (and optional port)
  return raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
}

export function nxtConfigured(): boolean {
  return !!(process.env.NXT_API_TOKEN && panelHost() && process.env.IPTV_PANEL_USER && process.env.IPTV_PANEL_PASS)
}

async function nxtRequest(path: string, body?: Record<string, unknown>): Promise<any> {
  if (!nxtConfigured()) throw new NxtError('IPTV panel is not connected yet')
  const res = await fetch(`https://${panelHost()}/api/wclient/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${process.env.NXT_API_TOKEN}`,
      username: process.env.IPTV_PANEL_USER as string,
      password: process.env.IPTV_PANEL_PASS as string,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new NxtError(`Panel returned an unexpected response (HTTP ${res.status})`)
  }
  if (!res.ok || data?.result === false || data?.result === 'error') {
    throw new NxtError(errorText(data) || `Panel request failed (HTTP ${res.status})`)
  }
  return data
}

function errorText(data: any): string {
  const m = data?.message
  if (!m) return ''
  if (typeof m === 'string') return m
  // Validation errors come back as { field: ["message"] }
  const first = Object.values(m)[0]
  return Array.isArray(first) ? String(first[0]) : String(first)
}

// Panel dates are Unix timestamps (seconds); tolerate strings and other field names.
export function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (Number.isFinite(n) && n > 0) return new Date(n < 1e12 ? n * 1000 : n)
  const d = new Date(String(value))
  return isNaN(d.getTime()) ? null : d
}

function lineExpiry(line: any): Date | null {
  return toDate(line?.expire_date ?? line?.exp_date ?? line?.expiration ?? line?.expires_at)
}

export interface PanelPackage {
  id: string
  name: string
}

export async function accountInfo(): Promise<any> {
  return nxtRequest('account-info')
}

// trial = true lists trial packages, false lists official (paid) packages
export async function listPackages(trial: boolean): Promise<PanelPackage[]> {
  const data = await nxtRequest(`packages/${trial ? 1 : 0}`)
  const source = Array.isArray(data?.data) ? data.data : data
  const out: PanelPackage[] = []
  if (Array.isArray(source)) {
    for (const p of source) if (p && p.id !== undefined) out.push({ id: String(p.id), name: String(p.name ?? p.package_name ?? p.id) })
  } else if (source && typeof source === 'object') {
    for (const [id, p] of Object.entries<any>(source)) {
      if (id === 'result' || id === 'message') continue
      out.push({ id: String(p?.id ?? id), name: String(p?.name ?? p?.package_name ?? p) })
    }
  }
  return out
}

export function packageIdForPlan(planId: string): string | null {
  try {
    const map = JSON.parse(process.env.NXT_PACKAGE_MAP || '{}')
    const id = map?.[planId]
    return id === undefined || id === null || id === '' ? null : String(id)
  } catch {
    return null
  }
}

export interface CreatedLine {
  username: string
  password: string
  expiresAt: Date | null
}

export async function createLine(opts: { packageId: string; trial: boolean; username: string; password: string; description: string }): Promise<CreatedLine> {
  const data = await nxtRequest(`create-line${opts.trial ? '/1' : ''}`, {
    line_type: 'line',
    package: opts.packageId,
    description: opts.description,
    username: opts.username,
    password: opts.password,
  })
  return {
    username: data?.username || opts.username,
    password: data?.password || opts.password,
    expiresAt: lineExpiry(data),
  }
}

export interface PanelLine {
  id: string
  username: string
  expiresAt: Date | null
  enabled: boolean | null
}

export async function findLine(username: string, password: string): Promise<PanelLine | null> {
  const qs = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  const data = await nxtRequest(`lines?${qs}`)
  const line = Array.isArray(data?.data) ? data.data[0] : null
  if (!line) return null
  const enabledRaw = line.enabled ?? line.is_enabled ?? line.status
  return {
    id: String(line.id),
    username: String(line.username ?? username),
    expiresAt: lineExpiry(line),
    enabled: enabledRaw === undefined ? null : enabledRaw === 1 || enabledRaw === '1' || enabledRaw === true || enabledRaw === 'active',
  }
}

export async function extendLine(lineId: string, packageId: string): Promise<Date | null> {
  const data = await nxtRequest(`extend/${encodeURIComponent(lineId)}`, { package: packageId })
  return lineExpiry(data)
}

export async function setLineEnabled(lineId: string, enabled: boolean): Promise<void> {
  await nxtRequest(`enable/${encodeURIComponent(lineId)}`, { enable: enabled ? 1 : 0 })
}

// Strong random IPTV credentials (letters + digits, no look-alike characters)
const CRED_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
function randomString(length: number): string {
  let s = ''
  for (let i = 0; i < length; i++) s += CRED_CHARS[randomInt(CRED_CHARS.length)]
  return s
}

export function generateCredentials(): { username: string; password: string } {
  return { username: `wktv${randomString(8)}`, password: randomString(12) }
}
