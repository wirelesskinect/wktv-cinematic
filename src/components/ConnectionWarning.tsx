'use client'

import { useEffect } from 'react'
import { connectionUpgrades, type Plan } from '@/lib/plans'

interface Props {
  plan: Plan
  open: boolean
  busy?: boolean
  // Called with the plan the customer settles on (the original or an upgrade)
  onChoose: (plan: Plan) => void
  onClose: () => void
}

// Warning shown right before a customer finishes signing up with fewer than the
// maximum connections. Extra connections can only be added at first signup.
export default function ConnectionWarning({ plan, open, busy, onChoose, onClose }: Props) {
  const upgrades = connectionUpgrades(plan)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open || upgrades.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6 overflow-y-auto"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="conn-warning-title"
      aria-describedby="conn-warning-body"
    >
      <div className="w-full max-w-md rounded-xl border-2 border-yellow-500 bg-zinc-950 shadow-2xl">
        <div className="flex items-center gap-3 rounded-t-lg bg-yellow-500 px-5 py-3 text-black">
          <span className="text-2xl leading-none" aria-hidden="true">⚠</span>
          <p className="font-extrabold tracking-wide uppercase text-sm">Warning: last chance to add connections</p>
        </div>

        <div className="p-6">
          <h2 id="conn-warning-title" className="text-xl font-bold mb-3">
            Are you sure you don&apos;t want to add another connection?
          </h2>
          <p id="conn-warning-body" className="text-gray-300 text-sm leading-relaxed mb-2">
            You picked <b className="text-white">{plan.name}</b> ({plan.connections} connection{plan.connections > 1 ? 's' : ''}, ${plan.price}).
          </p>
          <p className="text-yellow-300 text-sm leading-relaxed mb-5 font-semibold">
            Extra connections can only be added during your first sign-up. They can&apos;t be added to this plan later.
          </p>

          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Add connections now</p>
          <div className="space-y-2 mb-5">
            {upgrades.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => onChoose(p)}
                className="w-full flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-left hover:border-red-500 disabled:opacity-50"
              >
                <span>
                  <span className="block font-semibold text-white">
                    {p.connections} connections{p.badge ? <span className="ml-2 text-xs text-green-400">{p.badge}</span> : null}
                  </span>
                  <span className="block text-xs text-gray-400">{p.name}</span>
                </span>
                <span className="text-right">
                  <span className="block font-bold text-white">${p.price}</span>
                  <span className="block text-xs text-gray-400">+${p.price - plan.price}</span>
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose(plan)}
            className="w-full rounded-lg border border-zinc-600 px-4 py-3 text-sm font-semibold text-gray-200 hover:border-white disabled:opacity-50"
          >
            No thanks, keep {plan.connections} connection{plan.connections > 1 ? 's' : ''} (${plan.price})
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="w-full mt-2 text-xs text-gray-500 hover:text-gray-300 py-2"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}
