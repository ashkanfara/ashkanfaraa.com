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
 *   SENDING        → (IG 4xx window closed)  → SEND_FAILED_WINDOW_CLOSED (NOT retryable)
 *   SENDING        → (IG 4xx other)          → SEND_FAILED        (admin can retry — IG never sent)
 *   SENDING        → (IG success + DB ok) → SENT
 *   SENDING        → (IG success + DB fail) → SEND_STATUS_UNKNOWN (NON-RESENDABLE)
 *   SENDING        → (timeout/unknown)      → SEND_STATUS_UNKNOWN (NON-RESENDABLE)
 *   SENDING        → (blocked)              → REJECTED
 *
 * Messaging window: Meta is the sole authority. The local 24h timer is NOT enforced here.
 * If Meta rejects because the window closed (HTTP 403, subcode 2534022), the outcome is
 * SEND_FAILED_WINDOW_CLOSED — NOT retryable. Cleared when the sender messages again.
 *
 * Security:
 *   - Admin session cookie verified before any action
 *   - Same-Origin header validated (CSRF defence-in-depth)
 *   - Atomic PATCH claim prevents double-send
 *   - Blocklist re-checked server-side
 *   - sender_id, created_at, status all loaded from Supabase — never trusted from browser
 *   - Instagram access token is a server-side env var only
 *   - final_response_text persisted at claim time — not lost if DB write fails after IG send
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
  getBlockedSenderIds,
  saveDmFeedback,
  supersedeBundleSiblings,
} from '@/lib/supabase'
import { requireAdminSession, validateSameOrigin } from '@/lib/adminSession'
import { sendViaEngine } from '@/lib/dm-send-engine'
import { writeConversationMemoryDurable } from '@/lib/dm-conversation-context'

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

  // ── 8. Send via shared engine ────────────────────────────────
  // Engine handles: IG API call, outcome classification, all DB state transitions,
  // and link-sent flag updates. Caller (here) is responsible for: auth, blocklist,
  // claim (PENDING_REVIEW → SENDING), supersede, and feedback.
  const sendAttemptTs = new Date().toISOString()
  const result = await sendViaEngine({
    dmId:            id,
    senderId,
    finalText,
    isFirstReply,
    sendingStartedAt: claimed.sendingStartedAt,
  })

  // ── 9. Resolve outcome ───────────────────────────────────────

  if (result.outcome === 'sent') {
    await supersedeBundleSiblings(senderId, id, createdAt).catch(e =>
      console.error('[dm-inbox/send] supersedeBundleSiblings failed (non-fatal):', e)
    )
    try {
      await saveDmFeedback({
        bufferId: id, senderId, inboundContext: messageText,
        originalDraft: originalDraft ?? null, finalSentResponse: finalText,
        draftSource: draftSource ?? null, wasEdited: originalDraft !== null && finalText !== originalDraft,
        feedbackRating, feedbackCategory, feedbackNote,
        igMessageId: result.igMessageId ?? null, igHttpStatus: result.igHttpStatus ?? null,
        approvalTs: claimed.sendingStartedAt, sendAttemptTs, sendState: 'SENT', isFirstReply,
      })
    } catch { /* non-fatal */ }
    // Durable: persist this turn to instagram_dm_memory so n8n BRP has context.
    // Awaited with internal retry; on total failure logs a recoverable structured error.
    // dm_response_feedback (canonical) was already written by saveDmFeedback above.
    if (messageText) {
      await writeConversationMemoryDurable(senderId, messageText, finalText, id)
    }
    return NextResponse.json({ ok: true, sent: true, messageId: result.igMessageId })
  }

  if (result.outcome === 'ambiguous') {
    try {
      await saveDmFeedback({
        bufferId: id, senderId, inboundContext: messageText,
        originalDraft: originalDraft ?? null, finalSentResponse: finalText,
        draftSource: draftSource ?? null, wasEdited: originalDraft !== null && finalText !== originalDraft,
        feedbackRating: null, feedbackCategory: null, feedbackNote: null,
        igMessageId: null, igHttpStatus: result.igHttpStatus ?? null,
        approvalTs: claimed.sendingStartedAt, sendAttemptTs, sendState: 'SEND_STATUS_UNKNOWN', isFirstReply,
      })
    } catch { /* non-fatal */ }
    return NextResponse.json({
      ok: false, error: 'send_status_unknown',
      hint: 'Instagram returned HTTP 200 but no message identifier. The send outcome is ambiguous — check your Instagram outbox before any action. Do not retry.',
    })
  }

  if (result.outcome === 'window_closed') {
    try {
      await saveDmFeedback({
        bufferId: id, senderId, inboundContext: messageText,
        originalDraft: originalDraft ?? null, finalSentResponse: finalText,
        draftSource: draftSource ?? null, wasEdited: originalDraft !== null && finalText !== originalDraft,
        feedbackRating: null, feedbackCategory: null, feedbackNote: null,
        igMessageId: null, igHttpStatus: result.igHttpStatus ?? null,
        approvalTs: claimed.sendingStartedAt, sendAttemptTs, sendState: 'SEND_FAILED_WINDOW_CLOSED', isFirstReply,
      })
    } catch { /* non-fatal */ }
    return NextResponse.json({
      ok: false, error: 'ig_messaging_window',
      hint: 'Instagram rejected this reply because the messaging window has closed.',
    })
  }

  if (result.outcome === 'definitive_failure') {
    try {
      await saveDmFeedback({
        bufferId: id, senderId, inboundContext: messageText,
        originalDraft: originalDraft ?? null, finalSentResponse: finalText,
        draftSource: draftSource ?? null, wasEdited: originalDraft !== null && finalText !== originalDraft,
        feedbackRating: null, feedbackCategory: null, feedbackNote: null,
        igMessageId: null, igHttpStatus: result.igHttpStatus ?? null,
        approvalTs: claimed.sendingStartedAt, sendAttemptTs, sendState: 'SEND_FAILED', isFirstReply,
      })
    } catch { /* non-fatal */ }
    return NextResponse.json({ ok: false, error: 'ig_send_failed' })
  }

  // unknown outcome
  try {
    await saveDmFeedback({
      bufferId: id, senderId, inboundContext: messageText,
      originalDraft: originalDraft ?? null, finalSentResponse: finalText,
      draftSource: draftSource ?? null, wasEdited: originalDraft !== null && finalText !== originalDraft,
      feedbackRating: null, feedbackCategory: null, feedbackNote: null,
      igMessageId: null, igHttpStatus: result.igHttpStatus ?? null,
      approvalTs: claimed.sendingStartedAt, sendAttemptTs, sendState: 'SEND_STATUS_UNKNOWN', isFirstReply,
    })
  } catch { /* non-fatal */ }
  return NextResponse.json({
    ok: false, error: 'send_status_unknown',
    hint: 'Instagram send outcome is unknown (timeout or network error). Check your Instagram outbox before taking any action.',
  })
}
