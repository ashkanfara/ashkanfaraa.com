/**
 * dm-send-engine.ts
 *
 * Shared Instagram DM send core used by:
 *   - Auto-mode sends from dm-draft-callback
 *   (Admin manual send route retains its own inline logic to avoid regression risk;
 *    this engine mirrors it faithfully so both paths use equivalent logic.)
 *
 * Caller is responsible for: auth checks, blocked-sender checks, and claiming the row
 * (PENDING_REVIEW → SENDING via claimDmForSend) BEFORE calling sendViaEngine.
 *
 * Guarantees:
 *   - All outcome states are truthful: SENT / SEND_FAILED_WINDOW_CLOSED / SEND_FAILED /
 *     SEND_STATUS_UNKNOWN — no false SENT labels
 *   - SEND_STATUS_UNKNOWN is never retried
 *   - link-sent flags updated on confirmed success
 *   - isMetaWindowError detects subcodes 2534022 and 2018141
 */

import {
  markDmSent,
  markDmSendFailed,
  markDmWindowClosed,
  markDmStatusUnknown,
  updateLinkSentFlags,
} from '@/lib/supabase'
import { isMetaWindowError } from '@/lib/dm-send-error'

const IG_API        = 'https://graph.instagram.com/v25.0/me/messages'
const IG_TIMEOUT_MS = 30_000

export type SendEngineOutcome =
  | 'sent'
  | 'window_closed'       // Meta error 2534022 / 2018141 — not retryable
  | 'definitive_failure'  // other IG 4xx — not retried (safe to retry manually)
  | 'ambiguous'           // HTTP 2xx but no message_id — treat as unknown
  | 'unknown'             // 5xx, timeout, thrown error — not retryable

export interface SendEngineInput {
  dmId:            string
  senderId:        string
  finalText:       string       // exact text to send
  isFirstReply?:   boolean      // for forensic audit (defaults false)
  sendingStartedAt?: string     // ISO timestamp from claimDmForSend, for feedback records
}

export interface SendEngineResult {
  outcome:        SendEngineOutcome
  igMessageId?:   string | null
  igHttpStatus?:  number | null
  igResponseBody?: string | null
  error?:         string
}

/**
 * Execute the Instagram send call and record the truthful outcome.
 * Caller MUST have already claimed the row (PENDING_REVIEW → SENDING).
 */
export async function sendViaEngine(input: SendEngineInput): Promise<SendEngineResult> {
  const { dmId, senderId, finalText, isFirstReply = false } = input

  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) {
    // Cannot send — leave in SENDING (will surface as SEND_STATUS_UNKNOWN after timeout)
    await markDmStatusUnknown(dmId, null, null)
    return { outcome: 'unknown', error: 'INSTAGRAM_ACCESS_TOKEN not configured' }
  }

  let igOutcome: 'success' | 'definitive_failure' | 'ambiguous_200' | 'unknown' = 'unknown'
  let igMessageId: string | null = null
  let igHttpStatus: number | null = null
  let igResponseBody: string | null = null

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
    let igBodyRaw: Record<string, unknown> = {}
    try { igBodyRaw = await igRes.json() as Record<string, unknown> } catch { /* non-JSON */ }
    igResponseBody = JSON.stringify(igBodyRaw).slice(0, 2048)

    if (igRes.ok) {
      const rawId = igBodyRaw.message_id
      igMessageId = typeof rawId === 'string' && rawId.length > 0 ? rawId : null
      igOutcome = igMessageId ? 'success' : 'ambiguous_200'
    } else {
      igOutcome = igRes.status >= 500 ? 'unknown' : 'definitive_failure'
    }
  } catch (err) {
    igOutcome = 'unknown'
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[dm-send-engine] IG call threw | dmId=${dmId} error=${msg}`)
  }

  // ── Record outcome ────────────────────────────────────────────────────────

  if (igOutcome === 'success') {
    const markOk = await markDmSent(dmId, finalText, igMessageId, igHttpStatus, igResponseBody, isFirstReply)
    if (!markOk) {
      // IG sent but DB write failed — must not mark SENT
      await markDmStatusUnknown(dmId, igHttpStatus, igResponseBody)
      console.error(
        `[dm-send-engine] CRITICAL: IG sent (msg_id=${igMessageId}) but DB persistence failed.` +
        ` dmId=${dmId} → SEND_STATUS_UNKNOWN. Manual reconciliation required.`
      )
      return { outcome: 'unknown', igMessageId, igHttpStatus, igResponseBody }
    }
    // Non-fatal: update link-sent flags
    updateLinkSentFlags(senderId, finalText).catch(e =>
      console.error('[dm-send-engine] updateLinkSentFlags failed (non-fatal):', e)
    )
    console.log(`[dm-send-engine] ✓ SENT | dmId=${dmId} sender=${senderId} ig_msg=${igMessageId} first_reply=${isFirstReply}`)
    return { outcome: 'sent', igMessageId, igHttpStatus, igResponseBody }
  }

  if (igOutcome === 'ambiguous_200') {
    await markDmStatusUnknown(dmId, igHttpStatus, igResponseBody)
    console.error(`[dm-send-engine] ambiguous_200 → SEND_STATUS_UNKNOWN | dmId=${dmId}`)
    return { outcome: 'ambiguous', igHttpStatus, igResponseBody }
  }

  if (igOutcome === 'definitive_failure') {
    if (isMetaWindowError(igResponseBody)) {
      await markDmWindowClosed(dmId, igHttpStatus, igResponseBody)
      console.warn(`[dm-send-engine] window_closed | dmId=${dmId} http=${igHttpStatus}`)
      return { outcome: 'window_closed', igHttpStatus, igResponseBody }
    }
    await markDmSendFailed(dmId, igHttpStatus, igResponseBody)
    console.error(`[dm-send-engine] definitive_failure | dmId=${dmId} http=${igHttpStatus}`)
    return { outcome: 'definitive_failure', igHttpStatus, igResponseBody }
  }

  // unknown
  await markDmStatusUnknown(dmId, igHttpStatus, igResponseBody)
  console.error(`[dm-send-engine] unknown outcome → SEND_STATUS_UNKNOWN | dmId=${dmId}`)
  return { outcome: 'unknown', igHttpStatus, igResponseBody }
}
