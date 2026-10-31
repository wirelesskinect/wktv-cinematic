import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/auth';
export const dynamic = 'force-dynamic'
import { createServerSupabase, adminSupabase } from '@/lib/supabase-server';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, type } = await req.json();

    if (type === 'support') {
      await adminSupabase
        .from('support_requests')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id);
    } else if (type === 'pending') {
      await adminSupabase
        .from('pending_matches')
        .update({ status: 'resolved', reviewed_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Admin resolve error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
