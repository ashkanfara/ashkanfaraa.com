/**
 * GET  /api/admin/manual-dm-control  — list all DM access rules.
 * POST /api/admin/manual-dm-control
 *
 * Backs the "DM Access Control" admin section: a single unified rules table
 * (dm_access_rules) keyed by instagram_handle, covering both people who have
 * already DM'd (sender_id known — "Known user") and people who haven't yet
 * ("Username rule" — sender_id null, resolved automatically once known).
 *
 * Whenever a rule's status is 'blocked' and sender_id is known, it is also
 * mirrored into the legacy dm_blocklist table (and removed from it when the
 * status changes away from 'blocked' or the rule is deleted), so any
 * existing automation that only checks dm_blocklist keeps working unchanged.
 *
 * Fails gracefully if dm_access_rules doesn't exist yet: GET returns an
 * empty/legacy-only list instead of erroring; POST returns a clear error
 * telling the admin the migration hasn't been run.
 *
 * Protected by HttpOnly session cookie (admin_session).
 * Supabase service key is server-only.
 *
 * GET response: { rules: Row[] }
 *   Row: {
 *     handle:    string | null   (null only for legacy dm_blocklist-only rows with no handle on record)
 *     senderId:  string | null
 *     status:    'ai_allowed' | 'human_only' | 'blocked'
 *     notes:     string | null
 *     createdAt: string | null
 *     updatedAt: string | null
 *     legacy:    boolean         (true = mirrored from dm_blocklist, no dm_access_rules row exists)
 *   }
 *
 * POST body:
 *   { action: 'set-status', handle: string, status: AccessStatus, notes?: string }
 *   { action: 'remove',     handle?: string, senderId?: string }
 *     (remove takes handle when removing a real rule; senderId when removing
 *      a legacy dm_blocklist-only row that has no handle on record)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeHandle, supabaseConfigured,
  lookupSenderIdByUsername,
  listAccessRules, upsertAccessRule, removeAccessRule,
  listBlockedSenders, blockSender, unblockSender,
  type AccessStatus,
} from '@/lib/supabase'

const VALID_STATUSES = new Set<AccessStatus>(['ai_allowed', 'human_only', 'blocked'])

import { requireAdminSession, unauthorized, validateSameOrigin } from '@/lib/adminSession'

export async function GET(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured on this server.' }, { status: 503 })
  }

  const rules = await listAccessRules() // [] if table not created yet — fails soft
  const knownSenderIds = new Set(rules.map(r => r.senderId).filter(Boolean))

  // Legacy dm_blocklist rows not yet represented in dm_access_rules — keep
  // them visible so nothing already blocked silently disappears.
  const legacyBlocked = await listBlockedSenders()
  const legacyOnly = legacyBlocked
    .filter(b => !knownSenderIds.has(b.senderId))
    .map(b => ({
      handle:    b.name,
      senderId:  b.senderId,
      status:    'blocked' as const,
      notes:     'Legacy block — no username on record',
      createdAt: null,
      updatedAt: null,
      legacy:    true,
    }))

  const combined = [
    ...rules.map(r => ({
      handle:    r.handle,
      senderId:  r.senderId,
      status:    r.status,
      notes:     r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      legacy:    false,
    })),
    ...legacyOnly,
  ]

  return NextResponse.json({ rules: combined })
}

export async function POST(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()
  if (!validateSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured on this server.' }, { status: 503 })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body

  try {
    // ── set-status ────────────────────────────────────────────
    if (action === 'set-status') {
      const { handle: rawHandle, status, notes } = body

      if (!rawHandle?.trim()) {
        return NextResponse.json({ error: 'handle is required' }, { status: 422 })
      }
      if (!VALID_STATUSES.has(status as AccessStatus)) {
        return NextResponse.json(
          { error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` },
          { status: 422 }
        )
      }

      const handle   = normalizeHandle(rawHandle)
      const senderId = await lookupSenderIdByUsername(handle)

      await upsertAccessRule({ handle, senderId, status: status as AccessStatus, notes })

      // Mirror into dm_blocklist for backward compatibility — only possible
      // once sender_id is known.
      if (senderId) {
        if (status === 'blocked') await blockSender(senderId, handle)
        else await unblockSender(senderId)
      }

      return NextResponse.json({ ok: true, handle, senderId, status })
    }

    // ── remove ────────────────────────────────────────────────
    if (action === 'remove') {
      const { handle: rawHandle, senderId: rawSenderId } = body

      if (rawHandle?.trim()) {
        const handle  = normalizeHandle(rawHandle)
        const deleted = await removeAccessRule(handle)
        if (deleted?.senderId) await unblockSender(deleted.senderId)
        return NextResponse.json({ ok: true, handle })
      }

      if (rawSenderId?.trim()) {
        // Legacy dm_blocklist-only row — no dm_access_rules counterpart.
        await unblockSender(rawSenderId)
        return NextResponse.json({ ok: true, senderId: rawSenderId })
      }

      return NextResponse.json({ error: 'handle or senderId is required' }, { status: 422 })
    }

    return NextResponse.json({ error: 'action must be set-status or remove' }, { status: 422 })
  } catch (err) {
    console.error('[manual-dm-control]', err)
    const message = err instanceof Error ? err.message : 'Supabase operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
