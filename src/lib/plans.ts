// Single source of truth for WKTV plans and prices.
// The server uses this list to decide what a customer is charged,
// so prices can't be changed from the browser.

export type PlanKind = 'trial' | 'monthly' | 'annual' | 'lifetime' | 'bundle'

// Streaming boxes: one-time setup & activation fee (box with WKTV pre-installed),
// plus a rate plan the customer picks: Monthly (1 connection), Annual (1–5 connections)
// or Lifetime (1 or 5 connections, $50 off the bundle).
export const BOXES = [
  { key: 'plus', device: 'ONN 4K Plus', setupFee: 100 },
  { key: 'pro', device: 'ONN 4K Pro', setupFee: 150 },
] as const
export type BoxKey = (typeof BOXES)[number]['key']

// Discount taken off a box bundle when the customer picks a lifetime plan
export const LIFETIME_BOX_DISCOUNT = 50

export interface Plan {
  id: string
  name: string
  price: number // whole US dollars
  connections: number
  duration: string
  kind: PlanKind
  badge?: string
  months?: number // length of service in months (used for bundles)
  device?: string // streaming box included with a bundle
  ships?: boolean // true = we ship a box, so checkout asks for a shipping address
  setupFee?: number // one-time box setup & activation fee included in price (bundles)
  servicePlanId?: string // the rate plan included with a box bundle (monthly-1, annual-N, lifetime-N)
  discount?: number // dollars taken off a box bundle (lifetime bundles)
  boxKey?: BoxKey
}

export const PLAN_LIST: Plan[] = [
  { id: 'trial-free', name: 'Free 24-Hour Trial', price: 0, connections: 2, duration: '24 hours', kind: 'trial' },
  { id: 'trial-1mo', name: '1-Month Trial', price: 20, connections: 1, duration: '1 month', kind: 'trial' },
  { id: 'monthly-1', name: 'Monthly', price: 30, connections: 1, duration: '1 month', kind: 'monthly' },
  { id: 'annual-1', name: '1 Connection Annual', price: 175, connections: 1, duration: '1 year', kind: 'annual' },
  { id: 'annual-2', name: '2 Connections Annual', price: 225, connections: 2, duration: '1 year', kind: 'annual' },
  { id: 'annual-3', name: '3 Connections Annual', price: 250, connections: 3, duration: '1 year', kind: 'annual' },
  { id: 'annual-4', name: '4 Connections Annual', price: 275, connections: 4, duration: '1 year', kind: 'annual' },
  { id: 'annual-5', name: '5 Connections Annual', price: 300, connections: 5, duration: '1 year', kind: 'annual', badge: 'Best Value' },
  { id: 'lifetime-1', name: 'Lifetime 1 Connection', price: 600, connections: 1, duration: 'lifetime', kind: 'lifetime' },
  { id: 'lifetime-5', name: 'Lifetime 5 Connections', price: 850, connections: 5, duration: 'lifetime', kind: 'lifetime', badge: 'Best Lifetime Value' },
]
PLAN_LIST.push(...boxBundles(PLAN_LIST))

// Box bundles = setup & activation fee + the chosen rate plan (lifetime: minus $50).
// IDs: box-plus-monthly, box-plus-annual-1 … box-plus-annual-5,
//      box-plus-lifetime-1, box-plus-lifetime-5 (same for pro)
function boxBundles(service: Plan[]): Plan[] {
  const ratePlans = service.filter((p) => p.id === 'monthly-1' || p.kind === 'annual' || p.kind === 'lifetime')
  const plans: Plan[] = []
  for (const box of BOXES) {
    for (const rate of ratePlans) {
      const monthly = rate.kind === 'monthly'
      const lifetime = rate.kind === 'lifetime'
      const conns = `${rate.connections} Connection${rate.connections > 1 ? 's' : ''}`
      const discount = lifetime ? LIFETIME_BOX_DISCOUNT : 0
      plans.push({
        id: `box-${box.key}-${monthly ? 'monthly' : `${rate.kind}-${rate.connections}`}`,
        name: `${box.device} Box + ${monthly ? 'Monthly' : `${lifetime ? 'Lifetime' : 'Annual'} · ${conns}`}`,
        price: box.setupFee + rate.price - discount,
        ...(discount ? { discount } : {}),
        connections: rate.connections,
        duration: rate.duration,
        kind: 'bundle',
        months: monthly ? 1 : lifetime ? 1200 : 12,
        device: box.device,
        ships: true,
        setupFee: box.setupFee,
        servicePlanId: rate.id,
        boxKey: box.key,
      })
    }
  }
  return plans
}

