/**
 * GET  /api/admin/consultation/blocklist  — list all dm_blocklist rows.
 * POST /api/admin/consultation/blocklist
 *
 * Blocks or unblocks a consultation applicant in dm_blocklist.
 * Looks up sender_id from consultation_leads by instagram_handle, unless
 * senderId is passed directly in the body (reliable key, skips the lookup —
 * used by the Blocked People table, which already has sender_id).
 * Protected by HttpOnly session cookie (admin_session).
 * Supabase service key is server-only.
 *
 * Body: {
 *   action          'block' | 'unblock'
 *   instagramHandle string   (raw — will be normalized) — required unless senderId is given
 *   senderId        string   (optional — takes priority over instagramHandle for unblock)
 *   name            string   (used as display name on block insert)
 * }
 */

import { NextRequest, NextResponse }                      from 'next/server'
import { normalizeHandle, supabaseConfigured,
         blockSender, unblockSender, listBlockedSenders }  from '@/lib/supabase'
import { requireAdminSession, unauthorized, validateSameOrigin } from '@/lib/adminSession'

export async function GET(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured on this server.' }, { status: 503 })
  }

  const blocked = await listBlockedSenders()
  return NextResponse.json({ blocked })
}

async function getSenderId(instagramHandle: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL!.replace(/\/$/, '')
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const res  = await fetch(
    `${url}/rest/v1/consultation_leads?instagram_handle=eq.${encodeURIComponent(instagramHandle)}&select=sender_id`,
    {
      headers: {
        apikey:        key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    }
  )
  if (!res.ok) return null
  const rows = await res.json() as { sender_id: string | null }[]
  return rows[0]?.sender_id ?? null
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

  const { action, instagramHandle, senderId: directSenderId, name } = body

  if (!action || (!instagramHandle && !directSenderId)) {
    return NextResponse.json({ error: 'action and (instagramHandle or senderId) are required' }, { status: 422 })
  }
  if (action !== 'block' && action !== 'unblock') {
    return NextResponse.json({ error: 'action must be block or unblock' }, { status: 422 })
  }

  // senderId is the reliable key — use it directly when provided (e.g. from
  // the Blocked People table) instead of re-resolving via instagram_handle.
  const handle   = instagramHandle ? normalizeHandle(instagramHandle) : null
  const senderId = directSenderId || (handle ? await getSenderId(handle) : null)

  if (!senderId) {
    return NextResponse.json(
      { error: 'No sender_id found — person has not DM\'d yet and cannot be blocked.' },
      { status: 422 }
    )
  }

  try {
    if (action === 'block') {
      await blockSender(senderId, name || handle || senderId)
    } else {
      await unblockSender(senderId)
    }
  } catch (err) {
    console.error('[blocklist]', err)
    return NextResponse.json({ error: 'Supabase operation failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action, senderId })
}
