import { DM_ROUTINE_PROMPT_VERSION } from '@/lib/dm-routine-contract'
/**
 * POST /api/dm-draft-callback
 *
 * Receives a completed draft from the Claude Routine, validates it server-side,
 * then transitions the authoritative instagram_dm_buffer row from
 * DRAFT_GENERATING → PENDING_REVIEW.
 *
 * INVARIANT: This route makes ZERO Instagram sends. It is a pure DB write.
 * After this route completes, the row is in PENDING_REVIEW and the human must
 * still explicitly click Approve & Send.
 *
 * Auth:
 *   Authorization: Bearer <DM_CALLBACK_SECRET>
 *   — constant-time comparison
 *   — not admin-session: caller is the Claude Routine, not a browser
 *   — DM_CALLBACK_SECRET is never logged or returned
 *
 * Expected JSON body:
 *   { buffer_id, sender_id, generation_id, draft_text, prompt_version, draft_source }
 *
 * Returns:
 *   200 { ok: true }                      — accepted + written
 *   200 { ok: true, noop: true }          — idempotent duplicate, no write
 *   400 { ok: false, error: string }      — bad JSON / missing fields
 *   401 { ok: false, error: 'Unauthorized' }
 *   409 { ok: false, error: string }      — stale / superseded / blocked / window closed
 *   422 { ok: false, error: string }      — validation failure
 *   502 { ok: false, error: string }      — DB error
 *   503 { ok: false, error: string }      — env not configured
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseConfigured, archiveWindowClosedSiblingsForSender } from '@/lib/supabase'

const SUPABASE_BASE = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_HEADERS = () => ({
  apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
  'Content-Type': 'application/json',
})

const EXPECTED_PROMPT_VERSION = DM_ROUTINE_PROMPT_VERSION
const EXPECTED_DRAFT_SOURCE   = 'CLAUDE_ROUTINE_v1'
const MAX_DRAFT_LENGTH        = 1000
// ── Auth ─────────────────────────────────────────────────────────────────────

function verifyBearer(req: NextRequest): boolean {
  const secret = process.env.DM_CALLBACK_SECRET
  if (!secret) return false

  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return false
  const provided = authHeader.slice('Bearer '.length)

  // Constant-time comparison — pad both to same length to prevent length-leak
  const buf1 = Buffer.alloc(512, 0)
  const buf2 = Buffer.alloc(512, 0)
  buf1.write(secret,   0, 'utf8')
  buf2.write(provided, 0, 'utf8')
  try {
    return timingSafeEqual(buf1, buf2) && secret === provided
  } catch {
    return false
  }
}

// ── DB row types ──────────────────────────────────────────────────────────────

interface DmRow {
  id:                    string
  sender_id:             string
  created_at:            string
  failed_reason:         string | null
  processed:             boolean
  response_sent:         boolean
  response_text:         string | null
  draft_source:          string | null
  generation_id:         string | null
}

interface ConvState {
  conversation_owner: string | null
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function fetchRow(bufferId: string): Promise<DmRow | null> {
  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(bufferId)}` +
    `&select=id,sender_id,created_at,failed_reason,processed,response_sent,response_text,draft_source,generation_id` +
    `&limit=1`,
    { headers: SUPABASE_HEADERS() }
  )
  if (!res.ok) return null
  const rows = await res.json() as DmRow[]
  return rows[0] ?? null
}

async function isBlocked(senderId: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/dm_blocklist` +
    `?sender_id=eq.${encodeURIComponent(senderId)}` +
    `&select=sender_id&limit=1`,
    { headers: SUPABASE_HEADERS() }
  )
  if (!res.ok) return false
  const rows = await res.json() as { sender_id: string }[]
  return rows.length > 0
}

async function fetchConvState(senderId: string): Promise<ConvState | null> {
  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/conversation_state` +
    `?sender_id=eq.${encodeURIComponent(senderId)}` +
    `&select=conversation_owner&limit=1`,
    { headers: SUPABASE_HEADERS() }
  )
  if (!res.ok) return null
  const rows = await res.json() as ConvState[]
  return rows[0] ?? null
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ───────────────────────────────────────────────────
  if (!verifyBearer(req))
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // ── 2. Parse body ─────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  // ── 3. Field validation ───────────────────────────────────────
  const buffer_id     = typeof body.buffer_id     === 'string' ? body.buffer_id.trim()     : ''
  const sender_id     = typeof body.sender_id     === 'string' ? body.sender_id.trim()     : ''
  const generation_id = typeof body.generation_id === 'string' ? body.generation_id.trim() : ''
  const draft_text    = typeof body.draft_text    === 'string' ? body.draft_text.trim()    : ''
  const prompt_version = typeof body.prompt_version === 'string' ? body.prompt_version.trim() : ''
  const draft_source  = typeof body.draft_source  === 'string' ? body.draft_source.trim()  : ''

  if (!buffer_id)
    return NextResponse.json({ ok: false, error: 'buffer_id is required' }, { status: 422 })
  if (!sender_id)
    return NextResponse.json({ ok: false, error: 'sender_id is required' }, { status: 422 })
  if (!generation_id)
    return NextResponse.json({ ok: false, error: 'generation_id is required' }, { status: 422 })
  if (!draft_text)
    return NextResponse.json({ ok: false, error: 'draft_text is required' }, { status: 422 })
  if (draft_text.length > MAX_DRAFT_LENGTH)
    return NextResponse.json({ ok: false, error: `draft_text too long (max ${MAX_DRAFT_LENGTH} chars)` }, { status: 422 })
  if (prompt_version !== EXPECTED_PROMPT_VERSION)
    return NextResponse.json({ ok: false, error: `Unexpected prompt_version: ${prompt_version}` }, { status: 422 })
  if (draft_source !== EXPECTED_DRAFT_SOURCE)
    return NextResponse.json({ ok: false, error: `Unexpected draft_source: ${draft_source}` }, { status: 422 })

  // ── 4. Env check ──────────────────────────────────────────────
  if (!supabaseConfigured())
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })

  // ── 5. Load authoritative row ─────────────────────────────────
  const row = await fetchRow(buffer_id)
  if (!row)
    return NextResponse.json({ ok: false, error: 'Row not found' }, { status: 409 })

  // ── 6. sender_id must match authoritative row (do NOT trust callback) ──
  if (row.sender_id !== sender_id)
    return NextResponse.json({ ok: false, error: 'sender_id mismatch' }, { status: 409 })

  // ── 7. generation_id must match (stale result if not) ─────────
  if (row.generation_id !== generation_id)
    return NextResponse.json({ ok: false, error: 'Stale callback — generation_id mismatch' }, { status: 409 })

  // ── 8. Duplicate detection ────────────────────────────────────
  // If the row is already PENDING_REVIEW with the same generation_id, this is an
  // idempotent re-delivery. Return success without writing again.
  if (
    row.failed_reason === 'PENDING_REVIEW' &&
    row.generation_id === generation_id &&
    row.draft_source  === EXPECTED_DRAFT_SOURCE
  ) {
    console.log(`[dm-draft-callback] Duplicate callback — already PENDING_REVIEW | buffer_id=${buffer_id}`)
    return NextResponse.json({ ok: true, noop: true })
  }

  // ── 9. response_sent guard ────────────────────────────────────
  if (row.response_sent)
    return NextResponse.json({ ok: false, error: 'Message already sent — cannot overwrite' }, { status: 409 })

  // ── 10. State must still be DRAFT_GENERATING ──────────────────
  // Any other state means something superseded this generation:
  // a human wrote a draft, a retry was triggered, or a newer inbound arrived.
  if (row.failed_reason !== 'DRAFT_GENERATING')
    return NextResponse.json({
      ok:    false,
      error: `Row is no longer in DRAFT_GENERATING state (current: ${row.failed_reason})`,
    }, { status: 409 })

  // ── 11. Blocklist check ───────────────────────────────────────
  const blocked = await isBlocked(row.sender_id)
  if (blocked)
    return NextResponse.json({ ok: false, error: 'Sender is blocked' }, { status: 409 })

  // ── 13. human_temp takeover check ────────────────────────────
  const convState = await fetchConvState(row.sender_id)
  if (convState?.conversation_owner === 'human_temp')
    return NextResponse.json({ ok: false, error: 'Conversation is under human takeover' }, { status: 409 })

  // ── 14. Conditional PATCH (optimistic concurrency) ───────────
  // WHERE includes generation_id + failed_reason to guard against concurrent writes.
  // If 0 rows are patched, state changed between our read and this write → reject.
  const patchRes = await fetch(
    `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(buffer_id)}` +
    `&generation_id=eq.${encodeURIComponent(generation_id)}` +
    `&failed_reason=eq.DRAFT_GENERATING` +
    `&response_sent=eq.false`,
    {
      method:  'PATCH',
      headers: { ...SUPABASE_HEADERS(), Prefer: 'return=representation' },
      body:    JSON.stringify({
        response_text:         draft_text,
        draft_source:          EXPECTED_DRAFT_SOURCE,
        failed_reason:         'PENDING_REVIEW',
        processed:             true,
        processing:            false,
        processing_started_at: null,
        response_sent:         false,
        // generation_id is intentionally NOT cleared — preserved for idempotency detection
      }),
    }
  )

  if (!patchRes.ok) {
    console.error('[dm-draft-callback] PATCH failed:', patchRes.status, await patchRes.text())
    return NextResponse.json({ ok: false, error: 'Failed to save draft' }, { status: 502 })
  }

  const patched = await patchRes.json() as { id: string }[]
  if (patched.length === 0) {
    console.warn(`[dm-draft-callback] Optimistic concurrency: 0 rows patched | buffer_id=${buffer_id}`)
    return NextResponse.json({
      ok:    false,
      error: 'Row state changed before draft could be written — stale callback',
    }, { status: 409 })
  }

  console.log(
    `[dm-draft-callback] ✓ Draft accepted | buffer_id=${buffer_id} ` +
    `generation_id=${generation_id} source=${EXPECTED_DRAFT_SOURCE}`
  )

  // A new inbound was received and a draft is ready — this implies the sender messaged again,
  // which means the Instagram messaging window has reopened. Archive any window-closed siblings
  // so they don't clutter the inbox. Fire-and-forget; non-fatal.
  archiveWindowClosedSiblingsForSender(row.sender_id, buffer_id).catch(e =>
    console.error('[dm-draft-callback] archive window-closed siblings failed (non-fatal):', e)
  )

  return NextResponse.json({ ok: true })
}
