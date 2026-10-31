'use client'

import { useEffect, useState } from 'react'
import { USERNAME_RULE, PASSWORD_RULE, normalizeUsername, usernameError, passwordError } from '@/lib/iptv-login'
import { TRIAL_DEVICES } from '@/lib/devices'
import { getSavedRef } from '@/lib/referral'

interface Props {
  open: boolean
  busy?: boolean
  error?: string
  onSubmit: (data: { device: string; iptvUsername: string; iptvPassword: string; referralUsername?: string }) => void
  onClose: () => void
}

// Two-step free-trial intake:
//   1) Which device will you watch on? (so customers know what equipment they need)
//   2) Choose the username + password for the TV app
// After the admin approves, the line is created on the IPTV panel with exactly this login.
export default function TrialIntake({ open, busy, error, onSubmit, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [device, setDevice] = useState('')
  const [noDevice, setNoDevice] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')
  const [referral, setReferral] = useState('')
  useEffect(() => { setReferral(getSavedRef()) }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const uname = normalizeUsername(username)
    const problem = usernameError(uname) || passwordError(password.trim(), uname)
    if (problem) {
      setLocalError(problem)
      return
    }
    setLocalError('')
    onSubmit({ device, iptvUsername: uname, iptvPassword: password.trim(), referralUsername: referral.trim() || undefined })
  }

  const shownError = localError || error

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-intake-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <span className="eyebrow">Free trial · step {step} of 2</span>
          <button type="button" onClick={onClose} disabled={busy} className="text-muted text-xl leading-none" aria-label="Close">×</button>
        </div>

        {step === 1 ? (
          <div className="p-6 pt-3">
            <h2 id="trial-intake-title" className="text-xl font-bold mb-2">What will you watch on?</h2>
            <p className="text-sm text-muted mb-4">WKTV works on these devices. Pick the one you’ll use for your trial.</p>
            <div className="grid gap-2">
              {TRIAL_DEVICES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { setDevice(d.label); setNoDevice(false) }}
                  className={`tile text-left ${device === d.label ? 'is-active' : ''}`}
                  style={{ padding: '12px 14px', borderColor: device === d.label ? 'var(--red, #ef4444)' : undefined }}
                  aria-pressed={device === d.label}
                >
                  <span className="font-bold">{d.label}</span>
                  <span className="block text-sm text-muted">{d.hint}</span>
                </button>
              ))}
              <button type="button" onClick={() => { setDevice(''); setNoDevice(true) }} className="text-sm link text-left mt-1">
                I don’t have any of these
              </button>
            </div>

            {noDevice && (
              <div className="alert alert-warn mt-4 text-sm">
                You’ll need one of these devices to watch WKTV. An <b>ONN 4K</b> box is the easiest place to start.{' '}
                <a href="/support.html#connect" className="link">See supported devices and setup</a>, or{' '}
                <a href="/support?topic=technical" className="link">ask us</a> which one to get.
              </div>
            )}

            <button type="button" disabled={!device} onClick={() => setStep(2)} className="btn-primary w-full mt-5">
              Next: create your login →
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 pt-3">
            <h2 id="trial-intake-title" className="text-xl font-bold mb-2">Create your TV app login</h2>
            <p className="text-sm text-muted mb-4">
              You’ll type these into the WKTV / IPTV app on your device. They start working as soon as we approve your trial.
            </p>

            <label htmlFor="trial-username" className="field-label" style={{ fontSize: 13 }}>Username</label>
            <input id="trial-username" type="text" value={username} autoComplete="off" autoCapitalize="none" spellCheck={false}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
              placeholder="e.g. tony24" maxLength={16} required autoFocus />
            <p className="field-hint">{USERNAME_RULE}. Must be unique.</p>

            <label htmlFor="trial-password" className="field-label mt-4" style={{ fontSize: 13 }}>Password</label>
            <div className="flex gap-2">
              <input id="trial-password" type={showPassword ? 'text' : 'password'} value={password} autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                placeholder="Easy to type on a TV remote" maxLength={20} required />
              <button type="button" className="btn-secondary" style={{ minHeight: 40, padding: '8px 14px', fontSize: 13 }}
                onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
            <p className="field-hint">{PASSWORD_RULE}. You can always see it on your account page.</p>

            <label htmlFor="trial-referral" className="field-label mt-4" style={{ fontSize: 13 }}>Referral username <span className="text-muted font-normal">(optional)</span></label>
            <input id="trial-referral" type="text" value={referral} onChange={(e) => setReferral(e.target.value)}
              autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={64}
              placeholder="Your friend’s WKTV username" />
            <p className="field-hint">Referred by a WKTV customer? Enter their username exactly as they spell it, capital letters included.</p>

            <p className="text-sm text-muted mt-4">Your trial includes 2 connections, so you can share it with a friend or family member.</p>

            {shownError && <div className="alert alert-error mt-4">{shownError}</div>}

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setStep(1)} disabled={busy} className="btn-secondary">← Back</button>
              <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Requesting…' : 'Request my free trial →'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
