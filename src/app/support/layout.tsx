import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Support | WKTV',
  description: 'Send WKTV Support a message about setup, login, billing, or your plan.',
  alternates: { canonical: '/support' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
