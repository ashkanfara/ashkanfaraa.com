import { isMetaWindowError } from '@/lib/dm-send-error'
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
 *   SENDING        → (blocked)              → REJECTED
 *
 * Messaging window: Meta is the sole authority. The local 24h timer is NOT enforced here.
 * If Meta rejects because the window closed, the outcome is SEND_FAILED (retryable) and
 * the specific error 'ig_messaging_window' is returned to the UI.
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
 *   HTTP 409                                  — already handled or changed
 *   { ok: false, error: 'ig_messaging_window' | 'ig_send_failed' |
 *                        'sender_is_blocked' | 'send_status_unknown' | ... }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  supabaseConfigured,
  fetchDmRowMeta,
  countFreshInboundAfter,
  claimDmForSend,
  markDmSent,
  markDmSendFailed,
  markDmStatusUnknown,
  getBlockedSenderIds,
  saveDmFeedback,
  supersedeBundleSiblings,
} from '@/lib/supabase'
import { requireAdminSession, validateSameOrigin } from '@/lib/adminSession'

const IG_API        = 'https://graph.instagram.com/v25.0/me/messages'
const IG_TIMEOUT_MS = 30_000                         // 30 s Instagram call timeout

/**
 * Transition a row we own (already in SENDING) to REJECTED.
 * Unconditional PATCH — we hold the row in SENDING so no race.
 */
