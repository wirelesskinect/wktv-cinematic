'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { saveRefFromUrl } from '@/lib/referral'

const FB_GROUP = 'https://www.facebook.com/groups/wktvsupport'

// Header shown on every portal page. Same menu as the marketing pages so
// customers can move between them without noticing a switch.
export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<{ name: string | null; email: string; role: string } | null>(null)
  const [checked, setChecked] = useState(false)

  // Remember a referral link's ?ref= so it's filled in when the friend starts their trial
  useEffect(() => { saveRefFromUrl() }, [pathname])

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setUser(d.user || null); setChecked(true) } })
      .catch(() => { if (!cancelled) setChecked(true) })
    return () => { cancelled = true }
  }, [pathname])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <div className="site-offer">
        YOUR NEXT WATCH STARTS HERE.
        <Link href="/pay?plan=trial-free">Try WKTV free for 24 hours ↗</Link>
      </div>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="site-brand" aria-label="WKTV home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/wktv-logo.png" alt="WKTV Watch Anywhere" />
          </Link>
          <nav className="site-nav" aria-label="Main navigation">
            <a href="/#plans">Plans</a>
            <a href="/support.html#connect">How to connect</a>
            <a href="/troubleshooting.html">Troubleshooting</a>
            <a href="/support.html">Support</a>
          </nav>
          <div className="site-actions">
            {!checked ? null : user ? (
              <>
                {user.role === 'admin' && (
                  <Link href="/admin" className="btn-secondary">Admin</Link>
                )}
                <Link href="/dashboard" className="btn-primary">My Account</Link>
                <button onClick={logout} className="btn-ghost" type="button">Log out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-secondary">Member login</Link>
                <Link href="/signup" className="btn-primary">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <a href="/">Home</a>
        <a href="/#plans">Plans</a>
        <a href="/support.html#connect">How to connect</a>
        <a href="/troubleshooting.html">Troubleshooting</a>
        <Link href="/support">Contact support</Link>
        <a href={FB_GROUP} target="_blank" rel="noopener noreferrer">Facebook support group ↗</a>
        <span className="copy">© 2026 WKTV</span>
      </div>
    </footer>
  )
}
