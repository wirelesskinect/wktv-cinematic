import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/auth';
export const dynamic = 'force-dynamic'
import { createServerSupabase, adminSupabase } from '@/lib/supabase-server';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all data including payments
    const [supportRes, pendingRes, subscriptionsRes, paymentsRes] = await Promise.all([
      adminSupabase
        .from('support_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      adminSupabase
        .from('pending_matches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      adminSupabase
        .from('user_subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      adminSupabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    // Get user details for payments
    const payments = paymentsRes.data || [];
    const userIds = [...new Set(payments.map(p => p.user_id))];
    
    // Fetch user metadata for each payment
    const enrichedPayments = await Promise.all(
      payments.map(async (payment) => {
        try {
          // Get user from auth
          const { data: userData } = await adminSupabase.auth.admin.getUserById(payment.user_id);
          return {
            ...payment,
            user_email: userData?.user?.email || 'Unknown',
            user_name: userData?.user?.user_metadata?.name || userData?.user?.email?.split('@')[0] || 'Unknown',
            user_phone: userData?.user?.user_metadata?.phone || userData?.user?.phone || '',
          };
        } catch {
          return {
            ...payment,
            user_email: 'Unknown',
            user_name: 'Unknown',
            user_phone: '',
          };
        }
      })
    );

    return NextResponse.json({
      supportRequests: supportRes.data || [],
      pendingMatches: pendingRes.data || [],
      subscriptions: subscriptionsRes.data || [],
      payments: enrichedPayments,
    });

  } catch (error: any) {
    console.error('Admin data error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
