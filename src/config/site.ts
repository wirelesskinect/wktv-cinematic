// Site configuration - WKTV
export const siteConfig = {
  name: 'WKTV',
  tagline: 'Watch Anywhere',
  siteName: 'WKTV - Watch Anywhere',
  domain: 'wktv.com', // Update when domain is purchased
  supportEmail: 'support@wktv.com',
  
  // Payment info
  cashAppTag: '$wirelesskinect',
  zellePhone: '484.680.3570',
  venmoHandle: '@wirelesskinectsnax',
  cryptoWallets: {
    btc: '', // Add BTC address
    usdt: '', // Add USDT address (TRC20 or ERC20)
  },
  
  // Brand colors
  colors: {
    primary: '#DC2626', // Red
    secondary: '#000000', // Black
    accent: '#FFFFFF', // White
  },
  
  // Pricing plans
  plans: {
    trial: [
      { id: 'trial-free', name: 'Free 24-Hour Trial', price: 0, connections: 1, duration: '24 hours' },
      { id: 'trial-1mo', name: '1-Month Trial', price: 20, connections: 1, duration: '1 month' },
    ],
    monthly: [
      { id: 'monthly-1', name: 'Monthly', price: 30, connections: 1, duration: 'month' },
    ],
    annual: [
      { id: 'annual-1', name: '1 Connection', price: 175, connections: 1, duration: 'year' },
      { id: 'annual-2', name: '2 Connections', price: 225, connections: 2, duration: 'year', label: 'Family' },
      { id: 'annual-3', name: '3 Connections', price: 250, connections: 3, duration: 'year', label: 'Family' },
      { id: 'annual-4', name: '4 Connections', price: 275, connections: 4, duration: 'year', label: 'Family' },
      { id: 'annual-5', name: '5 Connections', price: 300, connections: 5, duration: 'year', label: 'Best Value', featured: true },
    ],
    lifetime: [
      { id: 'lifetime-1', name: '1 Connection', price: 600, connections: 1, duration: 'lifetime' },
      { id: 'lifetime-5', name: '5 Connections', price: 850, connections: 5, duration: 'lifetime' },
    ],
  },
  
  // Troubleshooting videos (add YouTube IDs later)
  troubleshootingVideos: [] as TroubleshootingVideo[],
}

export type PlanCategory = 'trial' | 'monthly' | 'annual' | 'lifetime'
export type VideoCategory = 'setup' | 'troubleshooting' | 'account'

export interface TroubleshootingVideo {
  id: string
  title: string
  description: string
  youtubeId: string
  category: VideoCategory
}
