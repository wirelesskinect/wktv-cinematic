# Omega TV Kentucky

Customer portal for Omega TV Kentucky market.

## Features

- User registration with region tagging (KY)
- YouTube video troubleshooting guides
- Same backend as getomegatv.com (Tennessee)
- Supabase auth & database
- BlockChyp payment integration

## Setup

1. Clone this repo
2. Copy `.env.example` to `.env.local` and fill in values
3. Run `npm install`
4. Run `npm run dev`

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
BLOCKCHYP_API_KEY=your_blockchyp_key
BLOCKCHYP_BEARER_TOKEN=your_blockchyp_token
BLOCKCHYP_SIGNING_KEY=your_signing_key
```

## Database

Run the SQL in `supabase-schema.sql` to add region support to existing tables.

## YouTube Videos

Edit `src/config/site.ts` to add your YouTube video IDs for troubleshooting guides.

## Deployment

Deploy to Vercel:

1. Create new Vercel project
2. Connect to GitHub repo
3. Add environment variables
4. Deploy

## Region Configuration

The site is configured for Kentucky in `src/config/site.ts`. To create another region:

1. Copy this repo
2. Update `siteConfig` in `src/config/site.ts`
3. Update metadata in `src/app/layout.tsx`
4. Deploy to new domain