async function forceTransition(id: string, state: 'REJECTED'): Promise<void> {
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

  // ── 4a. Staleness pre-check ──────────────────────────────────
  // Before claiming, verify no new inbound messages arrived after the primary row was
  // created (which would make this draft address an incomplete conversation).
  // This is a read-only check — no side effects if stale is detected.
  let claimed: Awaited<ReturnType<typeof claimDmForSend>>
  try {
    const rowMeta = await fetchDmRowMeta(id)
    if (!rowMeta) return NextResponse.json({ ok: false, error: 'Message no longer available. Refresh the inbox.' }, { status: 404 })
    const newCount = await countFreshInboundAfter(rowMeta.senderId, rowMeta.createdAt)
    if (newCount > 0) {
      return NextResponse.json({
        ok: false, error: 'bundle_stale',
        hint: 'A new message arrived. Refresh the inbox before approving this reply.',
      }, { status: 409 })
    }
    claimed = await claimDmForSend(id, finalText)
  } catch {
    // No Instagram request has started; a database failure is never a sent receipt.
    return NextResponse.json({ ok: false, error: 'Could not verify the send state. Refresh and try again.' }, { status: 503 })
  }
  if (!claimed) {
    return NextResponse.json({ ok: false, error: 'Message already handled or changed. Refresh the inbox.' }, { status: 409 })
  }

  const { senderId, createdAt, responseText: originalDraft, messageText, draftSource } = claimed

  // ── 5. Re-check: blocklist (server-side) ────────────────────
  // Note: messaging window is NOT checked here. Meta is the authority.
  // If Meta rejects for window reasons, outcome is SEND_FAILED (error: ig_messaging_window).
  const blocked = await getBlockedSenderIds([senderId])
  if (blocked.has(senderId)) {
    await forceTransition(id, 'REJECTED')
    return NextResponse.json({ ok: false, error: 'sender_is_blocked' })
  }

  // ── 7. Detect whether this is a first-ever reply to this sender ──────────────
  // Used as a Message Request indicator: if we've never sent to this sender before,
  // this conversation was likely in Instagram's "Message Requests" state.
  // Stored for forensic audit — does NOT change send behavior.
  let isFirstReply = false
  try {
    const base = process.env.SUPABASE_URL!.replace(/\/$/, '')
    const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const priorRes = await fetch(
      `${base}/rest/v1/instagram_dm_buffer` +
      `?sender_id=eq.${encodeURIComponent(senderId)}&response_sent=eq.true&select=id&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    if (priorRes.ok) {
      const prior = await priorRes.json() as { id: string }[]
      isFirstReply = prior.length === 0
    }
  } catch { /* non-fatal */ }

  // ── 8. Call Instagram Graph API ──────────────────────────────
  // Outcome classification:
  //   'success'            — HTTP 2xx AND response contains a non-empty message_id
  //   'definitive_failure' — HTTP 4xx rejection from IG
  //   'ambiguous_200'      — HTTP 2xx but NO message_id in response body (unexpected; treat as unknown)
  //   'unknown'            — HTTP 5xx, timeout, network error, or thrown exception
  type IgOutcome = 'success' | 'definitive_failure' | 'ambiguous_200' | 'unknown'
  let igOutcome: IgOutcome = 'unknown'
  let igMessageId: string | null = null
  let igHttpStatus: number | null = null
  let igResponseBody: string | null = null

  const sendAttemptTs = new Date().toISOString()

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

    igHttpStatus = igRes.status
    const igBody = await igRes.json() as Record<string, unknown>

    // Capture truncated response body for forensic storage (≤2KB)
    igResponseBody = JSON.stringify(igBody).slice(0, 2048)

    if (igRes.ok) {
      const rawId = igBody.message_id
      igMessageId = typeof rawId === 'string' && rawId.length > 0 ? rawId : null

      if (igMessageId) {
        // ✅ Verified success: HTTP 2xx + non-empty message_id
        igOutcome = 'success'
        console.log(
          `[dm-inbox/send] IG accepted | review=${id} sender=${senderId}` +
          ` ig_msg=${igMessageId} http=${igHttpStatus} first_reply=${isFirstReply}` +
          ` recipient_id=${igBody.recipient_id ?? 'absent'}`
        )
      } else {
        // ⚠️ HTTP 2xx but no message_id — Meta accepted the HTTP call but response is unexpected.
        // Cannot confirm delivery. Treat as ambiguous to prevent a false SENT label.
        igOutcome = 'ambiguous_200'
        console.error(
          `[dm-inbox/send] IG HTTP 2xx but NO message_id! review=${id} sender=${senderId}` +
          ` http=${igHttpStatus} body=${igResponseBody} first_reply=${isFirstReply}`
        )
      }
    } else {
      // A server failure can occur after acceptance; do not make it resendable.
      igOutcome = igRes.status >= 500 ? 'unknown' : 'definitive_failure'
      console.error(
        `[dm-inbox/send] IG error response | review=${id} sender=${senderId}` +
        ` http=${igHttpStatus} body=${igResponseBody} first_reply=${isFirstReply}`
      )
    }

  } catch (err) {
    // Timeout, network error, or thrown exception — outcome is unknown
    igOutcome = 'unknown'
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    console.error(
      `[dm-inbox/send] IG call threw | review=${id} sender=${senderId}` +
      ` error=${isTimeout ? 'TimeoutError(30s)' : String(err)} first_reply=${isFirstReply}`
    )
  }

  // ── 9. Resolve outcome ───────────────────────────────────────

  if (igOutcome === 'success') {
    // Try to mark SENT in the database.
    // CRITICAL: if this DB write fails, the message was sent but we cannot record it.
    // Transition to SEND_STATUS_UNKNOWN — NON-RESENDABLE until manual reconciliation.
    const markOk = await markDmSent(id, finalText, igMessageId, igHttpStatus, igResponseBody, isFirstReply)
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

    // Complete cleanup before the serverless response; preserve newer arrivals.
    await supersedeBundleSiblings(senderId, id, createdAt).then(count => {
      if (count > 0) console.log(`[dm-inbox/send] Superseded ${count} bundle siblings for sender=${senderId}`)
    }).catch(e => console.error('[dm-inbox/send] supersedeBundleSiblings failed (non-fatal):', e))

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
        igMessageId:       igMessageId,
        igHttpStatus:      igHttpStatus,
        approvalTs:        claimed.sendingStartedAt,
        sendAttemptTs:     sendAttemptTs,
        sendState:         'SENT',
        isFirstReply:      isFirstReply,
      })
    } catch (fbErr) {
      console.error('[dm-inbox/send] feedback save failed (non-fatal):', fbErr)
    }

    console.log(`[dm-inbox/send] ✓ SENT | review=${id} sender=${senderId} ig_msg=${igMessageId} first_reply=${isFirstReply}`)
    return NextResponse.json({ ok: true, sent: true, messageId: igMessageId })
  }

  if (igOutcome === 'ambiguous_200') {
    // HTTP 200 but no message_id — cannot prove delivery. SEND_STATUS_UNKNOWN is the truthful state.
    await markDmStatusUnknown(id, igHttpStatus, igResponseBody)
    console.error(`[dm-inbox/send] ambiguous_200 → SEND_STATUS_UNKNOWN | review=${id} sender=${senderId}`)
    try {
      await saveDmFeedback({
        bufferId: id, senderId, inboundContext: messageText,
        originalDraft: originalDraft ?? null, finalSentResponse: finalText,
        draftSource: draftSource ?? null, wasEdited: originalDraft !== null && finalText !== originalDraft,
        feedbackRating: null, feedbackCategory: null, feedbackNote: null,
        igMessageId: null, igHttpStatus, approvalTs: claimed.sendingStartedAt,
        sendAttemptTs, sendState: 'SEND_STATUS_UNKNOWN', isFirstReply,
      })
    } catch { /* non-fatal */ }
    return NextResponse.json({
      ok:    false,
      error: 'send_status_unknown',
      hint:  'Instagram returned HTTP 200 but no message identifier. The send outcome is ambiguous — check your Instagram outbox before any action. Do not retry.',
    })
  }

  if (igOutcome === 'definitive_failure') {
    // IG rejected before accepting — message NOT sent. Safe to retry after admin decision.
    await markDmSendFailed(id, igHttpStatus, igResponseBody)
    try {
      await saveDmFeedback({
        bufferId: id, senderId, inboundContext: messageText,
        originalDraft: originalDraft ?? null, finalSentResponse: finalText,
        draftSource: draftSource ?? null, wasEdited: originalDraft !== null && finalText !== originalDraft,
        feedbackRating: null, feedbackCategory: null, feedbackNote: null,
        igMessageId: null, igHttpStatus, approvalTs: claimed.sendingStartedAt,
        sendAttemptTs, sendState: 'SEND_FAILED', isFirstReply,
      })
    } catch { /* non-fatal */ }
    if (isMetaWindowError(igResponseBody)) {
      return NextResponse.json({
        ok: false,
        error: 'ig_messaging_window',
        hint: 'Instagram rejected this reply because the messaging window has closed.',
      })
    }
    return NextResponse.json({ ok: false, error: 'ig_send_failed' })
  }

  // Unknown outcome (timeout/error) — cannot confirm whether IG sent.
  // Transition to SEND_STATUS_UNKNOWN — NON-RESENDABLE.
  await markDmStatusUnknown(id, igHttpStatus, igResponseBody)
  try {
    await saveDmFeedback({
      bufferId: id, senderId, inboundContext: messageText,
      originalDraft: originalDraft ?? null, finalSentResponse: finalText,
      draftSource: draftSource ?? null, wasEdited: originalDraft !== null && finalText !== originalDraft,
      feedbackRating: null, feedbackCategory: null, feedbackNote: null,
      igMessageId: null, igHttpStatus, approvalTs: claimed.sendingStartedAt,
      sendAttemptTs, sendState: 'SEND_STATUS_UNKNOWN', isFirstReply,
    })
  } catch { /* non-fatal */ }
  console.error(`[dm-inbox/send] Unknown IG outcome → SEND_STATUS_UNKNOWN | review=${id}`)
  return NextResponse.json({
    ok:    false,
    error: 'send_status_unknown',
    hint:  'Instagram send outcome is unknown (timeout or network error). Check your Instagram outbox before taking any action.',
  })
}
