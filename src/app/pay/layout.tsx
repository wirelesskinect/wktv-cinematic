import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Checkout | WKTV',
  description: 'Complete your WKTV order.',
  alternates: { canonical: '/pay' },
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
