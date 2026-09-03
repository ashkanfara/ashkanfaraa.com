/**
 * POST /api/admin/dm-inbox/send
 *
 * Approve a DM draft and send it via the Instagram Graph API.
 *
 * INVARIANT: AI MAY DRAFT. ONLY THE HUMAN MAY AUTHORIZE WHAT IS SENT.
 * Every protection below implements this invariant server-side.
 *
 * State machine:
 *   PENDING_REVIEW → (atomic claim) → SENDING
 *   SENDING        → (IG 4xx definitive) → SEND_FAILED        (admin can retry — IG never sent)
 *   SENDING        → (IG success + DB ok) → SENT
 *   SENDING        → (IG success + DB fail) → SEND_STATUS_UNKNOWN (NON-RESENDABLE)
 *   SENDING        → (timeout/unknown)      → SEND_STATUS_UNKNOWN (NON-RESENDABLE)
 *   SENDING        → (window expired)       → EXPIRED
 *   SENDING        → (blocked)              → REJECTED
 *
 * Security:
 *   - Admin session cookie verified before any action
 *   - Same-Origin header validated (CSRF defence-in-depth)
 *   - Atomic PATCH claim prevents double-send
 *   - 24h messaging window re-checked server-side
 *   - Blocklist re-checked server-side
 *   - sender_id, created_at, status all loaded from Supabase — never trusted from browser
 *   - Instagram access token is a server-side env var only
 *   - final_response_text persisted at claim time — not lost if markDmSent fails
 *
 * Browser may submit ONLY: { id, finalText }
 *   id        — instagram_dm_buffer UUID
 *   finalText — exact text to send (may equal AI draft or be edited)
 *
 * Returns:
 *   { ok: true, sent: true, messageId }          — success
 *   { ok: true, alreadySent: true }              — idempotent (already handled)
 *   { ok: false, error: 'messaging_window_expired' | 'sender_is_blocked' |
 *                        'ig_send_failed' | 'send_status_unknown' | ... }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  supabaseConfigured,
  claimDmForSend,
  markDmSent,
  markDmSendFailed,
  markDmStatusUnknown,
  getBlockedSenderIds,
  saveDmFeedback,
} from '@/lib/supabase'
import { requireAdminSession, validateSameOrigin } from '@/lib/adminSession'

const WINDOW_MS     = 24 * 60 * 60 * 1000          // Instagram 24-hour Customer Care window
const IG_API        = 'https://graph.instagram.com/v25.0/me/messages'
const IG_TIMEOUT_MS = 30_000                         // 30 s Instagram call timeout

/**
 * Transition a row we own (already in SENDING) to EXPIRED or REJECTED.
 * These are unconditional PATCHes — we hold the row in SENDING so no race.
 */
