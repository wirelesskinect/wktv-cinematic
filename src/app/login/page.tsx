'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getPlan } from '@/lib/plans'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [planId, setPlanId] = useState<string | null>(null)

  // If they came from a plan on the homepage, keep that plan through login
  useEffect(() => {
    const plan = getPlan(new URLSearchParams(window.location.search).get('plan'))
    setPlanId(plan ? plan.id : null)
    // Already signed in? Skip the form.
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      if (d.user) router.replace(plan ? `/pay?plan=${plan.id}` : '/dashboard')
    }).catch(() => {})
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }
      router.push(planId ? `/pay?plan=${planId}` : '/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const plan = getPlan(planId)

  return (
    <div className="portal-narrow animate-in">
      <div className="text-center mb-7">
        <span className="eyebrow">Member login</span>
        <h1 className="page-title">Welcome back</h1>
        <p className="page-sub">{plan ? `Sign in to continue with ${plan.name}.` : 'Sign in to manage your WKTV plan.'}</p>
      </div>

      <div className="card">
        <form onSubmit={handleLogin} className="space-y-5">
          {error && <div className="alert alert-error">{error}</div>}

          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input id="email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>

          <div>
            <label htmlFor="password" className="field-label">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required />
            <p className="field-hint">
              Forgot your password? <Link href="/support?topic=account" className="link">Contact support</Link> and we&apos;ll reset it.
            </p>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          New to WKTV?{' '}
          <Link href={planId ? `/signup?plan=${planId}` : '/signup'} className="link">Create an account</Link>
        </p>
      </div>

      <p className="text-center text-xs text-muted mt-5">
        Your WKTV website login is different from the IPTV username and password you use in the app.
      </p>
    </div>
  )
}
