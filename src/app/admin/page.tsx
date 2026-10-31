'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import SalesDashboard from '@/components/SalesDashboard'
import ReferralsPanel from '@/components/ReferralsPanel'
import ResellerInquiriesPanel from './ResellerInquiriesPanel'
import { PLAN_LIST, getPlan, paymentNoteCode, PAYMENT_METHOD_LABELS } from '@/lib/plans'

interface PendingSignup {
  id: string
  user_id: string
  name: string
  email: string
  phone: string | null
  plan_id: string
  plan_name: string
  amount_cents: number
  payment_method: string
  cashapp_name: string
  requested_username?: string | null
  status: string
  notes: string | null
  created_at: string
}

export default function AdminPage() {
  const [pendingSignups, setPendingSignups] = useState<PendingSignup[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending')

  const [panel, setPanel] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[] | null>(null)
  const [accountSearch, setAccountSearch] = useState('')
  const [accountMsg, setAccountMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function loadAccounts() {
    try {
      const res = await fetch('/api/admin/accounts', { cache: 'no-store' })
      const data = await res.json()
      setAccounts(Array.isArray(data.accounts) ? data.accounts : [])
    } catch {
      setAccounts([])
    }
  }

  useEffect(() => { loadAccounts() }, [])

  async function deleteAccount(a: any) {
    const typed = window.prompt(
      `Permanently delete ${a.email}?\n\nThis removes the account, its login sessions, plan record, orders and payments. It can't be undone.` +
      (a.tvLogin ? `\n\nTheir TV line "${a.tvLogin}" will stay on your IPTV panel.` : '') +
      `\n\nType the email to confirm:`
    )
    if (typed === null) return
    if (typed.trim().toLowerCase() !== String(a.email).toLowerCase()) {
      setAccountMsg({ ok: false, text: 'The email didn’t match, so nothing was deleted.' })
      return
    }
    setDeleting(a.id)
    setAccountMsg(null)
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: a.id, confirmEmail: typed.trim() }),
      })
      const data = await res.json()
      setAccountMsg({ ok: res.ok && !data.error, text: data.error || data.message })
      await loadAccounts()
      fetchPendingSignups()
    } catch {
      setAccountMsg({ ok: false, text: 'Could not delete this account.' })
    } finally {
      setDeleting(null)
    }
  }

  const [linkForm, setLinkForm] = useState({ email: '', iptvUsername: '', iptvPassword: '', planId: '', expiresAt: '' })
  const [linkOpen, setLinkOpen] = useState(false)
  // Renew a customer's existing line for a payment received outside the site
  const [renewFor, setRenewFor] = useState<string | null>(null)
  const [renewPlanId, setRenewPlanId] = useState('monthly-1')
  const [renewPaidWith, setRenewPaidWith] = useState('cashapp')
  const [renewNote, setRenewNote] = useState('')
  const [renewing, setRenewing] = useState(false)
  const [renewMsg, setRenewMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function renewAccount(a: any) {
    const plan = getPlan(renewPlanId)
    if (!plan) return
    if (!window.confirm(`Renew ${a.tvLogin} (${a.email}) with ${plan.name} for $${plan.price}?\n\nThis extends their line on the IPTV panel right away and uses panel credits. Only do this once you've received the payment.`)) return
    setRenewing(true)
    setRenewMsg(null)
    try {
      const res = await fetch('/api/admin/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: a.id, planId: plan.id, paidWith: renewPaidWith, note: renewNote }),
      })
      const data = await res.json()
      setRenewMsg({ ok: res.ok && !data.error, text: data.error || data.message })
      if (res.ok && !data.error) {
        setRenewNote('')
        loadAccounts()
      }
    } catch {
      setRenewMsg({ ok: false, text: 'Could not renew. Nothing was changed; try again.' })
    } finally {
      setRenewing(false)
    }
  }
  const [editingExisting, setEditingExisting] = useState(false)

  // Open the customer form pre-filled for one account (from the Accounts list)
  function editAccount(a: any) {
    setLinkForm({
      email: a.email || '',
      iptvUsername: a.tvLogin || '',
      iptvPassword: '',
      planId: a.planId || '',
      expiresAt: a.expiresAt ? new Date(a.expiresAt).toISOString().slice(0, 10) : '',
    })
    setEditingExisting(!!a.tvLogin)
    setLinkMsg(null)
    setLinkOpen(true)
    setTimeout(() => document.getElementById('customer-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [linking, setLinking] = useState(false)

  async function linkExisting(e: React.FormEvent) {
    e.preventDefault()
    setLinking(true)
    setLinkMsg(null)
    try {
      const res = await fetch('/api/admin/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkForm),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLinkMsg({ ok: false, text: data.error || 'Could not link this customer.' })
      } else {
        setLinkMsg({ ok: true, text: data.message })
        setLinkForm({ email: '', iptvUsername: '', iptvPassword: '', planId: '', expiresAt: '' })
        setEditingExisting(false)
        loadAccounts()
      }
    } catch {
      setLinkMsg({ ok: false, text: 'Could not link this customer.' })
    } finally {
      setLinking(false)
    }
  }

  useEffect(() => {
    fetchPendingSignups()
  }, [filter])

  useEffect(() => {
    fetch('/api/admin/panel', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setPanel)
      .catch(() => setPanel({ connected: false, error: 'Could not reach the panel check' }))
  }, [])

  async function fetchPendingSignups() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/signups?status=${filter}`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setPendingSignups(data.signups || [])
      }
    } catch (err) {
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  async function approveSignup(signupId: string) {
    setProcessing(signupId)
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupId }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        const creds = data.credentials ? `\n\nUsername: ${data.credentials.username}\nPassword: ${data.credentials.password}` : ''
        const exp = data.expiresAt ? `\nExpires: ${new Date(data.expiresAt).toLocaleString()}` : ''
        alert(`Approved. ${data.message || ''}${creds}${exp}`)
        fetchPendingSignups()
      }
    } catch (err) {
      alert('Failed to approve')
    } finally {
      setProcessing(null)
    }
  }

  async function rejectSignup(signupId: string) {
    if (!confirm('Are you sure you want to reject this signup?')) return
    
    setProcessing(signupId)
    try {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupId }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        alert('Rejected')
        fetchPendingSignups()
      }
    } catch (err) {
      alert('Failed to reject')
    } finally {
      setProcessing(null)
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="portal-main animate-in">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Admin</span>
          <h1 className="page-title">Orders &amp; activations</h1>
          <p className="page-sub">Confirm the payment (Cash App, Zelle or Venmo) and its note code before approving. Free trials have no payment.</p>
        </div>
        <button onClick={() => fetchPendingSignups()} className="btn-secondary">↻ Refresh</button>
      </div>
      <div>
        {/* IPTV panel connection */}
        <div className="tile mb-8" style={{ padding: '16px 20px' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>IPTV panel</strong>
            <span className={panel?.connected ? 'text-green-400' : 'text-yellow-400'}>
              {!panel ? 'Checking…' : panel.connected ? '● Connected: approvals create and extend lines automatically' : '● Not connected: approvals run in manual mode'}
            </span>
          </div>
          {panel && !panel.connected && (
            <p className="text-sm text-gray-400 mt-2">
              {panel.error ? `Error: ${panel.error}. ` : ''}
              {panel.missing?.length ? `Missing Vercel settings: ${panel.missing.join(', ')}.` : ''}
            </p>
          )}
          {panel?.plans && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-gray-300">Plans → panel packages</summary>
              <ul className="mt-2 space-y-1 text-gray-400">
                {panel.plans.map((p: any) => (
                  <li key={p.id}>{p.name} <code>({p.id})</code>: {p.packageId ? `package ${p.packageId}` : <span className="text-yellow-400">not set</span>}</li>
                ))}
              </ul>
              {panel.packages && (
                <div className="mt-3 text-gray-400">
                  <div>Official packages: {panel.packages.official.map((k: any) => `${k.id} = ${k.name}`).join(' · ') || 'none'}</div>
                  <div>Trial packages: {panel.packages.trial.map((k: any) => `${k.id} = ${k.name}`).join(' · ') || 'none'}</div>
                </div>
              )}
            </details>
          )}
        </div>

        {/* Existing customers */}
        <details id="customer-form" open={linkOpen} onToggle={(e) => setLinkOpen((e.target as HTMLDetailsElement).open)} className="tile mb-8" style={{ padding: '16px 20px' }}>
          <summary className="cursor-pointer"><strong>{editingExisting ? `Edit plan for ${linkForm.email}` : 'Add or edit a customer’s TV line & plan'}</strong> <span className="text-sm text-gray-400">: or click <b>Edit plan</b> next to an account below</span></summary>
          <p className="text-sm text-gray-400 mt-3">
            The customer must sign up at wktv.live first. If you enter the line password, the expiration date is read from the IPTV panel automatically; otherwise the date you type is used.
            Customers can also do this themselves from their account page with their TV app username and password.
          </p>
          <form onSubmit={linkExisting} className="grid gap-3 sm:grid-cols-2 mt-4">
            <div>
              <label className="field-label" style={{ fontSize: 13 }}>Customer’s website email</label>
              <input type="email" required value={linkForm.email} onChange={(e) => setLinkForm({ ...linkForm, email: e.target.value })} placeholder="customer@email.com" />
            </div>
            <div>
              <label className="field-label" style={{ fontSize: 13 }}>IPTV username</label>
              <input type="text" required value={linkForm.iptvUsername} onChange={(e) => setLinkForm({ ...linkForm, iptvUsername: e.target.value })} placeholder="As shown in the panel" autoCapitalize="none" />
            </div>
            <div>
              <label className="field-label" style={{ fontSize: 13 }}>IPTV password (recommended)</label>
              <input type="text" value={linkForm.iptvPassword} onChange={(e) => setLinkForm({ ...linkForm, iptvPassword: e.target.value })} placeholder={editingExisting ? 'Leave blank to keep the saved password' : 'Shown to the customer on their account'} autoComplete="off" />
              {editingExisting && <p className="field-hint">Switching them to a different TV username? Enter that line’s password too.</p>}
            </div>
            <div>
              <label className="field-label" style={{ fontSize: 13 }}>Plan</label>
              <select value={linkForm.planId} onChange={(e) => setLinkForm({ ...linkForm, planId: e.target.value })}>
                <option value="">Not sure / other</option>
                {PLAN_LIST.filter((p) => p.price > 0).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" style={{ fontSize: 13 }}>Expiration date</label>
              <input type="date" value={linkForm.expiresAt} onChange={(e) => setLinkForm({ ...linkForm, expiresAt: e.target.value })}
                style={{ width: '100%', colorScheme: 'dark', background: 'rgba(255,255,255,.04)', color: '#fff', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '12px 14px', minHeight: 48 }} />
              <p className="field-hint">Optional if you entered the password or picked a lifetime plan.</p>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={linking} className="btn-primary w-full">{linking ? 'Saving…' : editingExisting ? 'Save changes →' : 'Link customer →'}</button>
            </div>
          </form>
          {linkMsg && <div className={`alert ${linkMsg.ok ? 'alert-success' : 'alert-error'} mt-4`}>{linkMsg.text}</div>}
        </details>

        {/* Sales & signups dashboard */}
        <details open className="tile mb-8" style={{ padding: '16px 20px' }}>
          <summary className="cursor-pointer"><strong>Sales</strong> <span className="text-sm text-gray-400">: revenue, signups and plans over time</span></summary>
          <div className="mt-4"><SalesDashboard /></div>
        </details>

        {/* Referrals: free month for the referrer when their friend buys a 1-year plan */}
        <ReferralsSection />

        {/* Reseller inquiries from the homepage form */}
        <ResellerInquiriesSection />

        {/* All website accounts */}
        <details open className="tile mb-8" style={{ padding: '16px 20px' }}>
          <summary className="cursor-pointer">
            <strong>Accounts</strong> <span className="text-sm text-gray-400">: {accounts ? `${accounts.length} total` : 'loading…'}</span>
          </summary>
          <div className="flex flex-wrap gap-3 items-center mt-4">
            <input type="search" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)}
              placeholder="Search email, name or TV login" style={{ maxWidth: 360 }} />
            <button type="button" onClick={loadAccounts} className="btn-secondary" style={{ minHeight: 40, padding: '8px 14px', fontSize: 13 }}>↻ Refresh</button>
          </div>
          {accountMsg && <div className={`alert ${accountMsg.ok ? 'alert-success' : 'alert-error'} mt-4`}>{accountMsg.text}</div>}
          <div className="mt-4 grid gap-2">
            {(accounts || [])
              .filter((a) => {
                const q = accountSearch.trim().toLowerCase()
                return !q || [a.email, a.name, a.tvLogin].some((v) => String(v || '').toLowerCase().includes(q))
              })
              .map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/60 py-3">
                  <div className="min-w-0" style={{ flex: '1 1 260px' }}>
                    <div className="font-medium break-all">
                      {a.email}
                      {a.role === 'admin' && <span className="ml-2 text-xs text-yellow-400">ADMIN</span>}
                      {a.isYou && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                    </div>
                    <div className="text-sm text-gray-400">
                      {a.name || 'No name'} · joined {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {a.phone ? ` · ${a.phone}` : ''}
                    </div>
                  </div>
                  <div className="text-sm text-gray-300" style={{ flex: '1 1 200px' }}>
                    {a.tvLogin ? (
                      <>
                        TV login <b>{a.tvLogin}</b> · {a.planStatus || '—'}
                        {a.expiresAt && <span className="text-gray-400"> · expires {new Date(a.expiresAt).toLocaleDateString('en-US')}</span>}
                      </>
                    ) : <span className="text-gray-500">No plan</span>}
                    {a.orders > 0 && <div className="text-xs text-gray-500">{a.orders} order{a.orders > 1 ? 's' : ''}{a.pendingOrders ? `, ${a.pendingOrders} waiting` : ''}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {a.tvLogin && (
                      <button type="button" onClick={() => { setRenewFor(renewFor === a.id ? null : a.id); setRenewMsg(null) }}
                        className="btn-primary" style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }}>
                        {renewFor === a.id ? 'Close' : 'Renew'}
                      </button>
                    )}
                    <button type="button" onClick={() => editAccount(a)}
                      className="btn-secondary mr-2" style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }}>
                      {a.tvLogin ? 'Edit plan' : 'Add plan'}
                    </button>
                    {a.role !== 'admin' && !a.isYou ? (
                      <button type="button" onClick={() => deleteAccount(a)} disabled={deleting === a.id}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm disabled:opacity-50">
                        {deleting === a.id ? 'Deleting…' : 'Delete'}
                      </button>
                    ) : <span className="text-xs text-gray-500">Protected</span>}
                  </div>
                  {renewFor === a.id && (
                    <div className="w-full rounded-xl p-4 mt-1" style={{ background: 'rgba(238,48,47,.06)', border: '1px solid rgba(238,48,47,.3)' }}>
                      <p className="font-bold mb-1">Renew {a.tvLogin}</p>
                      <p className="text-sm text-gray-400 mb-3">
                        For a payment you already received. This extends their existing line on the IPTV panel (same username and password) and updates their account page.
                        {a.pendingOrders ? ' They have an order waiting below. Approve that instead if it’s for this payment.' : ''}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="field-label" style={{ fontSize: 13 }}>Plan</label>
                          <select value={renewPlanId} onChange={(e) => setRenewPlanId(e.target.value)}>
                            {PLAN_LIST.filter((p) => p.kind !== 'trial').map((p) => <option key={p.id} value={p.id}>{p.name} · ${p.price}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="field-label" style={{ fontSize: 13 }}>Paid with</label>
                          <select value={renewPaidWith} onChange={(e) => setRenewPaidWith(e.target.value)}>
                            <option value="cashapp">Cash App</option>
                            <option value="zelle">Zelle</option>
                            <option value="venmo">Venmo</option>
                            <option value="cash">Cash</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="field-label" style={{ fontSize: 13 }}>Note (optional)</label>
                          <input type="text" value={renewNote} onChange={(e) => setRenewNote(e.target.value)} placeholder="e.g. paid 10/25" maxLength={120} />
                        </div>
                      </div>
                      <button type="button" onClick={() => renewAccount(a)} disabled={renewing} className="btn-primary w-full mt-4">
                        {renewing ? 'Renewing on the panel…' : `Renew now · ${getPlan(renewPlanId)?.name} · $${getPlan(renewPlanId)?.price}`}
                      </button>
                      {renewMsg && <div className={`alert ${renewMsg.ok ? 'alert-success' : 'alert-error'} mt-3`}>{renewMsg.text}</div>}
                    </div>
                  )}
                </div>
              ))}
            {accounts && accounts.length === 0 && <p className="text-sm text-gray-400">No accounts yet.</p>}
          </div>
        </details>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-8">
          <div className="card text-center">
            <p className="text-4xl font-extrabold" style={{ color: '#fde68a', fontFamily: 'var(--font-display)' }}>
              {pendingSignups.filter(s => s.status === 'pending').length}
            </p>
            <p className="text-gray-400 text-sm mt-1">Pending</p>
          </div>
          <div className="card text-center">
            <p className="text-4xl font-extrabold" style={{ color: '#86efac', fontFamily: 'var(--font-display)' }}>
              {pendingSignups.filter(s => s.status === 'approved').length}
            </p>
            <p className="text-gray-400 text-sm mt-1">Approved</p>
          </div>
          <div className="card text-center">
            <p className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
              {pendingSignups.length}
            </p>
            <p className="text-gray-400 text-sm mt-1">Total</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('pending')}
            className={`tile ${filter === 'pending' ? 'is-active' : ''}`} style={{ padding: '8px 16px' }}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`tile ${filter === 'approved' ? 'is-active' : ''}`} style={{ padding: '8px 16px' }}
          >
            Approved
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`tile ${filter === 'all' ? 'is-active' : ''}`} style={{ padding: '8px 16px' }}
          >
            All
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error mb-6">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : pendingSignups.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No {filter === 'all' ? '' : filter} signups found
          </div>
        ) : (
          /* Signups Table */
          <div className="card overflow-x-auto" style={{ padding: 20 }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400 text-sm">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Paid with</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingSignups.map((signup) => (
                  <tr key={signup.id} className="border-b border-gray-800/50">
                    <td className="py-4 text-sm text-gray-400">
                      {formatDate(signup.created_at)}
                    </td>
                    <td className="py-4">
                      <div className="font-medium">{signup.name}</div>
                      <div className="text-sm text-gray-500">{signup.email}</div>
                      {(signup.notes?.startsWith('Device:') || signup.notes?.startsWith('Referred by:')) && (
                        <div className="text-sm text-gray-400">{signup.notes}</div>
                      )}
                      {signup.notes?.startsWith('Ship to:') && (
                        <div className="text-sm mt-1 rounded-lg px-2 py-1" style={{ background: 'rgba(230,41,50,.12)', border: '1px solid rgba(230,41,50,.4)', color: '#fecaca' }}>📦 {signup.notes}</div>
                      )}
                      {signup.requested_username && (
                        <div className="text-sm text-gray-400">Wants login: <b>{signup.requested_username}</b></div>
                      )}
                      {signup.phone && (
                        <div className="text-sm text-gray-500">{signup.phone}</div>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="font-medium">{signup.plan_name}</div>
                      <div className="text-sm text-gray-500">{signup.plan_id}</div>
                    </td>
                    <td className="py-4">
                      <span className="text-green-400 font-bold">
                        ${(signup.amount_cents / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="bg-green-900/30 text-green-400 px-2 py-1 rounded text-sm inline-block">
                        {signup.amount_cents === 0 ? 'Free trial' : (
                          <>
                            <div>{(PAYMENT_METHOD_LABELS as Record<string, string>)[signup.payment_method] || signup.payment_method}: {signup.cashapp_name || '—'}</div>
                            {getPlan(signup.plan_id) && <div className="text-xs text-gray-500">Note should say <b>{paymentNoteCode(getPlan(signup.plan_id)!)}</b></div>}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        signup.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' :
                        signup.status === 'approved' ? 'bg-green-900/30 text-green-400' :
                        'bg-red-900/30 text-red-400'
                      }`}>
                        {signup.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4">
                      {signup.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveSignup(signup.id)}
                            disabled={processing === signup.id}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                          >
                            {processing === signup.id ? '...' : '✓ Approve'}
                          </button>
                          <button
                            onClick={() => rejectSignup(signup.id)}
                            disabled={processing === signup.id}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                          >
                            ✗
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function ReferralsSection() {
  const [due, setDue] = useState(0)
  return (
    <details open className="tile mb-8" style={{ padding: '16px 20px' }}>
      <summary className="cursor-pointer">
        <strong>Referrals</strong>{' '}
        <span className="text-sm text-gray-400">: {due ? `${due} free month${due > 1 ? 's' : ''} to give` : 'friends who started a trial with a referral username'}</span>
      </summary>
      <div className="mt-4"><ReferralsPanel onDueCount={setDue} /></div>
    </details>
  )
}

function ResellerInquiriesSection() {
  const [newCount, setNewCount] = useState(0)
  return (
    <details open className="tile mb-8" style={{ padding: '16px 20px' }}>
      <summary className="cursor-pointer">
        <strong>Reseller inquiries</strong>{' '}
        <span className="text-sm text-gray-400">: {newCount ? `${newCount} new` : 'people who asked to become a reseller'}</span>
      </summary>
      <div className="mt-4"><ResellerInquiriesPanel onNewCount={setNewCount} /></div>
    </details>
  )
}
