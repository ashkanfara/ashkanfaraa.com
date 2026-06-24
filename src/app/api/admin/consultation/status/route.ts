/**
 * POST /api/admin/consultation/status
 *
 * Updates the Status field of a consultation record.
 * Used for: Under Review, Declined, Archived transitions.
 *
 * Protected by Authorization: Bearer ADMIN_SECRET
 *
 * Body: { pageId, status }
 *   status: 'Under Review' | 'Declined' | 'Archived'
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateStatus }              from '@/lib/notion-fa-consultation'

const ALLOWED = new Set(['Under Review', 'Declined', 'Archived'])

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
