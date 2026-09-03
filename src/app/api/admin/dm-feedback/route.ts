/**
 * GET /api/admin/dm-feedback
 *
 * Read-only endpoint returning confirmed-sent DM feedback records.
 * Records are only written after a confirmed Instagram send (never for
 * failed, ignored, or SEND_STATUS_UNKNOWN outcomes).
 *
 * Query params:
 *   limit  — max rows (1–200, default 100)
 *   offset — pagination offset (default 0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminSession'
import { supabaseConfigured, getDmFeedback } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!requireAdminSession(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const limit  = Math.min(200, Math.max(1, parseInt(searchParams.get('limit')  ?? '100', 10) || 100))
  const offset =                            Math.max(0, parseInt(searchParams.get('offset') ?? '0',   10) || 0)

  const rows = await getDmFeedback(limit, offset)
  return NextResponse.json({ ok: true, count: rows.length, rows })
}
