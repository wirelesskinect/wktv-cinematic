import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'

export const metadata: Metadata = {
  title: 'WKTV — Your screen. Your way.',
  description: 'Live sports, TV, and movies. Stream anywhere in the USA on any device. Start with a free 24-hour trial.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  // Link previews in texts, Facebook, etc.
  metadataBase: new URL('https://www.wktv.live'),
  openGraph: {
    type: 'website',
    siteName: 'WKTV',
    title: 'WKTV — Your screen. Your way.',
    description: 'Live sports, TV, and movies. Stream anywhere in the USA on any device. Start with a free 24-hour trial.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'WKTV — Watch Anywhere', type: 'image/jpeg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WKTV — Your screen. Your way.',
    description: 'Live sports, TV, and movies. Stream anywhere in the USA on any device. Start with a free 24-hour trial.',
    images: ['/og-image.jpg'],
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0c',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <SiteHeader />
          <main style={{ flex: 1 }}>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  )
}
