'use client'

import { BOXES, LIFETIME_BOX_DISCOUNT, PLAN_LIST, boxPlan, getPlan, type Plan } from '@/lib/plans'

// Checkout picker for streaming box orders: box (setup fee) + rate plan (monthly, annual 1–5 or lifetime 1/5)
export default function BoxPlanPicker({ plan, onChange }: { plan: Plan; onChange: (planId: string) => void }) {
  const isAnnual = plan.months === 12
  const isLifetime = plan.months === 1200
  const monthly = getPlan('monthly-1')!
  const annuals = PLAN_LIST.filter((p) => p.kind === 'annual')
  const lifetimes = PLAN_LIST.filter((p) => p.kind === 'lifetime')
  const service = getPlan(plan.servicePlanId)
  const current = (): 'monthly' | number | { lifetime: number } =>
    isLifetime ? { lifetime: plan.connections } : isAnnual ? plan.connections : 'monthly'
  const pick = (boxKey: string | undefined, rate: 'monthly' | number | { lifetime: number }) => {
    const next = boxPlan(boxKey, rate)
    if (next && next.id !== plan.id) onChange(next.id)
  }
  const tile = (active: boolean): React.CSSProperties => ({
    padding: '12px 14px',
    borderColor: active ? '#e62932' : undefined,
    boxShadow: active ? '0 0 0 1px #e62932 inset' : undefined,
  })

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted mb-2">1 · Your box</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Box">
          {BOXES.map((b) => (
            <button key={b.key} type="button" role="radio" aria-checked={plan.boxKey === b.key}
              onClick={() => pick(b.key, current())}
              className={`tile text-left ${plan.boxKey === b.key ? 'is-active' : ''}`} style={tile(plan.boxKey === b.key)}>
              <span className="block font-bold text-white">{b.device}</span>
              <span className="block text-xs text-muted">${b.setupFee} one-time setup &amp; activation</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-muted mb-2">2 · Your rate plan</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Rate plan">
          <button type="button" role="radio" aria-checked={!isAnnual && !isLifetime} onClick={() => pick(plan.boxKey, 'monthly')}
            className={`tile text-left ${!isAnnual && !isLifetime ? 'is-active' : ''}`} style={tile(!isAnnual && !isLifetime)}>
            <span className="block font-bold text-white">Monthly</span>
            <span className="block text-xs text-muted">${monthly.price}/month · 1 connection</span>
          </button>
          <button type="button" role="radio" aria-checked={isAnnual} onClick={() => pick(plan.boxKey, isAnnual ? plan.connections : 1)}
            className={`tile text-left ${isAnnual ? 'is-active' : ''}`} style={tile(isAnnual)}>
            <span className="block font-bold text-white">Annual <span className="pill pill-green" style={{ fontSize: 10, padding: '2px 8px', marginLeft: 4 }}>Best value</span></span>
            <span className="block text-xs text-muted">from ${annuals[0].price}/year · 1–5 connections</span>
          </button>
          <button type="button" role="radio" aria-checked={isLifetime} onClick={() => pick(plan.boxKey, { lifetime: isLifetime ? plan.connections : 1 })}
            className={`tile text-left ${isLifetime ? 'is-active' : ''}`} style={tile(isLifetime)}>
            <span className="block font-bold text-white">Lifetime <span className="pill pill-green" style={{ fontSize: 10, padding: '2px 8px', marginLeft: 4 }}>${LIFETIME_BOX_DISCOUNT} off</span></span>
            <span className="block text-xs text-muted">one-time · 1 or 5 connections</span>
          </button>
        </div>
        {isLifetime && (
          <div className="mt-3">
            <label htmlFor="box-lifetime" className="field-label" style={{ fontSize: 13 }}>Screens at the same time</label>
            <select id="box-lifetime" value={plan.connections} onChange={(e) => pick(plan.boxKey, { lifetime: Number(e.target.value) })}>
              {lifetimes.map((l) => (
                <option key={l.id} value={l.connections}>
                  {l.connections} connection{l.connections > 1 ? 's' : ''} — ${l.price} one-time{l.badge ? ` (${l.badge})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {isAnnual && (
          <div className="mt-3">
            <label htmlFor="box-connections" className="field-label" style={{ fontSize: 13 }}>Screens at the same time</label>
            <select id="box-connections" value={plan.connections} onChange={(e) => pick(plan.boxKey, Number(e.target.value))}>
              {annuals.map((a) => (
                <option key={a.id} value={a.connections}>
                  {a.connections} connection{a.connections > 1 ? 's' : ''} — ${a.price}/year{a.badge ? ` (${a.badge})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-xl p-4" style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.12)' }}>
        <div className="flex justify-between text-sm"><span className="text-muted">{plan.device} setup &amp; activation (one-time)</span><span>${plan.setupFee}</span></div>
        <div className="flex justify-between text-sm mt-1"><span className="text-muted">{isLifetime ? `Lifetime · ${plan.connections} connection${plan.connections > 1 ? 's' : ''}` : isAnnual ? `Annual · ${plan.connections} connection${plan.connections > 1 ? 's' : ''}` : 'Monthly · 1 connection'}</span><span>${service?.price}</span></div>
        {plan.discount ? <div className="flex justify-between text-sm mt-1" style={{ color: '#4ade80' }}><span>Lifetime box discount</span><span>−${plan.discount}</span></div> : null}
        <div className="flex justify-between font-bold mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}><span>Due today</span><span>${plan.price}</span></div>
        <p className="text-xs text-muted mt-2">{isLifetime ? 'One-time payment. No renewals, no monthly bills.' : `Then $${service?.price}/${isAnnual ? 'year' : 'month'} when you renew. The setup fee is one time only.`}</p>
      </div>
    </div>
  )
}
