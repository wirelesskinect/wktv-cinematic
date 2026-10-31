'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const FB_GROUP = 'https://www.facebook.com/groups/wktvsupport'

const TOPICS = [
  { id: 'technical', label: 'Setup or streaming problem' },
  { id: 'billing', label: 'Payment or plan question' },
  { id: 'account', label: 'Website login or password reset' },
  { id: 'account_link', label: 'Link my existing IPTV account' },
  { id: 'other', label: 'Something else' },
]

export default function SupportPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'technical', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill from the logged-in account and from ?topic= links
  useEffect(() => {
    const topic = new URLSearchParams(window.location.search).get('topic')
    if (topic && TOPICS.some((t) => t.id === topic)) setForm((f) => ({ ...f, subject: topic }))
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      if (d.user) setForm((f) => ({ ...f, name: f.name || d.user.name || '', email: f.email || d.user.email || '' }))
    }).catch(() => {})
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || data.error) setError(data.error || 'Could not send your message. Please try again.')
      else setSent(true)
    } catch {
      setError('Could not send your message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="portal-main animate-in" style={{ maxWidth: 1000 }}>
      <div className="mb-8">
        <span className="eyebrow">WKTV support</span>
        <h1 className="page-title">How can we help?</h1>
        <p className="page-sub">Most answers are one click away. Still stuck? Send us a message.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid gap-3 content-start">
          <a href="/support.html#connect" className="tile">
            <p className="font-bold">📺 How to connect</p>
            <p className="text-sm text-muted">Downloader codes and steps for every device.</p>
          </a>
          <a href="/troubleshooting.html#setup-help" className="tile">
            <p className="font-bold">🧰 Trouble setting up</p>
            <p className="text-sm text-muted">Internet provider blocks, modems, hotspot setup.</p>
          </a>
          <a href="/troubleshooting.html" className="tile">
            <p className="font-bold">🛠 Quick fixes</p>
            <p className="text-sm text-muted">Cloud error 451, no channels, TV guide, buffering.</p>
          </a>
          <a href={FB_GROUP} target="_blank" rel="noopener noreferrer" className="tile">
            <p className="font-bold">👥 Facebook support group ↗</p>
            <p className="text-sm text-muted">Fast answers from WKTV and the community.</p>
          </a>
        </div>

        <div className="card">
          {sent ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ background: 'rgba(34,197,94,.14)', border: '1px solid rgba(34,197,94,.4)' }}>✓</div>
              <h2 className="text-2xl mb-2">Message sent</h2>
              <p className="text-muted mb-6">Thanks, {form.name.split(' ')[0] || 'there'}. We&apos;ll reply to {form.email} as soon as we can.</p>
              <Link href="/dashboard" className="btn-secondary">Back to my account</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <h2 className="text-xl">Send us a message</h2>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="s-name" className="field-label">Name</label>
                  <input id="s-name" type="text" value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" required />
                </div>
                <div>
                  <label htmlFor="s-email" className="field-label">Email</label>
                  <input id="s-email" type="email" value={form.email} maxLength={200} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
                </div>
              </div>
              <div>
                <label htmlFor="s-topic" className="field-label">What do you need help with?</label>
                <select id="s-topic" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                  {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="s-msg" className="field-label">Message</label>
                <textarea id="s-msg" rows={6} value={form.message} maxLength={2000} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell us your device, any error message, and what you've tried." required />
                <p className="field-hint">Never include passwords in your message.</p>
              </div>
              <button type="submit" disabled={sending} className="btn-primary w-full">{sending ? 'Sending…' : 'Send message →'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
