'use client'

import { useEffect, useState } from 'react'

type Referral = {
  userId: string
  email: string
  name: string | null
  signedUpAt: string
  referrerUsername: string
  referrerEmail: string | null
  referrerExpiresAt: string | null
  boughtPlan: string | null
  boughtAt: string | null
  rewardGivenAt: string | null
  status: 'trial' | 'due' | 'given'
}

const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

const STATUS: Record<Referral['status'], { label: string; pill: string }> = {
  due: { label: 'Free month due', pill: 'pill-yellow' },
  given: { label: 'Free month given', pill: 'pill-green' },
  trial: { label: 'Trial only so far', pill: 'pill-gray' },
}

export default function ReferralsPanel({ onDueCount }: { onDueCount?: (n: number) => void }) {
  const [rows, setRows] = useState<Referral[] | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setError('')
    try {
      const res = await fetch('/api/admin/referrals', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load referrals')
      setNeedsMigration(!!data.needsMigration)
      setRows(data.referrals || [])
      onDueCount?.(data.due || 0)
    } catch (e: any) {
      setError(e.message || 'Could not load referrals')
      setRows([])
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function markGiven(r: Referral) {
    const ok = window.confirm(
      `Give ${r.referrerUsername} their free month?\n\n` +
      `1. In your IPTV panel, add 1 month to the line "${r.referrerUsername}".\n` +
      `2. Then press OK here to mark this referral as paid out.\n\n` +
      `This website doesn’t change the line itself.`
    )
    if (!ok) return
    setBusy(r.userId)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referredUserId: r.userId }),
      })
      const data = await res.json()
      setMsg({ ok: res.ok, text: data.message || data.error || 'Something went wrong.' })
      if (res.ok) await load()
    } catch {
      setMsg({ ok: false, text: 'Something went wrong. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  if (rows === null) return <p className="text-sm text-gray-400">Loading referrals…</p>

  const order = { due: 0, trial: 1, given: 2 }
  const sorted = [...rows].sort((a, b) => order[a.status] - order[b.status])

  return (
    <div style={{ minWidth: 0 }}>
      <p className="text-sm text-gray-400 mb-4">
        Customers share their link from their account page, or a friend types the referrer’s TV username (spelled exactly) when starting a free trial.
        When that friend buys a 1-year plan, the referrer is owed 1 free month.
      </p>
      {needsMigration && (
        <div className="alert alert-warn mb-4">Referrals need a quick database update before they can be saved. Run the 2026-10-26 referrals SQL in Supabase.</div>
      )}
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'} mb-4`}>{msg.text}</div>}
      {!sorted.length && !needsMigration && !error && <p className="text-sm text-muted">No referrals yet.</p>}

      <div className="grid gap-3">
        {sorted.map((r) => (
          <div key={r.userId} className="card" style={{ padding: 16, minWidth: 0 }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                <span className={`pill ${STATUS[r.status].pill}`}>● {STATUS[r.status].label}</span>
                <p className="mt-2" style={{ overflowWrap: 'anywhere' }}><b>{r.email}</b>{r.name ? <span className="text-muted"> ({r.name})</span> : null}</p>
                <p className="text-sm text-muted">Joined {day(r.signedUpAt)}{r.boughtPlan ? ` · Bought ${r.boughtPlan} on ${day(r.boughtAt)}` : ''}</p>
                <p className="text-sm mt-1" style={{ overflowWrap: 'anywhere' }}>
                  Referred by <b>{r.referrerUsername}</b>
                  {r.referrerEmail ? <span className="text-muted"> · {r.referrerEmail}</span> : null}
                  {r.referrerExpiresAt ? <span className="text-muted"> · expires {day(r.referrerExpiresAt)}</span> : null}
                </p>
                {r.status === 'given' && <p className="text-sm text-muted mt-1">Free month given {day(r.rewardGivenAt)}</p>}
              </div>
              {r.status === 'due' && (
                <button type="button" className="btn-primary" disabled={busy === r.userId} onClick={() => markGiven(r)} style={{ minHeight: 40, padding: '8px 14px', fontSize: 13 }}>
                  {busy === r.userId ? 'Saving…' : 'Mark free month given'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={load} className="btn-secondary mt-4" style={{ minHeight: 40, padding: '8px 14px', fontSize: 13 }}>↻ Refresh</button>
    </div>
  )
}
