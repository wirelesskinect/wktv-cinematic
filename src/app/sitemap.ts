import type { MetadataRoute } from 'next'

const SITE = 'https://www.wktv.live'

// Public pages for Google/Bing. Update lastModified when page content changes.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/support.html`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/troubleshooting.html`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/support`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
