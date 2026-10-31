import { adminSupabase } from '@/lib/supabase-server'
import { getPlan, type Plan } from '@/lib/plans'

// Last year's annual prices were $25 lower than today's.
export const OLD_ANNUAL_DISCOUNT = 25
const DAY = 86_400_000

// Estimate the sale behind a plan the admin entered by hand for an existing customer.
//  - Annual: bought about one year before it expires. If that was more than 30 days ago,
//    it was last year's price (today's price minus $25). Otherwise today's price.
//  - Month plans: bought plan-length before expiry, today's price.
//  - Lifetime: today's price, dated today (purchase date unknown).
export function historicSale(plan: Plan, expiresAt: Date | null, now = new Date()) {
  let date = new Date(now)
  if (expiresAt && plan.kind === 'annual') {
    date = new Date(expiresAt)
    date.setFullYear(date.getFullYear() - 1)
  } else if (expiresAt && (plan.kind === 'monthly' || plan.kind === 'trial' || plan.kind === 'bundle')) {
    date = new Date(expiresAt)
    date.setMonth(date.getMonth() - (plan.months || 1))
  }
  if (date > now) date = new Date(now)

  let price = plan.price
  let discounted = false
  if (plan.kind === 'annual' && now.getTime() - date.getTime() > 30 * DAY) {
    price = Math.max(0, price - OLD_ANNUAL_DISCOUNT)
    discounted = true
  }
  return { amountCents: price * 100, date, discounted }
}

async function insertPayment(row: Record<string, unknown>) {
  const { error } = await adminSupabase.from('payments').insert(row)
  // Database not updated yet (no plan_id column): save without it
  if (error && /plan_id/.test(error.message || '')) {
    const { plan_id, ...rest } = row
    return (await adminSupabase.from('payments').insert(rest)).error
  }
  return error
}

// Record one historic sale for a customer whose existing line was entered by hand.
// Only once per customer, and never if they already have real payments on the site.
export async function recordHistoricSale(userId: string, planId: string | null | undefined, expiresAt: Date | null): Promise<boolean> {
  const plan = getPlan(planId)
  if (!plan || plan.kind === 'trial') return false
  const { data: existing } = await adminSupabase
    .from('payments')
    .select('id, payment_method')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .limit(50)
  if ((existing || []).length) return false

  const sale = historicSale(plan, expiresAt)
  const error = await insertPayment({
    user_id: userId,
    amount_cents: sale.amountCents,
    payment_method: 'backfill',
    payment_reference: `Historic: ${plan.name}${sale.discounted ? ` (last year’s price, −$${OLD_ANNUAL_DISCOUNT})` : ''}`,
    status: 'completed',
    created_at: sale.date.toISOString(),
    plan_id: plan.id,
  })
  if (error) console.error('historic sale insert failed:', error)
  return !error
}

export { insertPayment }
