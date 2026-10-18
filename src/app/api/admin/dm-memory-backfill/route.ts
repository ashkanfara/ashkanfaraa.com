/**
 * POST /api/admin/dm-memory-backfill
 *
 * Server-side triggered backfill: reads dm_response_feedback (canonical) and
 * writes missing turns to instagram_dm_memory (n8n BRP compatibility layer).
 *
 * Runs server-side using SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from Vercel
 * environment — no secrets passed in request body or command args.
 *
 * Idempotent: pre-checks message->>buffer_id before inserting each pair.
 * Safe to call multiple times. Skips rows already present.
 * No Instagram API calls, no customer-visible side effects.
 *
 * Auth: admin session required.
 *
 * Body (optional):
 *   { sender_id?: string }   — if provided, backfills only that sender
 *
 * Returns:
 *   200 { ok: true, written: N, skipped: N, errors: N }
 *   401 Unauthorized
 *   503 Supabase not configured
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession, validateSameOrigin } from '@/lib/adminSession'
import { supabaseConfigured } from '@/lib/supabase'

const SUPABASE_BASE    = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_HEADERS = () => ({
  apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
  'Content-Type': 'application/json',
})

const FETCH_LIMIT  = 2000
const THROTTLE_MS  = 50   // pause between pairs to avoid rate limits

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

interface FeedbackRow {
  buffer_id:           string | null
  sender_id:           string
  inbound_context:     string | null
  final_sent_response: string | null
  created_at:          string
}

async function fetchFeedbackRows(senderId?: string): Promise<FeedbackRow[]> {
  const params = new URLSearchParams({
    select:              'buffer_id,sender_id,inbound_context,final_sent_response,created_at',
    order:               'created_at.asc',
    limit:               String(FETCH_LIMIT),
    inbound_context:     'not.is.null',
    final_sent_response: 'not.is.null',
  })
  if (senderId) params.set('sender_id', `eq.${senderId}`)

  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/dm_response_feedback?${params}`,
    { headers: SUPABASE_HEADERS() }
  )
  if (!res.ok) return []
  return (await res.json()) as FeedbackRow[]
}

async function checkExisting(sessionId: string, bufferId: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/instagram_dm_memory` +
    `?session_id=eq.${encodeURIComponent(sessionId)}` +
    `&message->>buffer_id=eq.${encodeURIComponent(bufferId)}` +
    `&select=id&limit=1`,
    { headers: SUPABASE_HEADERS() }
  )
  if (!res.ok) return false
  const rows = await res.json() as { id: number }[]
  return rows.length > 0
}

async function insertRow(sessionId: string, message: object): Promise<boolean> {
  const res = await fetch(`${SUPABASE_BASE()}/rest/v1/instagram_dm_memory`, {
    method:  'POST',
    headers: { ...SUPABASE_HEADERS(), Prefer: 'return=minimal' },
    body:    JSON.stringify({ session_id: sessionId, message }),
  })
  return res.ok
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!requireAdminSession(req))
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!validateSameOrigin(req))
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  if (!supabaseConfigured())
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })

  let body: { sender_id?: unknown } = {}
  try { body = await req.json() } catch { /* optional body */ }
  const senderIdFilter = typeof body.sender_id === 'string' ? body.sender_id.trim() : undefined

  const rows = await fetchFeedbackRows(senderIdFilter)
  // Filter: both texts non-empty (belt-and-suspenders beyond API filter)
  const valid = rows.filter(r => r.inbound_context?.trim() && r.final_sent_response?.trim() && r.buffer_id)

  let written = 0
  let skipped = 0
  let errors  = 0

  for (const r of valid) {
    const sessionId  = 'Key:\n' + r.sender_id
    const bufferId   = r.buffer_id!
    const humanText  = r.inbound_context!.trim()
    const aiText     = r.final_sent_response!.trim()

    try {
      const exists = await checkExisting(sessionId, bufferId)
      if (exists) { skipped++; continue }
    } catch {
      // Pre-check failure: proceed to write (worst case: harmless duplicate)
    }

    const humanOk = await insertRow(sessionId, { type: 'human', content: humanText, buffer_id: bufferId })
    const aiOk    = await insertRow(sessionId, { type: 'ai',    content: aiText,    buffer_id: bufferId })

    if (humanOk && aiOk) {
      written++
    } else {
      errors++
      console.error(`[dm-backfill] write failed for buffer_id=${bufferId} sender=${r.sender_id}`)
    }

    await sleep(THROTTLE_MS)
  }

  return NextResponse.json({ ok: true, written, skipped, errors })
}
