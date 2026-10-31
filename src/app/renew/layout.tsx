import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Renew or Upgrade | WKTV',
  description: 'Renew or upgrade your WKTV plan.',
  alternates: { canonical: '/renew' },
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