async function forceTransition(id: string, state: 'EXPIRED' | 'REJECTED'): Promise<void> {
  const base = process.env.SUPABASE_URL!.replace(/\/$/, '')
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  await fetch(`${base}/rest/v1/instagram_dm_buffer?id=eq.${encodeURIComponent(id)}`, {
    method:  'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ failed_reason: state, processing: false }),
  })
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────
  if (!requireAdminSession(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Same-Origin (CSRF defence-in-depth) ───────────────────
  if (!validateSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  // ── 3. Parse and validate browser input ───────────────────────
  // Required: id, finalText
  // Optional: feedbackRating, feedbackCategory, feedbackNote (never trusted for send logic)
  let body: { id?: unknown; finalText?: unknown; feedbackRating?: unknown; feedbackCategory?: unknown; feedbackNote?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const id        = typeof body.id        === 'string' ? body.id.trim()        : ''
  const finalText = typeof body.finalText === 'string' ? body.finalText.trim() : ''

  if (!id)              return NextResponse.json({ ok: false, error: 'id is required' }, { status: 422 })
  if (!finalText)       return NextResponse.json({ ok: false, error: 'finalText is required' }, { status: 422 })
  if (finalText.length > 1000) return NextResponse.json({ ok: false, error: 'Message too long (max 1000 chars)' }, { status: 422 })

  const ALLOWED_RATINGS    = ['good', 'ok', 'bad']
  const ALLOWED_CATEGORIES = ['good', 'too_long', 'too_short', 'too_soft', 'too_salesy', 'wrong_tone', 'wrong_context', 'missed_context', 'other']
  const feedbackRating   = typeof body.feedbackRating   === 'string' && ALLOWED_RATINGS.includes(body.feedbackRating)    ? body.feedbackRating   : null
  const feedbackCategory = typeof body.feedbackCategory === 'string' && ALLOWED_CATEGORIES.includes(body.feedbackCategory) ? body.feedbackCategory : null
  const feedbackNote     = typeof body.feedbackNote     === 'string' ? body.feedbackNote.slice(0, 500) : null

  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Supabase is not configured.' }, { status: 503 })
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) {
    console.error('[dm-inbox/send] INSTAGRAM_ACCESS_TOKEN is not set')
    return NextResponse.json(
      { ok: false, error: 'Instagram API is not configured on this server.' },
      { status: 503 }
    )
  }

  // ── 4. Atomic claim ──────────────────────────────────────────
  // PATCH WHERE failed_reason = PENDING_REVIEW → SENDING.
  // Also persists finalText immediately so it is not lost if step 6+ fails.
  // Loads sender_id + created_at from Supabase — never from the browser.
  // Returns null if 0 rows updated → already handled (SENT/REJECTED/EXPIRED/SENDING/etc.)
  const claimed = await claimDmForSend(id, finalText)
  if (!claimed) {
    return NextResponse.json({ ok: true, alreadySent: true })
  }

  const { senderId, createdAt, responseText: originalDraft, messageText, draftSource } = claimed

  // ── 5. Re-check: messaging window (server-side) ──────────────
  const windowExpiry = new Date(createdAt).getTime() + WINDOW_MS
  if (Date.now() > windowExpiry) {
    await forceTransition(id, 'EXPIRED')
    return NextResponse.json({ ok: false, error: 'messaging_window_expired' })
  }

  // ── 6. Re-check: blocklist (server-side) ────────────────────
  const blocked = await getBlockedSenderIds([senderId])
  if (blocked.has(senderId)) {
    await forceTransition(id, 'REJECTED')
    return NextResponse.json({ ok: false, error: 'sender_is_blocked' })
  }

  // ── 7. Call Instagram Graph API ──────────────────────────────
  // Three possible outcomes:
  //   'success'            — IG accepted; message sent
  //   'definitive_failure' — IG returned a proper error response (4xx) before sending
  //   'unknown'            — timeout, network error, or unexpected exception
  type IgOutcome = 'success' | 'definitive_failure' | 'unknown'
  let igOutcome: IgOutcome = 'unknown'
  let igMessageId: string | null = null

  try {
    const igRes = await fetch(`${IG_API}?access_token=${encodeURIComponent(token)}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        recipient: { id: senderId },
        message:   { text: finalText },
      }),
      signal: AbortSignal.timeout(IG_TIMEOUT_MS),
    })

    const igBody = await igRes.json() as Record<string, unknown>

    if (igRes.ok) {
      igMessageId = (igBody.message_id as string) ?? null
      igOutcome   = 'success'
      console.log(`[dm-inbox/send] IG accepted | review=${id} sender=${senderId} ig_msg=${igMessageId}`)
    } else {
      // IG returned an error response — message was NOT sent
      igOutcome = 'definitive_failure'
      console.error('[dm-inbox/send] IG definitive failure:', igRes.status, igBody)
    }

  } catch (err) {
    // Timeout, network error, or thrown exception — outcome is unknown
    igOutcome = 'unknown'
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    console.error('[dm-inbox/send] IG call threw:', isTimeout ? 'TimeoutError (30s)' : err)
  }

  // ── 8. Resolve outcome ───────────────────────────────────────

  if (igOutcome === 'success') {
    // Try to mark SENT in the database.
    // CRITICAL: if this DB write fails, the message was sent but we cannot record it.
    // Transition to SEND_STATUS_UNKNOWN — NON-RESENDABLE until manual reconciliation.
    const markOk = await markDmSent(id, finalText, igMessageId)
    if (!markOk) {
      // Instagram sent the message. The DB is now inconsistent.
      // The admin must check their Instagram outbox and manually resolve in Supabase.
      await markDmStatusUnknown(id)
      console.error(
        `[dm-inbox/send] CRITICAL: IG sent (msg_id=${igMessageId}) but DB persistence failed.` +
        ` review_id=${id} → SEND_STATUS_UNKNOWN. Manual reconciliation required.`
      )
      return NextResponse.json({
        ok:    false,
        error: 'send_status_unknown',
        hint:  'Instagram sent the message but the database could not be updated. Check your Instagram outbox. Do not retry.',
      })
    }

    // Write feedback record — fire-and-forget, never blocks or fails the send response
    try {
      await saveDmFeedback({
        bufferId:          id,
        senderId:          senderId,
        inboundContext:    messageText,
        originalDraft:     originalDraft ?? null,
        finalSentResponse: finalText,
        draftSource:       draftSource ?? null,
        wasEdited:         originalDraft !== null && finalText !== originalDraft,
        feedbackRating:    feedbackRating,
        feedbackCategory:  feedbackCategory,
        feedbackNote:      feedbackNote,
      })
    } catch (fbErr) {
      console.error('[dm-inbox/send] feedback save failed (non-fatal):', fbErr)
    }

    console.log(`[dm-inbox/send] ✓ SENT | review=${id} sender=${senderId} ig_msg=${igMessageId}`)
    return NextResponse.json({ ok: true, sent: true, messageId: igMessageId })
  }

  if (igOutcome === 'definitive_failure') {
    // IG rejected before accepting — message NOT sent. Safe to retry after admin decision.
    await markDmSendFailed(id)
    return NextResponse.json({ ok: false, error: 'ig_send_failed' })
  }

  // Unknown outcome (timeout/error) — cannot confirm whether IG sent.
  // Transition to SEND_STATUS_UNKNOWN — NON-RESENDABLE.
  await markDmStatusUnknown(id)
  console.error(`[dm-inbox/send] Unknown IG outcome → SEND_STATUS_UNKNOWN | review=${id}`)
  return NextResponse.json({
    ok:    false,
    error: 'send_status_unknown',
    hint:  'Instagram send outcome is unknown (timeout or network error). Check your Instagram outbox before taking any action.',
  })
}
