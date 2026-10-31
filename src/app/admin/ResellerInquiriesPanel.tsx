'use client'

import { useEffect, useState } from 'react'

type Status = 'new' | 'contacted' | 'approved' | 'declined'
type Inquiry = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: Status
  admin_note: string | null
  created_at: string
  updated_at: string
}

const when = (d: string) =>
  new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

const STATUS: Record<Status, { label: string; pill: string }> = {
  new: { label: 'New', pill: 'pill-yellow' },
  contacted: { label: 'Contacted', pill: 'pill-gray' },
  approved: { label: 'Approved', pill: 'pill-green' },
  declined: { label: 'Declined', pill: 'pill-red' },
}
const ORDER: Status[] = ['new', 'contacted', 'approved', 'declined']

export default function ResellerInquiriesPanel({ onNewCount }: { onNewCount?: (n: number) => void }) {
  const [rows, setRows] = useState<Inquiry[] | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<Status | 'all'>('all')

  async function load() {
    setError('')
    try {
      const res = await fetch('/api/admin/resellers', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load reseller inquiries')
      setNeedsMigration(!!data.needsMigration)
      setRows(data.inquiries || [])
      onNewCount?.(data.newCount || 0)
    } catch (e: any) {
      setError(e.message || 'Could not load reseller inquiries')
      setRows([])
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(id: string, patch: { status?: Status; note?: string }) {
    setBusy(id)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/resellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      const data = await res.json()
      if (!res.ok) setMsg({ ok: false, text: data.error || 'Could not save.' })
      else {
        setMsg({ ok: true, text: 'Saved.' })
        await load()
      }
    } catch {
      setMsg({ ok: false, text: 'Something went wrong. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  if (rows === null) return <p className="text-sm text-gray-400">Loading reseller inquiries…</p>

  const shown = rows
    .filter((r) => filter === 'all' || r.status === filter)
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.created_at.localeCompare(a.created_at))

  return (
    <div style={{ minWidth: 0 }}>
      <p className="text-sm text-gray-400 mb-4">
        People who filled out “Become a reseller” on the homepage. Sending the form doesn’t give them an account,
        panel access or credits. Contact them, then mark the result here. Setting up an approved reseller still happens in your IPTV panel.
      </p>
      {needsMigration && (
        <div className="alert alert-warn mb-4">
          Reseller inquiries need a quick database update before they can be saved here. Run the 2026-10-28 reseller inquiries SQL in Supabase.
          Until then, new inquiries still arrive as Pushover alerts.
        </div>
      )}
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'} mb-4`}>{msg.text}</div>}

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {(['all', ...ORDER] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={filter === s ? 'btn-primary' : 'btn-secondary'}
              style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }}
            >
              {s === 'all' ? `All (${rows.length})` : `${STATUS[s].label} (${rows.filter((r) => r.status === s).length})`}
            </button>
          ))}
        </div>
      )}

      {!rows.length && !needsMigration && !error && <p className="text-sm text-muted">No reseller inquiries yet.</p>}

      <div className="grid gap-3">
        {shown.map((r) => {
          const note = notes[r.id] ?? r.admin_note ?? ''
          return (
            <div key={r.id} className="card" style={{ padding: 16, minWidth: 0 }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                  <span className={`pill ${STATUS[r.status].pill}`}>● {STATUS[r.status].label}</span>
                  <p className="mt-2" style={{ overflowWrap: 'anywhere' }}><b>{r.first_name} {r.last_name}</b></p>
                  <p className="text-sm" style={{ overflowWrap: 'anywhere' }}>
                    <a href={`mailto:${r.email}`} className="underline">{r.email}</a>
                    {r.phone ? <> · <a href={`tel:${r.phone.replace(/[^0-9+]/g, '')}`} className="underline">{r.phone}</a></> : null}
                  </p>
                  <p className="text-sm text-muted mt-1">Sent {when(r.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ORDER.filter((s) => s !== r.status && s !== 'new').map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="btn-secondary"
                      disabled={busy === r.id}
                      onClick={() => save(r.id, { status: s })}
                      style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }}
                    >
                      Mark {STATUS[s].label.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <input
                  className="input"
                  style={{ flex: '1 1 220px', minHeight: 40, fontSize: 14 }}
                  placeholder="Private note (only admins see this)"
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy === r.id || note === (r.admin_note ?? '')}
                  onClick={() => save(r.id, { note })}
                  style={{ minHeight: 40, padding: '6px 12px', fontSize: 13 }}
                >
                  {busy === r.id ? 'Saving…' : 'Save note'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <button type="button" onClick={load} className="btn-secondary mt-4" style={{ minHeight: 40, padding: '8px 14px', fontSize: 13 }}>↻ Refresh</button>
    </div>
  )
}
