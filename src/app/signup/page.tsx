'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getPlan, connectionUpgrades, SIGNUP_PLAN_OPTIONS, type Plan } from '@/lib/plans'
import ConnectionWarning from '@/components/ConnectionWarning'

function planLabel(p: Plan) {
  if (p.kind === 'trial') return `${p.name} — ${p.price === 0 ? 'FREE' : `$${p.price}`}`
  if (p.kind === 'monthly') return `Monthly · 1 connection — $${p.price}/month`
  if (p.kind === 'annual') return `Annual · ${p.connections} connection${p.connections > 1 ? 's' : ''} — $${p.price}/year${p.badge ? ` (${p.badge})` : ''}`
  if (p.kind === 'bundle') return p.setupFee !== undefined
    ? `${p.device} box ($${p.setupFee} setup) + ${p.months === 1200 ? `Lifetime · ${p.connections} connection${p.connections > 1 ? 's' : ''} ($${p.discount} off)` : p.months === 12 ? `Annual · ${p.connections} connection${p.connections > 1 ? 's' : ''}` : 'Monthly'} — $${p.price} today`
    : `${p.name} — $${p.price}`
  return `Lifetime · ${p.connections} connection${p.connections > 1 ? 's' : ''} — $${p.price} one-time`
}

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Start with the plan picked on the homepage (if any); the customer can change it here
  const [planId, setPlanId] = useState<string>(getPlan(searchParams.get('plan'))?.id || '')
  const plan = getPlan(planId)
  const [showWarning, setShowWarning] = useState(false)

  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Already signed in? Skip signup and go to checkout or the account page.
  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      if (d.user) router.replace(plan ? `/pay?plan=${plan.id}` : '/dashboard')
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // Last chance to add connections: they can only be chosen at first signup
    if (plan && connectionUpgrades(plan).length > 0) {
      setShowWarning(true)
      return
    }
    await createAccount(plan)
  }

  const createAccount = async (finalPlan: Plan | null) => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Signup failed')
        setLoading(false)
        return
      }
      // Plan chosen -> straight to checkout (warning already shown). No plan -> account page.
      router.push(finalPlan ? `/pay?plan=${finalPlan.id}&confirmed=1` : '/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const groups: { label: string; kind: Plan['kind'] }[] = [
    { label: 'Try it first', kind: 'trial' },
    { label: 'Monthly', kind: 'monthly' },
    { label: 'Annual', kind: 'annual' },
    { label: 'Lifetime (one-time payment)', kind: 'lifetime' },
    { label: 'Streaming box + plan (annual options at checkout)', kind: 'bundle' },
  ]

  return (
    <div className="portal-narrow animate-in">
      <div className="text-center mb-7">
        <span className="eyebrow">Create your account</span>
        <h1 className="page-title">Start watching WKTV</h1>
        <p className="page-sub">{plan ? 'Create your account, then complete your order.' : 'One account for your plan, renewals, and support.'}</p>
      </div>

      <div className="card">
        <form onSubmit={handleSignup} className="space-y-5">
          {error && <div className="alert alert-error">{error}</div>}

          <div>
            <label htmlFor="plan-select" className="field-label">Choose your plan</label>
            <select id="plan-select" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Create my account now, pick a plan later</option>
              {groups.map((g) => (
                <optgroup key={g.kind} label={g.label}>
                  {SIGNUP_PLAN_OPTIONS.filter((p) => p.kind === g.kind && (p.kind !== 'bundle' || p.months === 1 || p.id === planId)).map((p) => (
                    <option key={p.id} value={p.id}>{planLabel(p)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {plan && (
              <div className="mt-3 flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(238,48,47,.08)', border: '1px solid rgba(238,48,47,.3)' }}>
                <span className="text-sm text-gray-200">{plan.name}</span>
                <span className="font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>{plan.price === 0 ? 'FREE' : `$${plan.price}`}</span>
              </div>
            )}
            {plan && connectionUpgrades(plan).length > 0 && (
              <p className="field-hint" style={{ color: '#fcd34d' }}>⚠ Extra connections can only be added at sign-up, not later.</p>
            )}
          </div>

          <div className="divider" />

          <div>
            <label htmlFor="name" className="field-label">Full name</label>
            <input id="name" type="text" autoComplete="name" value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="John Smith" required />
          </div>

          <div>
            <label htmlFor="phone" className="field-label">Phone number <span className="text-muted font-normal">(optional)</span></label>
            <input id="phone" type="tel" autoComplete="tel" value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(555) 123-4567" />
            <p className="field-hint">Helps us recover your account if you get locked out.</p>
          </div>

          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input id="email" type="email" autoComplete="email" value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="you@example.com" required />
          </div>

          <div>
            <label htmlFor="password" className="field-label">Password</label>
            <input id="password" type="password" autoComplete="new-password" value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="At least 8 characters" minLength={8} required />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account…' : plan ? (plan.price === 0 ? 'Create account & start trial →' : 'Create account & continue →') : 'Create account →'}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Already have an account?{' '}
          <Link href={plan ? `/login?plan=${plan.id}` : '/login'} className="link">Sign in</Link>
        </p>
      </div>

      <p className="text-center text-xs text-muted mt-5">🔒 Your password is stored securely. We never share your information.</p>

      {plan && (
        <ConnectionWarning
          plan={plan}
          open={showWarning}
          busy={loading}
          onClose={() => setShowWarning(false)}
          onChoose={(chosen) => {
            setPlanId(chosen.id)
            setShowWarning(false)
            createAccount(chosen)
          }}
        />
      )}
    </div>
  )
}

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-32"><div className="spinner" /></div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SignupContent />
    </Suspense>
  )
}
