import type { MetadataRoute } from 'next'

// Tells search engines what to crawl. Private/account pages and the API are excluded.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/dashboard', '/pay', '/renew'] }],
    sitemap: 'https://www.wktv.live/sitemap.xml',
    host: 'https://www.wktv.live',
  }
}
