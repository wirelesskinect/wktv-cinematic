'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { referralLink } from '@/lib/referral'

interface User {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: string
}

interface SubscriptionData {
  status: 'active' | 'expired' | 'pending' | 'unlinked'
  username?: string
  password?: string | null
  expiryDate?: string
  daysRemaining?: number | null
  planName?: string
  pendingRequest?: { planName: string; amount: number; method: string; requestedAt: string; username?: string | null } | null
}

const FB_GROUP = 'https://www.facebook.com/groups/wktvsupport'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<'user' | 'pass' | 'ref' | null>(null)
  const [showPass, setShowPass] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUser, setLinkUser] = useState('')
  const [linkPass, setLinkPass] = useState('')
  const [linkError, setLinkError] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)

  async function connectExisting(e: React.FormEvent) {
    e.preventDefault()
    setLinkBusy(true)
    setLinkError('')
    try {
      const res = await fetch('/api/account/link-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iptvUsername: linkUser, iptvPassword: linkPass }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLinkError(data.error || 'Something went wrong. Please try again.')
      } else {
        const sub = await (await fetch('/api/subscription', { cache: 'no-store' })).json()
        setSubscription(sub?.status ? sub : { status: 'unlinked' })
      }
    } catch {
      setLinkError('Something went wrong. Please try again.')
    } finally {
      setLinkBusy(false)
    }
  }
  const copy = (text: string, which: 'user' | 'pass' | 'ref') => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(which); setTimeout(() => setCopied(null), 1500) }).catch(() => {})
  }

  useEffect(() => {
    (async () => {
      try {
        const me = await (await fetch('/api/auth/me', { cache: 'no-store' })).json()
        if (!me.user) {
          router.push('/login')
          return
        }
        setUser(me.user)
        try {
          const sub = await (await fetch('/api/subscription', { cache: 'no-store' })).json()
          setSubscription(sub?.status ? sub : { status: 'unlinked' })
        } catch {
          setSubscription({ status: 'unlinked' })
        }
      } catch {
        router.push('/login')
        return
      }
      setLoading(false)
    })()
  }, [router])

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="spinner" /></div>
  }

  const firstName = (user?.name || user?.email?.split('@')[0] || 'there').split(' ')[0]
  const status = subscription?.status || 'unlinked'
  const hasPlan = status === 'active' || status === 'expired'
  const lowDays = typeof subscription?.daysRemaining === 'number' && subscription.daysRemaining < 7

  return (
    <div className="portal-main animate-in" style={{ maxWidth: 980 }}>
      <div className="mb-8">
        <span className="eyebrow">My account</span>
        <h1 className="page-title">Hi, {firstName}</h1>
        <p className="page-sub">{user?.email}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Plan status */}
        <div className={`card ${status === 'active' ? '' : 'card-red'}`}>
          {!hasPlan ? (
            <div>
              <span className={`pill ${status === 'pending' ? 'pill-yellow' : 'pill-gray'}`}>
                {status === 'pending' ? '● Awaiting confirmation' : '● No plan yet'}
              </span>
              <h2 className="text-2xl mt-4 mb-2">
                {status === 'pending' ? 'We’re setting things up' : 'Welcome to WKTV'}
              </h2>
              <p className="text-muted mb-6">
                {status === 'pending'
                  ? subscription?.pendingRequest
                    ? `We received your request for ${subscription.pendingRequest.planName}${subscription.pendingRequest.amount ? ` ($${subscription.pendingRequest.amount})` : ''}. We’ll activate it shortly. This page will update once it’s active.`
                    : 'Your account is being set up. We’ll activate it shortly.'
                  : 'Your account is ready. Pick a plan or start a free trial to begin streaming.'}
              </p>
              {status === 'pending' && subscription?.pendingRequest?.username && (
                <p className="text-sm mb-6">Your TV app username will be <b>{subscription.pendingRequest.username}</b>, with the password you chose. Your login details will show here once your plan is active.</p>
              )}
              {status === 'pending' ? (
                <a href="/support.html#connect" className="btn-secondary">Get your device ready while you wait</a>
              ) : (
                <div>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/renew" className="btn-primary">Choose a plan →</Link>
                    <Link href="/pay?plan=trial-free&confirmed=1" className="btn-secondary">Free 24-hour trial</Link>
                  </div>
                  <div className="tile mt-6">
                    {!linkOpen ? (
                      <button type="button" className="text-left w-full" onClick={() => setLinkOpen(true)}>
                        <p className="font-bold">Already a WKTV customer?</p>
                        <p className="text-sm text-muted">Connect the plan you already have to see your login and expiration date here. →</p>
                      </button>
                    ) : (
                      <form onSubmit={connectExisting}>
                        <p className="font-bold mb-1">Connect your existing plan</p>
                        <p className="text-sm text-muted mb-4">Enter the username and password you use in the WKTV / IPTV app.</p>
                        <label htmlFor="link-user" className="field-label" style={{ fontSize: 13 }}>TV app username</label>
                        <input id="link-user" type="text" value={linkUser} onChange={(e) => setLinkUser(e.target.value)} autoCapitalize="none" autoComplete="off" spellCheck={false} required maxLength={64} />
                        <label htmlFor="link-pass" className="field-label mt-3" style={{ fontSize: 13 }}>TV app password</label>
                        <input id="link-pass" type="password" value={linkPass} onChange={(e) => setLinkPass(e.target.value)} autoComplete="off" required maxLength={64} />
                        {linkError && <div className="alert alert-error mt-4">{linkError}</div>}
                        <button type="submit" disabled={linkBusy} className="btn-primary w-full mt-4">{linkBusy ? 'Checking…' : 'Connect my plan →'}</button>
                        <p className="text-sm text-muted mt-3">Don’t know your login? <Link href="/support?topic=account" className="link">Contact support</Link> and we’ll connect it for you.</p>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={`pill ${status === 'active' ? 'pill-green' : 'pill-red'}`}>
                  {status === 'active' ? '● Active' : '● Expired'}
                </span>
                {typeof subscription?.daysRemaining === 'number' && (
                  <span className="text-sm text-muted">
                    {subscription.daysRemaining > 0 ? `${subscription.daysRemaining} days remaining` : 'Renew to keep watching'}
                  </span>
                )}
              </div>
              <h2 className="text-2xl mt-4 mb-6">{subscription?.planName || 'WKTV plan'}</h2>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="tile">
                  <p className="text-xs uppercase tracking-widest text-muted mb-1">IPTV username</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold break-all">{subscription?.username || '—'}</p>
                    {subscription?.username && (
                      <button type="button" className="text-xs link" onClick={() => copy(subscription.username || '', 'user')}>
                        {copied === 'user' ? 'Copied ✓' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="tile">
                  <p className="text-xs uppercase tracking-widest text-muted mb-1">IPTV password</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold break-all">{subscription?.password ? (showPass ? subscription.password : '••••••••') : '—'}</p>
                    {subscription?.password && (
                      <span className="flex gap-3">
                        <button type="button" className="text-xs link" onClick={() => setShowPass((v) => !v)}>{showPass ? 'Hide' : 'Show'}</button>
                        <button type="button" className="text-xs link" onClick={() => copy(subscription.password || '', 'pass')}>
                          {copied === 'pass' ? 'Copied ✓' : 'Copy'}
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                <div className="tile">
                  <p className="text-xs uppercase tracking-widest text-muted mb-1">Expires</p>
                  <p className="text-lg font-bold">{subscription?.expiryDate || '—'}</p>
                </div>
              </div>

              <div className="mt-6">
                {subscription?.pendingRequest ? (
                  <div className="alert alert-warn">
                    Your request for <b>{subscription.pendingRequest.planName}</b> is waiting for confirmation. We’ll update your plan shortly.
                  </div>
                ) : (
                  <Link href="/renew" className={status !== 'active' || lowDays ? 'btn-primary' : 'btn-secondary'}>
                    {status !== 'active' || lowDays ? 'Renew now →' : 'Renew or upgrade'}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="grid gap-3 content-start">
          <a href="/support.html#connect" className="tile">
            <p className="font-bold">📺 How to connect</p>
            <p className="text-sm text-muted">Setup steps for ONN, Fire TV, Android, and Apple.</p>
          </a>
          <a href="/troubleshooting.html" className="tile">
            <p className="font-bold">🛠 Troubleshooting</p>
            <p className="text-sm text-muted">Quick fixes for login, channels, and buffering.</p>
          </a>
          <Link href="/support" className="tile">
            <p className="font-bold">💬 Contact support</p>
            <p className="text-sm text-muted">Send us a message. We’ll get back to you.</p>
          </Link>
          <a href={FB_GROUP} target="_blank" rel="noopener noreferrer" className="tile">
            <p className="font-bold">👥 Facebook support group ↗</p>
            <p className="text-sm text-muted">Tips, updates, and help from the community.</p>
          </a>
        </div>
      </div>

      {hasPlan && subscription?.username && (
        <div className="card mt-6">
          <span className="eyebrow">Refer a friend</span>
          <h2 className="text-2xl mt-2 mb-2">Give a free trial, get a free month</h2>
          <p className="text-muted mb-4">
            Send this link to a friend for a free 24-hour trial. If they buy a 1-year plan, we’ll add <b>1 free month</b> to your plan.
            Your friend can also type your username, <b style={{ overflowWrap: "anywhere" }}>{subscription.username}</b>, in the referral box when they start their trial.
          </p>
          <div className="tile flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold break-all" style={{ minWidth: 0, flex: '1 1 220px' }}>{referralLink(subscription.username)}</p>
            <button type="button" className="btn-secondary" onClick={() => copy(referralLink(subscription.username || ''), 'ref')}>
              {copied === 'ref' ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>
          <p className="text-sm text-muted mt-3">The username has to be spelled exactly right, capital letters included, for the referral to count.</p>
        </div>
      )}
    </div>
  )
}
