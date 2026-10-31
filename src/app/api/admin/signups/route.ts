import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: { schema: 'wktv' },
    auth: { autoRefreshToken: false, persistSession: false }
  }
)

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    let query = adminSupabase
      .from('pending_signups')
      .select('*')
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: signups, error } = await query.limit(100)

    if (error) {
      console.error('Failed to fetch signups:', error)
      return NextResponse.json({ error: 'Failed to fetch signups' }, { status: 500 })
    }

    return NextResponse.json({ signups })
  } catch (error: any) {
    console.error('Error fetching signups:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
