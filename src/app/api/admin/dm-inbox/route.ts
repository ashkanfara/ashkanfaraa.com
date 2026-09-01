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
import {
  supabaseConfigured,
  getDmInbox,
  ignoreDm,
  rejectDm,
  requeueDm,
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

  const { items, history } = await getDmInbox()
  return NextResponse.json({ items, history })
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

  let body: Record<string, string>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { action, id, senderId, displayName, notes } = body

  try {
    switch (action) {

      case 'ignore': {
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 422 })
        const ignored = await ignoreDm(id)
        return NextResponse.json({ ok: true, ignored })
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
        return NextResponse.json({ ok: true, requeued })
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
          { error: 'action must be: ignore | requeue | retry_send_failed | takeover | release | block | unblock' },
          { status: 422 }
        )
    }
  } catch (err) {
    console.error('[dm-inbox]', action, err)
    const message = err instanceof Error ? err.message : 'Supabase operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
