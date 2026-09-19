/**
 * GET  /api/admin/dm-inbox  — Fetch PENDING_REVIEW DM drafts for human review.
 * POST /api/admin/dm-inbox  — Non-send mutations: reject, requeue, takeover, release, block, unblock.
 *
 * Protected by HttpOnly session cookie (admin_session).
 * Supabase service key is server-side only — never exposed to the browser.
 *
 * POST body: { action, id?, senderId?, displayName?, notes? }
 *   action: 'reject' | 'requeue' | 'takeover' | 'release' | 'block' | 'unblock'
 *
 * Sending (approve) is a separate route: POST /api/admin/dm-inbox/send
 * because it requires the Instagram access token and additional server-side guards.
 */

import { NextRequest, NextResponse } from 'next/server'
import { recoverStaleDmDrafts } from '@/lib/dm-draft-recovery'
import {
  supabaseConfigured,
  getDmInbox,
  ignoreDm,
  ignoreConversation,
  bulkIgnoreConversations,
  rejectDm,
  requeueDm,
  cancelRegenDm,
  retryDmSendFailed,
  takeoverConversation,
  releaseToAi,
  blockDmSender,
  unblockSender,
} from '@/lib/supabase'
import { requireAdminSession, unauthorized, validateSameOrigin } from '@/lib/adminSession'

// ── GET ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  }

  // Recover before loading so the operator can retry a stuck draft immediately.
  // Failure must not hide the inbox; the daily sweep remains a second trigger.
  let recoveryWarning: string | undefined
  try {
    const result = await recoverStaleDmDrafts()
    if (!result.ok) recoveryWarning = 'Some stuck drafts could not be recovered.'
  } catch { recoveryWarning = 'Stuck-draft recovery is temporarily unavailable.' }
  const { items, history } = await getDmInbox()
  return NextResponse.json({ items, history, recoveryWarning })
}

// ── POST ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()
  if (!validateSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { action, id, senderId, displayName, notes } = body as Record<string, string>
  const senderIds = body.senderIds as string[] | undefined

  try {
    switch (action) {

      case 'ignore': {
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 422 })
        const result = await ignoreDm(id)
        if (result.ignored) return NextResponse.json({ ok: true, ignored: true })
        const msg = result.reason === 'not_eligible'
          ? 'Cannot ignore: item is already terminal (SENT/SENDING/SEND_STATUS_UNKNOWN) or in an unrecognised state'
          : 'Ignore failed — item may have already changed state'
        return NextResponse.json({ ok: false, error: msg }, { status: 422 })
      }

      case 'ignore_conversation': {
        if (!senderId) return NextResponse.json({ error: 'senderId required' }, { status: 422 })
        const result = await ignoreConversation(senderId)
        if (result.reason) return NextResponse.json({ ok: false, error: 'Supabase error during conversation ignore' }, { status: 500 })
        return NextResponse.json({ ok: true, ignored: true, count: result.count })
      }

      case 'bulk_ignore': {
        if (!senderIds || !Array.isArray(senderIds) || senderIds.length === 0) {
          return NextResponse.json({ error: 'senderIds array required' }, { status: 422 })
        }
        if (senderIds.length > 100) {
          return NextResponse.json({ error: 'Too many senderIds (max 100 per request)' }, { status: 422 })
        }
        const result = await bulkIgnoreConversations(senderIds)
        return NextResponse.json({ ok: true, totalIgnored: result.totalIgnored, failed: result.failed })
      }

      case 'reject': {
        // Legacy — used by n8n blocked-sender flows. Not exposed in the admin UI.
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 422 })
        const rejected = await rejectDm(id)
        return NextResponse.json({ ok: true, rejected })
      }

      case 'requeue': {
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 422 })
        const requeued = await requeueDm(id)
        if (!requeued) {
          return NextResponse.json(
            { ok: false, error: 'Cannot regenerate: row is not in PENDING_REVIEW state (may have been sent, ignored, or already requeued)' },
            { status: 422 }
          )
        }
        return NextResponse.json({ ok: true, requeued: true })
      }

      case 'cancel_regen': {
        // Restore a regenerating row (failed_reason=null, processed=false) back to PENDING_REVIEW.
        // The old draft in response_text is preserved — not touched by this action.
        // Uses no WHERE guard on failed_reason so it can target null rows.
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 422 })
        const cancelled = await cancelRegenDm(id)
        if (!cancelled) {
          return NextResponse.json(
            { ok: false, error: 'Cancel failed: row may have already been processed or is no longer regenerating' },
            { status: 422 }
          )
        }
        return NextResponse.json({ ok: true })
      }

      case 'retry_send_failed': {
        // Reset IG_SEND_ERROR or stuck SENDING → PENDING_REVIEW.
        // Admin must re-approve; no automatic resend. Intentional human action required.
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 422 })
        const reset = await retryDmSendFailed(id)
        return NextResponse.json({ ok: true, reset })
      }

      case 'takeover': {
        if (!senderId) return NextResponse.json({ error: 'senderId required' }, { status: 422 })
        await takeoverConversation(senderId, notes || 'manual')
        return NextResponse.json({ ok: true })
      }

      case 'release': {
        if (!senderId) return NextResponse.json({ error: 'senderId required' }, { status: 422 })
        await releaseToAi(senderId)
        return NextResponse.json({ ok: true })
      }

      case 'block': {
        if (!senderId) return NextResponse.json({ error: 'senderId required' }, { status: 422 })
        await blockDmSender(senderId, displayName || senderId, notes)
        return NextResponse.json({ ok: true, blocked: true })
      }

      case 'unblock': {
        if (!senderId) return NextResponse.json({ error: 'senderId required' }, { status: 422 })
        await unblockSender(senderId)
        return NextResponse.json({ ok: true, unblocked: true })
      }

      default:
        return NextResponse.json(
          { error: 'action must be: ignore | ignore_conversation | bulk_ignore | requeue | cancel_regen | retry_send_failed | takeover | release | block | unblock' },
          { status: 422 }
        )
    }
  } catch (err) {
    console.error('[dm-inbox]', action, err)
    const message = err instanceof Error ? err.message : 'Supabase operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
