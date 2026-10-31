'use client'

import { useEffect, useRef, useState } from 'react'

// Colors validated for the dark admin surface (CVD-safe pair): WKTV red = real sales, blue = historic estimates
const REAL = '#ee302f'
const HISTORIC = '#3b82f6'
const SIGNUPS = '#ee302f'

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`
const monthLabel = (m: string, long = false) =>
  new Date(`${m}-15T00:00:00Z`).toLocaleDateString('en-US', { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit', timeZone: 'UTC' })
const methodLabel: Record<string, string> = { cashapp: 'Cash App', zelle: 'Zelle', venmo: 'Venmo', cash: 'Cash', other: 'Other', backfill: 'Historic', trial: 'Trial' }

type Month = { month: string; real: number; historic: number; signups: number; sales: number }

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: 18, minWidth: 0 }}>
      <p className="text-xs uppercase tracking-widest text-muted mb-1">{label}</p>
      <p className="text-3xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
      {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
    </div>
  )
}

// Vertical bar chart (one series or two stacked), with hover tooltips and a recessive grid
function BarChart({ months, series, valueFormat, title, integer }: {
  months: Month[]
  series: { key: 'real' | 'historic' | 'signups'; label: string; color: string }[]
  valueFormat: (v: number) => string
  title: string
  integer?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  // Draw at the real on-screen width so text stays readable on phones
  const boxRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(720)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => setW(Math.max(280, Math.round(el.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = W < 500 ? 200 : 220, padL = 52, padB = 26, padT = 10
  const totals = months.map((m) => series.reduce((n, s) => n + (m[s.key] as number), 0))
  const max = Math.max(1, ...totals)
  const nice = (() => {
    if (integer && max <= 4) return 4
    const p = Math.pow(10, Math.floor(Math.log10(max)))
    const n = Math.ceil(max / p) * p
    return integer ? Math.ceil(n / 4) * 4 : n
  })()
  const plotW = W - padL - 8, plotH = H - padB - padT
  const slot = plotW / Math.max(1, months.length)
  const barW = Math.max(6, Math.min(36, slot * 0.6))
  const y = (v: number) => padT + plotH - (v / nice) * plotH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice)
  const labelEvery = Math.ceil(months.length / (W < 500 ? 4 : 8))

  return (
    <div className="card" style={{ padding: 18, minWidth: 0 }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <p className="font-bold">{title}</p>
        {series.length > 1 && (
          <div className="flex gap-4 text-sm text-gray-300">
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-2"><span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />{s.label}</span>
            ))}
          </div>
        )}
      </div>
      <div ref={boxRef} style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', maxWidth: '100%' }} role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.08)" />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#9a9aa6">{valueFormat(t)}</text>
            </g>
          ))}
          {months.map((m, i) => {
            const x = padL + slot * i + (slot - barW) / 2
            let base = 0
            const segs = series.map((s) => {
              const v = m[s.key] as number
              const seg = { s, v, y0: base, y1: base + v }
              base += v
              return seg
            }).filter((g) => g.v > 0)
            return (
              <g key={m.month}>
                {segs.map((g, j) => {
                  const top = y(g.y1), bottom = y(g.y0)
                  const h = Math.max(0, bottom - top - (j > 0 ? 2 : 0)) // 2px gap between stacked segments
                  const isTop = j === segs.length - 1
                  return isTop ? (
                    <path key={g.s.key} fill={g.s.color} opacity={hover === null || hover === i ? 1 : 0.45}
                      d={`M${x},${top + h} V${top + 4} Q${x},${top} ${x + 4},${top} H${x + barW - 4} Q${x + barW},${top} ${x + barW},${top + 4} V${top + h} Z`} />
                  ) : (
                    <rect key={g.s.key} x={x} y={top} width={barW} height={h} fill={g.s.color} opacity={hover === null || hover === i ? 1 : 0.45} />
                  )
                })}
                {/* Hit target bigger than the bar */}
                <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} />
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#9a9aa6">{monthLabel(m.month)}</text>
                )}
              </g>
            )
          })}
          <line x1={padL} x2={W - 8} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.25)" />
        </svg>
        {hover !== null && months[hover] && (
          <div className="text-sm" style={{
            position: 'absolute', top: 0, pointerEvents: 'none',
            left: `${Math.min(78, Math.max(0, ((padL + slot * hover) / W) * 100))}%`,
            background: '#1c1c22', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10, padding: '8px 10px', minWidth: 150,
          }}>
            <p className="font-bold mb-1">{monthLabel(months[hover].month, true)}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-gray-300">
                <span className="flex items-center gap-2"><span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />{s.label}</span>
                <b className="text-white">{valueFormat(months[hover][s.key] as number)}</b>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SalesDashboard() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    setError('')
    try {
      const res = await fetch('/api/admin/sales', { cache: 'no-store' })
      const d = await res.json()
      if (!res.ok || d.error) setError(d.error || 'Could not load sales')
      else setData(d)
    } catch {
      setError('Could not load sales')
    }
  }
  useEffect(() => { load() }, [])

  async function backfill() {
    if (!window.confirm('Add historic sales for connected customers who aren’t counted yet?\n\nAnnual plans whose year started more than 30 days ago count at last year’s price (today’s price minus $25). Other plans count at today’s price.')) return
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'backfill' }) })
      const d = await res.json()
      setMsg(d.error || d.message)
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>
  if (!data) return <p className="text-sm text-gray-400">Loading sales…</p>
  const t = data.totals
  const months: Month[] = data.months

  return (
    <div className="grid gap-4" style={{ minWidth: 0 }}>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4" style={{ minWidth: 0 }}>
        <Tile label="Total sales" value={money(t.totalCents)} sub={`${t.sales} sale${t.sales === 1 ? '' : 's'} all time`} />
        <Tile label="This month" value={money(t.thisMonthCents)} />
        <Tile label="Accounts" value={String(t.accounts)} sub={`+${t.accountsThisMonth} this month`} />
        <Tile label="Active lines" value={String(t.activeLines)} sub={`${t.activeConnections} connection${t.activeConnections === 1 ? '' : 's'}`} />
      </div>
      <p className="text-sm text-gray-400">
        Website sales <b className="text-white">{money(t.realCents)}</b> · Historic (backfilled) <b className="text-white">{money(t.historicCents)}</b>
      </p>

      {months.length > 0 ? (
        <>
          <BarChart title="Sales by month" months={months} valueFormat={(v) => money(v)}
            series={[{ key: 'real', label: 'Website sales', color: REAL }, { key: 'historic', label: 'Historic (backfilled)', color: HISTORIC }]} />
          <BarChart title="New accounts by month" months={months} valueFormat={(v) => String(Math.round(v))}
            series={[{ key: 'signups', label: 'New accounts', color: SIGNUPS }]} integer />
        </>
      ) : <p className="text-sm text-gray-400">No sales or accounts yet.</p>}

      {t.backfillCandidates > 0 && (
        <div className="alert alert-warn flex flex-wrap items-center justify-between gap-3">
          <span>{t.backfillCandidates} connected customer{t.backfillCandidates > 1 ? 's aren’t' : ' isn’t'} counted in sales yet.</span>
          <button type="button" onClick={backfill} disabled={busy} className="btn-secondary" style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }}>
            {busy ? 'Adding…' : 'Add historic sales'}
          </button>
        </div>
      )}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="card" style={{ padding: 18, minWidth: 0 }}>
        <p className="font-bold mb-3">By plan</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400"><th className="pb-2 font-medium">Plan</th><th className="pb-2 font-medium text-right">Sales</th><th className="pb-2 font-medium text-right">Revenue</th><th className="pb-2 font-medium text-right">Historic</th></tr></thead>
            <tbody>
              {data.plans.map((p: any) => (
                <tr key={p.planId} className="border-t border-gray-800/60">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-right">{p.sales}</td>
                  <td className="py-2 text-right font-bold">{money(p.cents)}</td>
                  <td className="py-2 text-right text-gray-400">{p.historicCents ? money(p.historicCents) : '—'}</td>
                </tr>
              ))}
              {data.plans.length === 0 && <tr><td colSpan={4} className="py-2 text-gray-400">No sales yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 18, minWidth: 0 }}>
        <p className="font-bold mb-3">Recent sales</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead><tr className="text-left text-gray-400"><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Customer</th><th className="pb-2 font-medium">Plan</th><th className="pb-2 font-medium">Paid with</th><th className="pb-2 font-medium text-right">Amount</th></tr></thead>
            <tbody>
              {data.recent.map((r: any, i: number) => (
                <tr key={r.id || `${r.date}-${i}`} className="border-t border-gray-800/60" title={r.note}>
                  <td className="py-2 whitespace-nowrap">{new Date(r.date).toLocaleDateString('en-US')}</td>
                  <td className="py-2 pr-3">{r.email}</td>
                  <td className="py-2">{r.plan}</td>
                  <td className="py-2">{r.historic ? <span style={{ color: '#93c5fd' }}>Historic</span> : (methodLabel[r.method] || r.method)}</td>
                  <td className="py-2 text-right font-bold">{money(r.amountCents)}</td>
                </tr>
              ))}
              {data.recent.length === 0 && <tr><td colSpan={5} className="py-2 text-gray-400">No sales yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
