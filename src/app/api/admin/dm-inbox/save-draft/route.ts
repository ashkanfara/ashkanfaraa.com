/**
 * POST /api/admin/dm-inbox/save-draft
 *
 * Saves a human-authored or manually-pasted draft to the row and transitions
 * it to PENDING_REVIEW. Used by two flows in the needs_generation card:
 *
 *   draftSource='CLAUDE_MANUAL' — admin pasted the result from Claude.ai
 *   draftSource='HUMAN'         — admin typed the reply directly (Write Reply flow)
 *
 * This route makes ZERO AI calls. It is a pure DB write.
 *
 * INVARIANT: AI MAY DRAFT. AI MAY NOT SEND. HUMAN DECIDES WHAT IS SENT.
 * After this route completes, the row is in PENDING_REVIEW (needs_review CardState)
 * and the human must still explicitly click Approve & Send.
 *
 * Body: { id: string, text: string, draftSource: 'CLAUDE_MANUAL' | 'HUMAN' }
 * Returns: { ok: true } | { ok: false, error: string }
 *
 * Security:
 *   - Admin session cookie required
 *   - Same-Origin validated (CSRF defence)
 *   - Row state verified server-side
 *   - Never sends Instagram
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession, validateSameOrigin } from '@/lib/adminSession'
import { supabaseConfigured } from '@/lib/supabase'

const SUPABASE_BASE = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_HEADERS = () => ({
  apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
  'Content-Type': 'application/json',
})

const ALLOWED_SOURCES = ['CLAUDE_MANUAL', 'HUMAN'] as const
type DraftSource = typeof ALLOWED_SOURCES[number]

const DM_PROMPT_VERSION = process.env.DM_PROMPT_VERSION ?? 'v1'

export async function POST(req: NextRequest) {
  if (!requireAdminSession(req))
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!validateSameOrigin(req))
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  let body: { id?: unknown; text?: unknown; draftSource?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const id          = typeof body.id          === 'string' ? body.id.trim()          : ''
  const text        = typeof body.text        === 'string' ? body.text.trim()        : ''
  const draftSource = typeof body.draftSource === 'string' ? body.draftSource.trim() : ''

  if (!id)   return NextResponse.json({ ok: false, error: 'id is required' }, { status: 422 })
  if (!text) return NextResponse.json({ ok: false, error: 'text is required' }, { status: 422 })
  if (text.length > 1000)
    return NextResponse.json({ ok: false, error: 'Draft too long (max 1000 characters)' }, { status: 422 })
  if (!ALLOWED_SOURCES.includes(draftSource as DraftSource))
    return NextResponse.json({ ok: false, error: `draftSource must be one of: ${ALLOWED_SOURCES.join(', ')}` }, { status: 422 })

  if (!supabaseConfigured())
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })

  const base = SUPABASE_BASE()
  const hdrs = SUPABASE_HEADERS()

  // ── Read row — verify state ──────────────────────────────────
  const rowRes = await fetch(
    `${base}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=id,created_at,failed_reason,processed,processing_started_at,response_sent`,
    { headers: hdrs }
  )
  if (!rowRes.ok)
    return NextResponse.json({ ok: false, error: 'DB read failed' }, { status: 502 })
  const rows = await rowRes.json() as { id: string; created_at: string; failed_reason: string | null; processed: boolean; processing_started_at: string | null; response_sent: boolean }[]
  if (rows.length === 0)
    return NextResponse.json({ ok: false, error: 'Row not found' }, { status: 404 })

  const row = rows[0]

  if (row.response_sent)
    return NextResponse.json({ ok: false, error: 'Message already sent — cannot save draft' }, { status: 409 })

  const isFreshInbound   = row.failed_reason === null && row.processed === false && row.processing_started_at === null
  const isPendingNoDraft = row.failed_reason === 'PENDING_REVIEW'
  if (!isFreshInbound && !isPendingNoDraft)
    return NextResponse.json({ ok: false, error: `Row is not in a pre-draft state (failed_reason=${row.failed_reason})` }, { status: 409 })

  const windowMs = 24 * 60 * 60 * 1000
  if (Date.now() > new Date(row.created_at).getTime() + windowMs)
    return NextResponse.json({ ok: false, error: 'messaging_window_expired' }, { status: 409 })

  // ── Save draft + transition to PENDING_REVIEW ────────────────
  // draftSource: 'CLAUDE_MANUAL_v1' or 'HUMAN_v1' (includes prompt version for traceability)
  const sourceTag = `${draftSource}_${DM_PROMPT_VERSION}`

  const patchRes = await fetch(
    `${base}/rest/v1/instagram_dm_buffer?id=eq.${encodeURIComponent(id)}` +
    `&response_sent=eq.false` +
    (isFreshInbound
      ? `&failed_reason=is.null&processed=eq.false&processing_started_at=is.null`
      : `&failed_reason=eq.PENDING_REVIEW`),
    {
      method:  'PATCH',
      headers: { ...hdrs, Prefer: 'return=representation' },
      body:    JSON.stringify({
        failed_reason:         'PENDING_REVIEW',
        processed:             true,
        processing:            false,
        processing_started_at: new Date().toISOString(),
        response_text:         text,
        draft_source:          sourceTag,
      }),
    }
  )

  if (!patchRes.ok) {
    console.error('[dm-save-draft] PATCH failed:', patchRes.status, await patchRes.text())
    return NextResponse.json({ ok: false, error: 'Failed to save draft' }, { status: 502 })
  }

  const patched = await patchRes.json() as { id: string }[]
  if (patched.length === 0)
    return NextResponse.json({ ok: false, error: 'Row state changed before save — refresh and try again' }, { status: 409 })

  console.log(`[dm-save-draft] ✓ Draft saved | source=${sourceTag} id=${id}`)
  return NextResponse.json({ ok: true })
}