// Retired box offers (Oct 2026). Kept only so orders placed with them can still be approved.
const RETIRED_PLANS: Plan[] = (() => {
  const base: Record<string, number> = { 'plus-2mo': 165, 'plus-1yr': 250, 'pro-2mo': 200, 'pro-1yr': 285 }
  const extra = [0, 50, 75, 100, 125]
  const out: Plan[] = []
  for (const [key, price] of Object.entries(base)) {
    const [box, term] = key.split('-')
    const device = box === 'pro' ? 'ONN 4K Pro' : 'ONN 4K Plus'
    const months = term === '1yr' ? 12 : 2
    for (let c = 1; c <= 5; c++) {
      out.push({
        id: `box-${key}${c > 1 ? `-c${c}` : ''}`,
        name: `${device} Box + ${months === 12 ? '1 Year' : '2 Months'}${c > 1 ? ` · ${c} Connections` : ''}`,
        price: price + extra[c - 1], connections: c, duration: months === 12 ? '1 year' : '2 months',
        kind: 'bundle', months, device, ships: true,
      })
    }
  }
  return out
})()

// Short code customers type in the payment note (Cash App / Zelle / Venmo), so payments
// can be matched without naming the service: A = annual, M = 1 month, L = lifetime,
// followed by the number of connections. Example: A2 = annual, 2 connections.
// Box orders: PLUS or PRO + M (monthly), A + connections (annual) or L + connections (lifetime).
// Example: PROA2 = Pro box, annual, 2 connections. PLUSL5 = Plus box, lifetime, 5 connections.
export function paymentNoteCode(plan: Plan): string {
  if (plan.kind === 'bundle') return `${/pro/i.test(plan.device || '') ? 'PRO' : 'PLUS'}${plan.months === 1200 ? `L${plan.connections}` : plan.months === 12 ? `A${plan.connections}` : plan.months === 1 ? 'M' : `${plan.months}C${plan.connections}`}`
  const letter = plan.kind === 'annual' ? 'A' : plan.kind === 'lifetime' ? 'L' : 'M'
  return `${letter}${plan.connections}`
}

export const PAYMENT_METHODS = ['cashapp', 'zelle', 'venmo'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { cashapp: 'Cash App', zelle: 'Zelle', venmo: 'Venmo' }

export const PLANS: Record<string, Plan> = Object.fromEntries([...RETIRED_PLANS, ...PLAN_LIST].map((p) => [p.id, p]))

export function getPlan(id: unknown): Plan | null {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PLANS, id) ? PLANS[id] : null
}

// How many months of service a plan adds (lifetime = 1200)
export function planMonths(plan: Plan): number {
  if (plan.kind === 'lifetime') return 1200
  if (plan.months) return plan.months
  if (plan.kind === 'annual' || plan.duration === '1 year') return 12
  return 1
}

// Box bundles (box + service, shipped)
export const BUNDLE_PLANS: Plan[] = PLAN_LIST.filter((p) => p.kind === 'bundle')

// Box bundle for a box + rate plan ('monthly', annual connections 1–5, or { lifetime: 1 | 5 })
export function boxPlan(boxKey: string | undefined, rate: 'monthly' | number | { lifetime: number }): Plan | null {
  if (typeof rate === 'object') return getPlan(`box-${boxKey}-lifetime-${rate.lifetime}`)
  return getPlan(`box-${boxKey}-${rate === 'monthly' ? 'monthly' : `annual-${rate}`}`)
}

// Plans an existing customer can buy or renew from their account.
export const RENEWABLE_PLANS: Plan[] = PLAN_LIST.filter((p) => p.kind !== 'trial')

// Larger-connection versions of the same plan type. Extra connections can only be
// chosen when the customer first signs up, so we offer these before they finish.
export function connectionUpgrades(plan: Plan | null): Plan[] {
  if (!plan) return []
  if (plan.kind === 'annual') {
    return PLAN_LIST.filter((p) => p.kind === 'annual' && p.connections > plan.connections)
  }
  if (plan.kind === 'lifetime') {
    return PLAN_LIST.filter((p) => p.kind === 'lifetime' && p.connections > plan.connections)
  }
  return []
}

// Plans offered in the signup dropdown, in display order
export const SIGNUP_PLAN_OPTIONS: Plan[] = PLAN_LIST
