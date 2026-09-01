/**
 * POST /api/admin/consultation/status
 *
 * Updates the Status field of a consultation record.
 * Used for: Under Review, Declined, Archived transitions.
 *
 * Protected by HttpOnly session cookie (admin_session)
 *
 * Body: { pageId, status }
 *   status: 'Under Review' | 'Declined' | 'Archived'
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateStatus }              from '@/lib/notion-fa-consultation'
import { requireAdminSession, unauthorized } from '@/lib/adminSession'

const ALLOWED = new Set([
  'Under Review',
  'Replied',
  'Waiting for Payment',
  'Paid',
  'Booked',
  'Course Sent',
  'Not Suitable',
  'Declined',
  'Closed Lost',
  'Archived',
])

export async function POST(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()

  let body: { pageId?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { pageId, status } = body

  if (!pageId || !status) {
    return NextResponse.json({ error: 'Missing pageId or status' }, { status: 422 })
  }

  if (!ALLOWED.has(status)) {
    return NextResponse.json({ error: `Invalid status. Allowed: ${[...ALLOWED].join(', ')}` }, { status: 422 })
  }

  try {
    await updateStatus(pageId, status)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/status]', err)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
