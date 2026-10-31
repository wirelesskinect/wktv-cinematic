'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { siteConfig } from '@/config/site'
import { getPlan, connectionUpgrades, paymentNoteCode, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/plans'
import ConnectionWarning from '@/components/ConnectionWarning'
import TrialIntake from '@/components/TrialIntake'
import BoxPlanPicker from '@/components/BoxPlanPicker'
import { US_STATES } from '@/lib/shipping'
import { USERNAME_RULE, PASSWORD_RULE, normalizeUsername, usernameError, passwordError } from '@/lib/iptv-login'


function PaymentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const plan = getPlan(searchParams.get('plan'))
  const planId = plan?.id
  
  const [cashAppName, setCashAppName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  // Already confirmed on the signup page? Then don't ask again.
  const alreadyConfirmed = searchParams.get('confirmed') === '1'
  const [showWarning, setShowWarning] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cashapp')
  const copyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500) }).catch(() => {})
  }
  // New customers (no TV line yet) choose the login they'll type into the IPTV app
  const [needsLogin, setNeedsLogin] = useState(false)
  const [iptvUsername, setIptvUsername] = useState('')
  const [iptvPassword, setIptvPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [trialOpen, setTrialOpen] = useState(false)
  // Box bundles: where to ship the box
  const [ship, setShip] = useState({ name: '', street: '', unit: '', city: '', state: '', zip: '' })
  const setShipField = (field: keyof typeof ship) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setShip((s) => ({ ...s, [field]: e.target.value }))

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    // No (or unknown) plan in the link -> send them to their account to pick one
    if (!plan) {
      router.replace('/dashboard')
      return
    }
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (!data.user) {
        router.push(`/signup?plan=${planId}`)
        return
      }
      setUser(data.user)
      let sub: any = null
      try {
        sub = await (await fetch('/api/subscription', { cache: 'no-store' })).json()
      } catch {}
      // No line on file yet -> they pick their TV app username and password here
      setNeedsLogin(!sub?.username)
      if (plan.price === 0 && !sub?.username) setTrialOpen(true)
      // First-time customers (no plan on file yet) get the add-connections warning
      // before they see payment instructions, since connections can't be added later.
      if (!alreadyConfirmed && connectionUpgrades(plan).length > 0) {
        if (!sub || sub.status === 'unlinked' || sub.status === 'pending') setShowWarning(true)
      }
    } catch {
      router.push(`/signup?plan=${planId}`)
    } finally {
      setCheckingAuth(false)
    }
  }

  async function submitRequest(body: Record<string, unknown>) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payment/cashapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Returns the login fields to send, or null (and shows an error) if they're not valid
  function loginFields(): Record<string, string> | null {
    if (!needsLogin) return {}
    const uname = normalizeUsername(iptvUsername)
    const problem = usernameError(uname) || passwordError(iptvPassword.trim(), uname)
    if (problem) {
      setError(problem)
      return null
    }
    return { iptvUsername: uname, iptvPassword: iptvPassword.trim() }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!plan) return
    const login = loginFields()
    if (!login) return
    if (plan.ships) {
      if (!ship.name.trim() || !ship.street.trim() || !ship.city.trim() || !ship.state) {
        setError('Please fill in your shipping address so we can send your box.')
        return
      }
      if (!/^\d{5}(-\d{4})?$/.test(ship.zip.trim())) {
        setError('Please enter a valid 5-digit ZIP code.')
        return
      }
    }
    if (!cashAppName.trim()) {
      setError(`Please enter the name you paid from on ${PAYMENT_METHOD_LABELS[payMethod]}`)
      return
    }

    // Only the plan, login choice, shipping address and Cash App name are sent; the server sets the price
    await submitRequest({
      planId: plan.id,
      paymentMethod: payMethod,
      cashAppName: cashAppName.trim(),
      ...login,
      ...(plan.ships ? { shipping: ship } : {}),
    })
  }

  async function handleTrial(e: React.FormEvent) {
    e.preventDefault()
    if (!plan) return
    const login = loginFields()
    if (!login) return
    await submitRequest({ planId: plan.id, ...login })
  }

  const loginBlock = needsLogin ? (
    <div className="mb-6">
      <p className="field-label">Your TV app login</p>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: 12 }}>
        Pick the username and password you’ll type into the WKTV / IPTV app. They’ll work as soon as we activate your plan.
      </p>
      <label htmlFor="iptv-username" className="field-label" style={{ fontSize: 13 }}>Username</label>
      <input id="iptv-username" type="text" value={iptvUsername} autoComplete="off" autoCapitalize="none" spellCheck={false}
        onChange={(e) => setIptvUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
        placeholder="e.g. tony24" maxLength={16} required />
      <p className="field-hint">{USERNAME_RULE}.</p>
      <label htmlFor="iptv-password" className="field-label mt-4" style={{ fontSize: 13 }}>Password</label>
      <div className="flex gap-2">
        <input id="iptv-password" type={showPassword ? 'text' : 'password'} value={iptvPassword} autoComplete="new-password"
          onChange={(e) => setIptvPassword(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
          placeholder="Easy to type on a TV remote" maxLength={20} required />
        <button type="button" className="btn-secondary" style={{ minHeight: 40, padding: '8px 14px', fontSize: 13 }}
          onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Hide' : 'Show'}</button>
      </div>
      <p className="field-hint">{PASSWORD_RULE}. Don’t reuse your email password. You can always see it on your account page.</p>
    </div>
  ) : null

  const shippingBlock = plan?.ships ? (
    <div className="mb-6">
      <p className="field-label">Where should we ship your box?</p>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: 12 }}>
        Your {plan.device} box arrives with WKTV already installed. US addresses only.
      </p>
      <label htmlFor="ship-name" className="field-label" style={{ fontSize: 13 }}>Full name</label>
      <input id="ship-name" type="text" value={ship.name} onChange={setShipField('name')} autoComplete="shipping name" maxLength={80} required />
      <label htmlFor="ship-street" className="field-label mt-4" style={{ fontSize: 13 }}>Street address</label>
      <input id="ship-street" type="text" value={ship.street} onChange={setShipField('street')} autoComplete="shipping address-line1" maxLength={120} placeholder="123 Main St" required />
      <label htmlFor="ship-unit" className="field-label mt-4" style={{ fontSize: 13 }}>Apt, suite, unit <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span></label>
      <input id="ship-unit" type="text" value={ship.unit} onChange={setShipField('unit')} autoComplete="shipping address-line2" maxLength={40} />
      <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1.2fr)' }}>
        <div>
          <label htmlFor="ship-city" className="field-label" style={{ fontSize: 13 }}>City</label>
          <input id="ship-city" type="text" value={ship.city} onChange={setShipField('city')} autoComplete="shipping address-level2" maxLength={60} required />
        </div>
        <div>
          <label htmlFor="ship-state" className="field-label" style={{ fontSize: 13 }}>State</label>
          <select id="ship-state" value={ship.state} onChange={setShipField('state')} autoComplete="shipping address-level1" required>
            <option value="">—</option>
            {US_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ship-zip" className="field-label" style={{ fontSize: 13 }}>ZIP</label>
          <input id="ship-zip" type="text" inputMode="numeric" value={ship.zip} onChange={setShipField('zip')} autoComplete="shipping postal-code" maxLength={10} required />
        </div>
      </div>
    </div>
  ) : null

  if (checkingAuth || !plan) {
    return (
      <div className="flex items-center justify-center py-32"><div className="spinner" /></div>
    )
  }

  const cashTag = siteConfig.cashAppTag
  const cashLink = `https://cash.app/${cashTag}/${plan.price}`
  const noteCode = paymentNoteCode(plan)
  const venmoUser = siteConfig.venmoHandle.replace(/^@/, '')
  const venmoLink = `https://venmo.com/?txn=pay&recipients=${encodeURIComponent(venmoUser)}&amount=${plan.price}&note=${encodeURIComponent(noteCode)}`
  const methodStyle: Record<PaymentMethod, { color: string; bg: string; border: string }> = {
    cashapp: { color: '#4ade80', bg: 'linear-gradient(140deg, rgba(0,214,50,.12), rgba(0,0,0,.25))', border: 'rgba(0,214,50,.35)' },
    zelle: { color: '#c4b5fd', bg: 'linear-gradient(140deg, rgba(109,30,212,.16), rgba(0,0,0,.25))', border: 'rgba(139,92,246,.45)' },
    venmo: { color: '#7dd3fc', bg: 'linear-gradient(140deg, rgba(0,140,255,.14), rgba(0,0,0,.25))', border: 'rgba(56,189,248,.45)' },
  }
  const ms = methodStyle[payMethod]
  const payTo = payMethod === 'cashapp' ? cashTag : payMethod === 'zelle' ? siteConfig.zellePhone : siteConfig.venmoHandle

  if (success) {
    return (
      <div className="portal-narrow animate-in text-center">
        <div className="card">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ background: 'rgba(34,197,94,.14)', border: '1px solid rgba(34,197,94,.4)' }}>✓</div>
          <span className="eyebrow">{plan.price === 0 ? 'Trial requested' : 'Payment submitted'}</span>
          <h1 className="page-title">{plan.price === 0 ? 'You’re on the list!' : 'Thanks! We got it.'}</h1>
          <p className="page-sub mb-6">
            {plan.price === 0
              ? 'We’ll activate your free trial shortly. Your account page will show it as active once it’s ready.'
              : plan.ships
                ? `We’ll verify your payment, set up your ${plan.device} box with WKTV and ship it to you. Your login will be on your account page once your plan is active.`
                : 'We’ll verify your payment and activate your plan within a few hours. Your account page will show it as active once it’s ready.'}
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/dashboard" className="btn-primary w-full">Go to my account →</Link>
            <a href="/support.html#connect" className="btn-secondary w-full">Get your device ready</a>
          </div>
        </div>
      </div>
    )
  }

  if (plan.price === 0) {
    // Free trial - no payment needed, just request it
    return (
      <div className="portal-narrow animate-in">
        <div className="text-center mb-7">
          <span className="eyebrow">Free 24-hour trial</span>
          <h1 className="page-title">Try WKTV free</h1>
          <p className="page-sub">No payment and no card needed. One trial per account.</p>
        </div>
        <div className="card">
          <ul className="space-y-3 mb-6 text-sm text-gray-200">
            <li>✓&nbsp; 24 hours of live TV, sports, movies &amp; series</li>
            <li>✓&nbsp; Trial includes 2 connections</li>
            <li>✓&nbsp; Choose a plan anytime from your account</li>
          </ul>
          {needsLogin ? (
            <>
              <p className="text-sm text-muted mb-4">Two quick steps: tell us your device, then create the username and password for your TV app.</p>
              <button type="button" onClick={() => { setError(''); setTrialOpen(true) }} className="btn-primary w-full">
                Start my free trial →
              </button>
            </>
          ) : (
            <form onSubmit={handleTrial}>
              {error && <div className="alert alert-error mb-4">{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Requesting…' : 'Request my free trial →'}
              </button>
            </form>
          )}
          <p className="text-center text-sm text-muted mt-5">
            Rather pick a plan? <Link href="/renew" className="link">See all plans</Link>
          </p>
        </div>
        <TrialIntake
          open={trialOpen}
          busy={loading}
          error={error}
          onClose={() => setTrialOpen(false)}
          onSubmit={(data) => submitRequest({ planId: plan.id, ...data })}
        />
      </div>
    )
  }

  return (
    <div className="portal-medium animate-in">
      <div className="text-center mb-7">
        <span className="eyebrow">Checkout</span>
        <h1 className="page-title">Complete your payment</h1>
        <p className="page-sub">Pay with Cash App, Zelle or Venmo, then confirm below.</p>
      </div>

      <div className="card">
        {/* Order summary */}
        <div className="tile mb-6" style={{ padding: 22 }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted mb-1">Your plan</p>
              <p className="text-lg font-bold">{plan.name}</p>
              <p className="text-sm text-muted">{plan.connections} connection{plan.connections > 1 ? 's' : ''} · {plan.duration}{plan.ships ? ' of service' : ''}</p>
              {plan.ships && <p className="text-sm text-muted">📦 {plan.device} box · WKTV pre-installed · shipped to you</p>}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted mb-1">Total</p>
              <p className="text-3xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>${plan.price}</p>
            </div>
          </div>
          {plan.kind === 'bundle' && plan.setupFee !== undefined && (
            <BoxPlanPicker plan={plan} onChange={(id) => router.replace(`/pay?plan=${id}&confirmed=1`)} />
          )}
          <div className="mt-3 text-sm">
            <Link href="/renew" className="link">Change plan</Link>
          </div>
        </div>

        {/* Step 1: choose how to pay, then send */}
        <div className="mb-6">
          <p className="field-label"><span className="text-red">01</span>&nbsp; Choose how you’ll pay</p>
          <div className="grid grid-cols-3 gap-2 mb-4" role="tablist" aria-label="Payment method">
            {(['cashapp', 'zelle', 'venmo'] as PaymentMethod[]).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={payMethod === m}
                onClick={() => setPayMethod(m)}
                className={`tile text-center font-bold ${payMethod === m ? 'is-active' : ''}`}
                style={{ padding: '10px 8px', borderColor: payMethod === m ? methodStyle[m].border : undefined, color: payMethod === m ? methodStyle[m].color : undefined }}>
                {PAYMENT_METHOD_LABELS[m]}
              </button>
            ))}
          </div>

          <p className="field-label"><span className="text-red">02</span>&nbsp; Send ${plan.price} with {PAYMENT_METHOD_LABELS[payMethod]}</p>
          <div className="rounded-2xl p-5" style={{ background: ms.bg, border: `1px solid ${ms.border}` }}>
            <p className="text-xs uppercase tracking-widest text-muted mb-1">{payMethod === 'zelle' ? 'Zelle to this phone number' : 'Send to'}</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-3xl font-extrabold break-all" style={{ fontFamily: 'var(--font-display)', color: ms.color }}>{payTo}</span>
              <button type="button" className="btn-secondary" style={{ minHeight: 40, padding: '8px 14px', fontSize: 13 }}
                onClick={() => copyText(payMethod === 'zelle' ? payTo.replace(/\D/g, '') : payTo, 'to')}>
                {copied === 'to' ? 'Copied ✓' : 'Copy'}
              </button>
            </div>

            {/* Payment note code */}
            <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(0,0,0,.35)', border: '1px dashed rgba(255,255,255,.25)' }}>
              <p className="text-xs uppercase tracking-widest text-muted mb-1">In the payment note, type only</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-3xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>{noteCode}</span>
                <button type="button" className="btn-secondary" style={{ minHeight: 40, padding: '8px 14px', fontSize: 13 }}
                  onClick={() => copyText(noteCode, 'note')}>
                  {copied === 'note' ? 'Copied ✓' : 'Copy note'}
                </button>
              </div>
              <p className="text-xs text-muted mt-2">
                Disclaimer: put <b>only {noteCode}</b> in the note. Please don’t write anything else, like the plan or service name.
                {' '}
                {plan.kind === 'bundle'
                  ? '(Box codes: PLUS or PRO = which box, then M = monthly, A + connections for annual, or L + connections for lifetime. Example: PROA2 = ONN 4K Pro, annual, 2 connections.)'
                  : '(Codes: A = annual, M = 1 month, L = lifetime; the number is how many connections. Example: A2 = annual, 2 connections.)'}
              </p>
            </div>

            {payMethod === 'cashapp' && (
              <>
                <a href={cashLink} target="_blank" rel="noopener noreferrer" className="btn-primary w-full mt-4" style={{ background: 'linear-gradient(135deg,#00d632,#00a827)', boxShadow: '0 10px 30px rgba(0,214,50,.2)' }}>
                  Open Cash App · ${plan.price} ↗
                </a>
                <p className="text-xs text-muted mt-3">On a computer? Open Cash App on your phone → Pay → {cashTag} → ${plan.price} → add note {noteCode}.</p>
              </>
            )}
            {payMethod === 'zelle' && (
              <p className="text-sm text-muted mt-4">Open your bank’s app → Zelle → Send → enter <b>{siteConfig.zellePhone}</b> → ${plan.price} → memo <b>{noteCode}</b>.</p>
            )}
            {payMethod === 'venmo' && (
              <>
                <a href={venmoLink} target="_blank" rel="noopener noreferrer" className="btn-primary w-full mt-4" style={{ background: 'linear-gradient(135deg,#3d95ce,#008cff)', boxShadow: '0 10px 30px rgba(0,140,255,.2)' }}>
                  Open Venmo · ${plan.price} ↗
                </a>
                <p className="text-xs text-muted mt-3">On a computer? Open Venmo on your phone → Pay → {siteConfig.venmoHandle} → ${plan.price} → note {noteCode}.</p>
              </>
            )}
          </div>
        </div>

        {/* Step 2: Confirm */}
        <form onSubmit={handleSubmit}>
          {shippingBlock}
          {loginBlock}
          <label htmlFor="cashapp" className="field-label"><span className="text-red">03</span>&nbsp; {payMethod === 'cashapp' ? 'Your Cash App name or $Cashtag' : payMethod === 'zelle' ? 'Name on your Zelle account' : 'Your Venmo name or @username'}</label>
          <input id="cashapp" type="text" value={cashAppName} onChange={(e) => setCashAppName(e.target.value)}
            placeholder={payMethod === 'cashapp' ? '$yourcashtag or display name' : payMethod === 'zelle' ? 'First and last name' : '@yourvenmo or display name'} maxLength={60} required />
          <p className="field-hint">So we can match your payment.</p>
          {error && <div className="alert alert-error mt-4">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary w-full mt-5">
            {loading ? 'Submitting…' : `I sent $${plan.price} →`}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-muted mt-5">
        Questions about paying? <Link href="/support?topic=billing" className="link">Contact support</Link>
      </p>

      <ConnectionWarning
        plan={plan}
        open={showWarning}
        onClose={() => setShowWarning(false)}
        onChoose={(chosen) => {
          setShowWarning(false)
          if (chosen.id !== plan.id) router.replace(`/pay?plan=${chosen.id}&confirmed=1`)
        }}
      />
    </div>
  )
}

function PaymentLoading() {
  return <div className="flex items-center justify-center py-32"><div className="spinner" /></div>
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentLoading />}>
      <PaymentContent />
    </Suspense>
  )
}
