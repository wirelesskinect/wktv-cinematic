import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Account | WKTV',
  description: 'Your WKTV account.',
  alternates: { canonical: '/dashboard' },
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
