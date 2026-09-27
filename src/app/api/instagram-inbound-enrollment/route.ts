/**
 * POST /api/instagram-inbound-enrollment
 *
 * Called by n8n at intake, immediately when an authentic inbound DM arrives.
 * Renews (or creates) the sender's 48h auto-mode enrollment window using the
 * actual inbound event timestamp — NOT the callback clock, NOT at draft time.
 *
 * Enrollment = Routine's LLM classification in the callback payload sets auto_approved.
 * This endpoint only records the inbound event timestamp for rolling-window renewal;
 * it does NOT score conversation content itself.
 *
 * Auth: Bearer <DM_CALLBACK_SECRET>  (same shared secret as dm-draft-callback)
 *
 * Body: { sender_id, ig_account_id?, inbound_message_id, inbound_ts, enrolled_reason }
 *   enrolled_reason — passed by n8n based on last known Routine classification
 *                     or omitted (skips upsert, just renews if already enrolled)
 *
 * Returns:
 *   200 { ok: true, enrolled: bool, expires_at: string|null }
 *   401 { ok: false, error: 'Unauthorized' }
 *   422 { ok: false, error: string }
 *   503 { ok: false, error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import {
  supabaseConfigured,
  isAutoModeActive,
  getAutoModeRecord,
  upsertAutoModeEnrollment,
} from '@/lib/supabase'

function verifyBearer(req: NextRequest): boolean {
  const secret = process.env.DM_CALLBACK_SECRET
  if (!secret) return false
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return false
  const provided = authHeader.slice('Bearer '.length)
  const buf1 = Buffer.alloc(512, 0)
  const buf2 = Buffer.alloc(512, 0)
  buf1.write(secret,   0, 'utf8')
  buf2.write(provided, 0, 'utf8')
  try { return timingSafeEqual(buf1, buf2) && secret === provided }
  catch { return false }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyBearer(req))
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const sender_id          = typeof body.sender_id          === 'string' ? body.sender_id.trim()          : ''
  const ig_account_id      = typeof body.ig_account_id      === 'string' ? body.ig_account_id.trim()      : 'default'
  const inbound_message_id = typeof body.inbound_message_id === 'string' ? body.inbound_message_id.trim() : ''
  const inbound_ts         = typeof body.inbound_ts         === 'string' ? body.inbound_ts.trim()         : ''
  const enrolled_reason    = typeof body.enrolled_reason    === 'string' ? body.enrolled_reason.trim()    : ''

  if (!sender_id)
    return NextResponse.json({ ok: false, error: 'sender_id is required' }, { status: 422 })
  if (!inbound_message_id)
    return NextResponse.json({ ok: false, error: 'inbound_message_id is required' }, { status: 422 })
  if (!inbound_ts)
    return NextResponse.json({ ok: false, error: 'inbound_ts is required' }, { status: 422 })

  // Validate inbound_ts is a parseable ISO timestamp
  const tsMs = Date.parse(inbound_ts)
  if (isNaN(tsMs))
    return NextResponse.json({ ok: false, error: 'inbound_ts must be a valid ISO timestamp' }, { status: 422 })

  if (!supabaseConfigured())
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })

  // If enrolled_reason provided: upsert enrollment with renewed window
  // If not provided: only renew if already enrolled (preserves existing reason)
  let enrolled = false
  let expiresAt: string | null = null

  if (enrolled_reason) {
    const ok = await upsertAutoModeEnrollment({
      senderId:          sender_id,
      igAccountId:       ig_account_id,
      enrolledReason:    enrolled_reason,
      inboundMessageId:  inbound_message_id,
      inboundTs:         inbound_ts,
      conversationScore: 0, // LLM-driven enrollment; score tracked separately by Routine
    })
    if (ok) {
      const record = await getAutoModeRecord(sender_id, ig_account_id)
      enrolled  = record !== null && new Date(record.expiresAt) > new Date()
      expiresAt = record?.expiresAt ?? null
    }
  } else {
    // No reason provided — just renew the window if already enrolled
    const record = await getAutoModeRecord(sender_id, ig_account_id)
    if (record && new Date(record.expiresAt) > new Date()) {
      // Renew using existing reason
      await upsertAutoModeEnrollment({
        senderId:          sender_id,
        igAccountId:       ig_account_id,
        enrolledReason:    record.enrolledReason,
        inboundMessageId:  inbound_message_id,
        inboundTs:         inbound_ts,
        conversationScore: record.conversationScore,
      })
      const renewed = await getAutoModeRecord(sender_id, ig_account_id)
      enrolled  = renewed !== null && new Date(renewed.expiresAt) > new Date()
      expiresAt = renewed?.expiresAt ?? null
    } else {
      // Not currently enrolled and no reason provided — nothing to do
      enrolled  = false
      expiresAt = null
    }
  }

  console.log(
    `[inbound-enrollment] sender=${sender_id} ig=${ig_account_id}` +
    ` enrolled=${enrolled} expires=${expiresAt ?? 'none'} reason=${enrolled_reason || '(renew-only)'}` +
    ` inbound_id=${inbound_message_id}`
  )

  return NextResponse.json({ ok: true, enrolled, expires_at: expiresAt })
}
