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

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { signupId, reason } = await request.json()

    if (!signupId) {
      return NextResponse.json({ error: 'Missing signupId' }, { status: 400 })
    }

    // Update pending signup status
    const { error } = await adminSupabase
      .from('pending_signups')
      .update({ 
        status: 'rejected',
        notes: reason || 'Rejected by admin'
      })
      .eq('id', signupId)

    if (error) {
      console.error('Failed to reject signup:', error)
      return NextResponse.json({ error: 'Failed to reject signup' }, { status: 500 })
    }

    // Also update any pending payment
    const { data: signup } = await adminSupabase
      .from('pending_signups')
      .select('user_id')
      .eq('id', signupId)
      .single()

    if (signup) {
      await adminSupabase
        .from('payments')
        .update({ status: 'rejected' })
        .eq('user_id', signup.user_id)
        .eq('status', 'pending')
    }

    return NextResponse.json({
      success: true,
      message: 'Signup rejected',
    })

  } catch (error: any) {
    console.error('Error rejecting signup:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
