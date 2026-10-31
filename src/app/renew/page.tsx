'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PLAN_LIST, connectionUpgrades, type Plan } from '@/lib/plans'
import ConnectionWarning from '@/components/ConnectionWarning'

interface Subscription {
  id: string
  iptv_username: string
  plan_name: string
  status: string
  expires_at: string | null
}

// Choose a plan (new customers) or renew / upgrade (existing customers).
// Picking a plan goes to the single checkout page at /pay.
export default function RenewPage() {
  const router = useRouter()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [warningPlan, setWarningPlan] = useState<Plan | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const me = await (await fetch('/api/auth/me')).json()
        if (!me.user) {
          router.push('/login')
          return
        }
        const sub = await (await fetch('/api/subscription')).json()
        if (sub?.subscription) setSubscription(sub.subscription)
      } catch {
        router.push('/login')
        return
      }
      setLoading(false)
    })()
  }, [router])

  const isExisting = !!subscription?.iptv_username

  function choose(plan: Plan) {
    // First-time customers: last chance to add connections
    if (!isExisting && connectionUpgrades(plan).length > 0) {
      setWarningPlan(plan)
      return
    }
    router.push(`/pay?plan=${plan.id}&confirmed=1`)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="spinner" /></div>
  }

  const daysUntilExpiry = subscription?.expires_at
    ? Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const sections: { title: string; note: string; plans: Plan[] }[] = [
    ...(!isExisting ? [{ title: 'Try it first', note: 'New customers', plans: PLAN_LIST.filter((p) => p.kind === 'trial') }] : []),
    { title: 'Monthly', note: 'No contract', plans: PLAN_LIST.filter((p) => p.kind === 'monthly') },
    { title: 'Annual', note: 'Best value per month', plans: PLAN_LIST.filter((p) => p.kind === 'annual') },
    { title: 'Lifetime', note: 'One-time payment', plans: PLAN_LIST.filter((p) => p.kind === 'lifetime') },
    { title: 'Streaming box', note: 'WKTV pre-installed · shipped', plans: PLAN_LIST.filter((p) => p.kind === 'bundle' && p.months === 1) },
  ]

  return (
    <div className="portal-main animate-in" style={{ maxWidth: 900 }}>
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-muted hover:text-white">← My account</Link>
        <div className="mt-4">
          <span className="eyebrow">{isExisting ? 'Renew or upgrade' : 'Choose a plan'}</span>
          <h1 className="page-title">{isExisting ? 'Keep the good stuff streaming' : 'Pick the plan that fits you'}</h1>
          <p className="page-sub">Pay with Cash App, Zelle or Venmo. We activate your plan once payment is confirmed.</p>
        </div>
      </div>

      {isExisting && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-4" style={{ padding: 22 }}>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Current IPTV username</p>
            <p className="text-lg font-bold">{subscription!.iptv_username}</p>
          </div>
          <span className={`pill ${daysUntilExpiry === null ? 'pill-gray' : daysUntilExpiry <= 0 ? 'pill-red' : daysUntilExpiry <= 7 ? 'pill-yellow' : 'pill-green'}`}>
            {daysUntilExpiry === null ? subscription!.status : daysUntilExpiry > 0 ? `Expires in ${daysUntilExpiry} days` : 'Expired'}
          </span>
        </div>
      )}

      {!isExisting && (
        <div className="alert alert-warn mb-6">
          ⚠ <b>Choose your connections carefully.</b> Extra connections can only be added when you first sign up. They can&apos;t be added to a plan later.
        </div>
      )}

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xl">{section.title}</h2>
              <span className="text-xs uppercase tracking-widest text-muted">{section.note}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.plans.map((plan) => (
                <button key={plan.id} type="button" onClick={() => choose(plan)} className="tile text-left w-full" style={{ padding: 20 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">
                        {plan.kind === 'trial' ? plan.name : plan.kind === 'bundle' ? `${plan.device} box` : `${plan.connections} connection${plan.connections > 1 ? 's' : ''}`}
                      </p>
                      <p className="text-sm text-muted">{plan.kind === 'trial' ? `${plan.connections} connection` : plan.kind === 'bundle' ? `$${plan.setupFee} setup + monthly · annual options at checkout` : plan.kind === 'lifetime' ? 'Lifetime access' : plan.kind === 'monthly' ? 'Billed monthly' : 'Billed yearly'}</p>
                    </div>
                    <p className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>
                      {plan.price === 0 ? 'Free' : `$${plan.price}`}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {plan.badge ? <span className="pill pill-green">{plan.badge}</span> : <span />}
                    <span className="text-sm font-semibold" style={{ color: '#ff7a7d' }}>Select →</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="text-center text-sm text-muted mt-10">
        Need more monthly connections or have a question? <Link href="/support?topic=billing" className="link">Contact support</Link>
      </p>

      {warningPlan && (
        <ConnectionWarning
          plan={warningPlan}
          open={!!warningPlan}
          onClose={() => setWarningPlan(null)}
          onChoose={(chosen) => {
            setWarningPlan(null)
            router.push(`/pay?plan=${chosen.id}&confirmed=1`)
          }}
        />
      )}
    </div>
  )
}
