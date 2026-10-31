import { createClient } from '@supabase/supabase-js'

// Admin client for server-side operations (uses service role key)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: {
        schema: 'wktv'
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Alias for backwards compatibility with API routes
export const createServerSupabase = createAdminClient

// Singleton admin client instance
export const adminSupabase = createAdminClient()
