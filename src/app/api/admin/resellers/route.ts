import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { adminSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const STATUSES = ['new', 'contacted', 'approved', 'declined'] as const
type Status = (typeof STATUSES)[number]

// Admin: list reseller inquiries from the homepage form
export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await adminSupabase
    .from('reseller_inquiries')
    .select('id, first_name, last_name, email, phone, status, admin_note, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) {
    if (/reseller_inquiries/.test(error.message || '') || error.code === '42P01') {
      return NextResponse.json({ needsMigration: true, inquiries: [], newCount: 0 })
    }
    console.error('reseller inquiries load error:', error)
    return NextResponse.json({ error: 'Could not load reseller inquiries' }, { status: 500 })
  }
  const inquiries = data || []
  return NextResponse.json({ inquiries, newCount: inquiries.filter((i) => i.status === 'new').length })
}

// Admin: update an inquiry's status and/or note. Body: { id, status?, note? }
// This only tracks follow-up. It never creates a reseller account or touches the IPTV panel.
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Choose an inquiry.' }, { status: 400 })

  const update: { status?: Status; admin_note?: string | null; updated_at: string } = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 })
    update.status = body.status
  }
  if (body.note !== undefined) {
    update.admin_note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) || null : null
  }

  const { data, error } = await adminSupabase.from('reseller_inquiries').update(update).eq('id', id).select('id')
  if (error) {
    console.error('reseller inquiry update error:', error)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
  if (!data || !data.length) return NextResponse.json({ error: 'That inquiry wasn’t found.' }, { status: 404 })
  return NextResponse.json({ success: true })
}
