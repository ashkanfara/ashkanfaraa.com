/**
 * POST /api/admin/dm-inbox/retry-draft
 *
 * Transitions a failed-generation row to DRAFT_GENERATING and fires the
 * Claude Max Routine to generate a new draft asynchronously.
 *
 * This route makes ZERO direct Anthropic API calls.
 * The Routine calls back to /api/dm-draft-callback when done.
 * Nothing is sent to Instagram.
 *
 * Flow:
 *   1. Validate admin session + same-origin
 *   2. Load + validate row state
 *   3. Generate new UUID as generation_id
 *   4. Atomically PATCH row → DRAFT_GENERATING (conditional write)
 *   5. Build DM context from DB
 *   6. POST to Claude Routine trigger URL with context
 *   7. On trigger failure: PATCH back to DRAFT_FAILED + return error
 *   8. Return { ok: true, status: 'generating' } immediately (async)
 *
 * Accepted input states: DRAFT_FAILED, null/false (needs_generation),
 * or DRAFT_GENERATING (for re-retry after timeout).
 *
 * Required env vars:
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   CLAUDE_ROUTINE_TRIGGER_URL  — HTTP trigger URL for the Claude Routine
 *   CLAUDE_ROUTINE_TRIGGER_TOKEN — Bearer token to auth with the Routine
 *
 * Security:
 *   - Admin session cookie required
 *   - Same-Origin validated (CSRF defence)
 *   - CLAUDE_ROUTINE_TRIGGER_TOKEN never logged or returned
 *   - Never sends Instagram
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID }                from 'crypto'
import { requireAdminSession, validateSameOrigin } from '@/lib/adminSession'
import { supabaseConfigured }        from '@/lib/supabase'

const SUPABASE_BASE    = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_HEADERS = () => ({
  apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
  'Content-Type': 'application/json',
})

const DM_PROMPT_VERSION = '2026-09-03-v1'
const WINDOW_MS         = 24 * 60 * 60 * 1000

// ── Row types ─────────────────────────────────────────────────────────────────────────────────

interface DmRow {
  id:                    string
  sender_id:             string
  message_text:          string | null
  message_type:          string
  created_at:            string
  failed_reason:         string | null
  processed:             boolean
  processing_started_at: string | null
  response_sent:         boolean
  is_story_reply:        boolean
  story_id:              string | null
  generation_id:         string | null
}

interface StoryCtx {
  story_id:       string
  media_type:     string | null
  media_url:      string | null
  caption:        string | null
  ai_description: string | null
  ocr_text:       string | null
}

interface HistoryRow {
  message_text:       string | null
  final_response_text: string | null
  created_at:         string
}

interface PendingRow {
  id:             string
  message_text:   string | null
  message_type:   string
  created_at:     string
  is_story_reply: boolean
  story_id:       string | null
  failed_reason:  string | null
  processed:      boolean
}

// ── DB helpers ────────────────────────────────────────────────────────────────────────────

async function fetchRow(id: string): Promise<DmRow | null> {
  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=id,sender_id,message_text,message_type,created_at,failed_reason,` +
    `processed,processing_started_at,response_sent,is_story_reply,story_id,generation_id&limit=1`,
    { headers: SUPABASE_HEADERS() }
  )
  if (!res.ok) return null
  const rows = await res.json() as DmRow[]
  return rows[0] ?? null
}

async function fetchHistory(senderId: string): Promise<HistoryRow[]> {
  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
    `?sender_id=eq.${encodeURIComponent(senderId)}&response_sent=eq.true` +
    `&select=message_text,final_response_text,created_at&order=created_at.desc&limit=8`,
    { headers: SUPABASE_HEADERS() }
  )
  return res.ok ? res.json() : []
}

async function fetchStoryCtx(storyId: string): Promise<StoryCtx | null> {
  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/story_context` +
    `?story_id=eq.${encodeURIComponent(storyId)}&select=story_id,media_type,media_url,caption,ai_description,ocr_text&limit=1`,
    { headers: SUPABASE_HEADERS() }
  )
  if (!res.ok) return null
  const rows = await res.json() as StoryCtx[]
  return rows[0] ?? null
}

async function fetchPendingInbound(senderId: string, excludeId: string): Promise<PendingRow[]> {
  const cutoff = new Date(Date.now() - WINDOW_MS).toISOString()
  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
    `?sender_id=eq.${encodeURIComponent(senderId)}&id=neq.${encodeURIComponent(excludeId)}` +
    `&response_sent=eq.false&or=(failed_reason.is.null,failed_reason.eq.PENDING_REVIEW)` +
    `&created_at=gt.${encodeURIComponent(cutoff)}&select=id,message_text,message_type,` +
    `created_at,is_story_reply,story_id,failed_reason,processed&order=created_at.asc&limit=10`,
    { headers: SUPABASE_HEADERS() }
  )
  if (!res.ok) return []
  const rows = await res.json() as PendingRow[]
  return rows.filter(r => !(r.failed_reason === null && r.processed === true)).slice(0, 5)
}

// ── Main handler ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Admin auth ─────────────────────────────────────────────────────────────
  if (!requireAdminSession(req))
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!validateSameOrigin(req))
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  // ── 2. Parse body ────────────────────────────────────────────────────────────
  let body: { id?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!id) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 422 })

  // ── 3. Env check ─────────────────────────────────────────────────────────────
  if (!supabaseConfigured())
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })

  const routineTriggerUrl   = process.env.CLAUDE_ROUTINE_TRIGGER_URL
  const routineTriggerToken = process.env.CLAUDE_ROUTINE_TRIGGER_TOKEN
  if (!routineTriggerUrl || !routineTriggerToken)
    return NextResponse.json({ ok: false, error: 'CLAUDE_ROUTINE_TRIGGER_URL / _TOKEN not configured' }, { status: 503 })

  // ── 4. Load row ───────────────────────────────────────────────────────────────
  const row = await fetchRow(id)
  if (!row) return NextResponse.json({ ok: false, error: 'Row not found' }, { status: 404 })

  if (row.response_sent)
    return NextResponse.json({ ok: false, error: 'Message already sent' }, { status: 409 })

  const isFreshInbound     = row.failed_reason === null && row.processed === false && row.processing_started_at === null
  const isDraftFailed      = row.failed_reason === 'DRAFT_FAILED'
  const isDraftGenerating  = row.failed_reason === 'DRAFT_GENERATING'

  if (!isFreshInbound && !isDraftFailed && !isDraftGenerating)
    return NextResponse.json({ ok: false, error: `Row is not in a retryable state (failed_reason=${row.failed_reason})` }, { status: 409 })

  if (Date.now() > new Date(row.created_at).getTime() + WINDOW_MS)
    return NextResponse.json({ ok: false, error: 'messaging_window_expired' }, { status: 409 })

  // ── 5. Generate new UUID + atomically claim DRAFT_GENERATING ──
  const generationId = randomUUID()

  const claimWhere = isFreshInbound
    ? `&failed_reason=is.null&processed=eq.false&processing_started_at=is.null`
    : isDraftFailed
      ? `&failed_reason=eq.DRAFT_FAILED`
      : `&failed_reason=eq.DRAFT_GENERATING` // re-retry: supersedes old generation_id

  const claimRes = await fetch(
    `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(id)}&response_sent=eq.false${claimWhere}`,
    {
      method:  'PATCH',
      headers: { ...SUPABASE_HEADERS(), Prefer: 'return=representation' },
      body:    JSON.stringify({
        failed_reason:         'DRAFT_GENERATING',
        generation_id:         generationId,
        processed:             true,
        processing:            true,
        processing_started_at: new Date().toISOString(),
      }),
    }
  )

  if (!claimRes.ok) {
    console.error('[retry-draft] PATCH claim failed:', claimRes.status, await claimRes.text())
    return NextResponse.json({ ok: false, error: 'Failed to claim row for generation' }, { status: 502 })
  }
  const claimed = await claimRes.json() as { id: string }[]
  if (claimed.length === 0)
    return NextResponse.json({ ok: false, error: 'Row state changed — refresh and try again' }, { status: 409 })

  // ── 6. Build DM context from DB ───────────────────────────────────────────────
  const [historyRows, storyCtx, pendingRows] = await Promise.all([
    fetchHistory(row.sender_id),
    row.is_story_reply && row.story_id ? fetchStoryCtx(row.story_id) : Promise.resolve(null),
    fetchPendingInbound(row.sender_id, id),
  ])

  // Build messages array (Anthropic Messages format)
  type Msg = { role: 'user' | 'assistant'; content: string }
  const messages: Msg[] = []
  for (const h of [...historyRows].reverse()) {
    if (h.message_text)          messages.push({ role: 'user',      content: h.message_text })
    if (h.final_response_text)   messages.push({ role: 'assistant', content: h.final_response_text })
  }
  for (const p of pendingRows) {
    const parts: string[] = []
    if (p.is_story_reply) parts.push('[پاسخ به استوری]')
    if (p.message_text)   parts.push(p.message_text)
    else                  parts.push(`[پیام ${p.message_type}]`)
    messages.push({ role: 'user', content: parts.join(' ') })
  }
  const currentParts: string[] = []
  if (row.is_story_reply) currentParts.push('[پاسخ به استوری]')
  if (row.message_text)   currentParts.push(row.message_text)
  else                    currentParts.push(`[پیام ${row.message_type}]`)
  if (storyCtx) {
    if (storyCtx.caption)        currentParts.push(`\n[کپشن استوری: ${storyCtx.caption}]`)
    if (storyCtx.ai_description) currentParts.push(`[توضیح هوش مصنوعی: ${storyCtx.ai_description}]`)
    if (storyCtx.ocr_text)       currentParts.push(`[متن تصویر: ${storyCtx.ocr_text}]`)
  }
  messages.push({ role: 'user', content: currentParts.join(' ') })

  // ── 7. Fire Claude Routine trigger ────────────────────────────────────────────
  const triggerPayload = {
    buffer_id:      id,
    sender_id:      row.sender_id,
    generation_id:  generationId,
    prompt_version: DM_PROMPT_VERSION,
    messages,
    story_context:  storyCtx,
  }

  let triggerOk = false
  try {
    const triggerRes = await fetch(routineTriggerUrl, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization': `Bearer ${routineTriggerToken}`,
        'anthropic-beta': 'experimental-cc-routine-2026-04-01',
        'anthropic-version': '2023-06-01',
      },
      // Anthropic Routines API expects {"text": "<string payload>"}
      body:   JSON.stringify({ text: JSON.stringify(triggerPayload) }),
      signal: AbortSignal.timeout(15_000),
    })
    triggerOk = triggerRes.ok
    if (!triggerOk) {
      const body = await triggerRes.text()
      console.error('[retry-draft] Routine trigger failed:', triggerRes.status, body)
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    console.error('[retry-draft] Routine trigger error:', isTimeout ? 'timeout(15s)' : err)
  }

  // ── 8. Rollback on trigger failure ────────────────────────────────────────────
  if (!triggerOk) {
    await fetch(
      `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
      `?id=eq.${encodeURIComponent(id)}&generation_id=eq.${encodeURIComponent(generationId)}`,
      {
        method:  'PATCH',
        headers: SUPABASE_HEADERS(),
        body:    JSON.stringify({
          failed_reason:         'DRAFT_FAILED',
          generation_id:         null,
          processed:             true,
          processing:            false,
          processing_started_at: null,
        }),
      }
    ).catch(e => console.error('[retry-draft] Rollback failed:', e))
    return NextResponse.json({ ok: false, error: 'Failed to reach Claude Routine — row reverted to DRAFT_FAILED' }, { status: 502 })
  }

  console.log(`[retry-draft] ✓ Routine triggered | id=${id} generation_id=${generationId}`)
  return NextResponse.json({ ok: true, status: 'generating', generationId })
  }
