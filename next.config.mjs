/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Blocks other sites from framing WKTV and stops plugin/base-tag injection.
  // (Scripts and styles aren't restricted here so the existing pages keep working.)
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Keep API responses out of search results
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
  async rewrites() {
    return {
      // Serve the new WKTV design pages (in /public) for these addresses.
      // Signup, login, pay, dashboard, renew, support form and admin stay as app pages.
      beforeFiles: [
        { source: '/', destination: '/home.html' },
        { source: '/troubleshooting', destination: '/troubleshooting.html' },
        { source: '/help', destination: '/support.html' },
      ],
    };
  },
};

export default nextConfig;
