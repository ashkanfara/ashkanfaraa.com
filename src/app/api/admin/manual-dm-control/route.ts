/**
 * POST /api/admin/manual-dm-control
 *
 * Three actions on a manually-entered Instagram handle:
 *   set-human  — upsert consultation_leads with dm_mode=Human + sender_id if known
 *   block      — add sender_id to dm_blocklist (requires sender_id from instagram_users)
 *   unblock    — remove sender_id from dm_blocklist
 *
 * Protected by Authorization: Bearer ADMIN_SECRET.
 * Supabase service key is server-only.
 *
 * Body: { action: 'set-human'|'block'|'unblock', handle: string }
 */

import { NextRequest, NextResponse }                         from 'next/server'
import { normalizeHandle, supabaseConfigured,
         lookupSenderIdByUsername, upsertLeadDmMode,
         blockSender, unblockSender }                        from '@/lib/supabase'

const VALID_ACTIONS = new Set(['set-human', 'block', 'unblock'])

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured on this server.' }, { status: 503 })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, handle: rawHandle } = body

  if (!rawHandle?.trim()) {
    return NextResponse.json({ error: 'handle is required' }, { status: 422 })
  }
  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${[...VALID_ACTIONS].join(', ')}` },
      { status: 422 }
    )
  }

  const handle   = normalizeHandle(rawHandle)
  const senderId = await lookupSenderIdByUsername(handle)

  try {
    // ── set-human ─────────────────────────────────────────────
    if (action === 'set-human') {
      await upsertLeadDmMode(handle, 'Human', senderId)

      if (senderId) {
        return NextResponse.json({
          ok:      true,
          status:  'paused',
          senderId,
          message: 'AI set to Human. Sender ID resolved — takes effect immediately.',
        })
      } else {
        return NextResponse.json({
          ok:      true,
          status:  'pre-paused',
          senderId: null,
          message: 'Pre-paused. AI will stop once this user next DMs and their username is resolved.',
        })
      }
    }

    // ── block ──────────────────────────────────────────────────
    if (action === 'block') {
      if (!senderId) {
        return NextResponse.json({
          ok:      false,
          status:  'no-sender-id',
          message: "Cannot hard-block yet — user hasn't DM'd or username wasn't captured. Use Set Human instead.",
        })
      }
      await blockSender(senderId, handle)
      return NextResponse.json({ ok: true, status: 'blocked', senderId })
    }

    // ── unblock ────────────────────────────────────────────────
    if (action === 'unblock') {
      if (!senderId) {
        return NextResponse.json({
          ok:      false,
          status:  'no-sender-id',
          message: 'No sender ID found — cannot locate blocklist entry.',
        })
      }
      await unblockSender(senderId)
      return NextResponse.json({ ok: true, status: 'unblocked', senderId })
    }
  } catch (err) {
    console.error('[manual-dm-control]', err)
    return NextResponse.json({ error: 'Supabase operation failed' }, { status: 500 })
  }

  return NextResponse.json({ error: 'Unhandled action' }, { status: 500 })
}
