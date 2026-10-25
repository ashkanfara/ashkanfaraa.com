import { DM_ROUTINE_PROMPT_VERSION } from '@/lib/dm-routine-contract'
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
import { assembleDmConversationHistory } from '@/lib/dm-conversation-context'

const SUPABASE_BASE    = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_HEADERS = () => ({
  apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
  'Content-Type': 'application/json',
})

const DM_PROMPT_VERSION = DM_ROUTINE_PROMPT_VERSION

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

// HistoryRow removed — fetchHistory replaced by assembleDmConversationHistory
// from dm-conversation-context, which uses dm_response_feedback (canonical source)
// with bounded truncation. Regen and n8n ordinary-draft now share the same source.

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

// fetchHistory removed — replaced by assembleDmConversationHistory(senderId) below.

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

async function fetchSiblingGenerating(senderId: string, excludeId: string): Promise<{ generation_id: string } | null> {
  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
    `?sender_id=eq.${encodeURIComponent(senderId)}&id=neq.${encodeURIComponent(excludeId)}` +
    `&failed_reason=eq.DRAFT_GENERATING&response_sent=eq.false` +
    `&select=generation_id&limit=1`,
    { headers: SUPABASE_HEADERS() }
  )
  if (!res.ok) return null
  const rows = await res.json() as { generation_id: string }[]
  return rows[0] ?? null
}

async function fetchSavedContactNotes(senderId: string): Promise<string> {
  // History sources are single-account; contact notes have an explicit account key.
  const res = await fetch(`${SUPABASE_BASE()}/rest/v1/dm_contact_notes` +
    `?sender_id=eq.${encodeURIComponent(senderId)}&ig_account_id=eq.default` +
    '&select=sender_id,ig_account_id,notes&limit=1', { headers: SUPABASE_HEADERS() })
  if (!res.ok) throw new Error(`Contact notes unavailable: HTTP ${res.status}`)
  const rows = await res.json() as { sender_id: string; ig_account_id: string; notes: string }[]
  if (!Array.isArray(rows) || rows.some(r => r.sender_id !== senderId || r.ig_account_id !== 'default'))
    throw new Error('Contact notes scope mismatch')
  return rows[0]?.notes?.trim() || ''
}

async function fetchPendingInbound(senderId: string, excludeId: string): Promise<PendingRow[]> {
  const all: PendingRow[] = []
  let offset = 0
  for (;;) {
    const res = await fetch(`${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
      `?sender_id=eq.${encodeURIComponent(senderId)}&id=neq.${encodeURIComponent(excludeId)}` +
      '&response_sent=eq.false' +
      '&or=(failed_reason.is.null,failed_reason.eq.PENDING_REVIEW,failed_reason.eq.DRAFT_FAILED,failed_reason.eq.DRAFT_GENERATING)' +
      '&select=id,message_text,message_type,created_at,is_story_reply,story_id,failed_reason,processed' +
      `&order=created_at.asc,id.asc&limit=200&offset=${offset}`,
      { headers: { ...SUPABASE_HEADERS(), Prefer: 'count=exact' } })
    if (!res.ok) throw new Error(`DM pending context fetch failed: HTTP ${res.status}`)
    const page = await res.json() as PendingRow[]
    if (!Array.isArray(page)) throw new Error('Invalid pending context page')
    all.push(...page)
    offset += page.length
    const total = res.headers.get('content-range')?.split('/')[1]
    if (page.length === 0 || (total && total !== '*' && offset >= Number(total))) break
  }
  return all.filter(r => !(r.failed_reason === null && r.processed === true))
}

// ── Main handler ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Admin auth ─────────────────────────────────────────────────────────────
  if (!requireAdminSession(req))
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!validateSameOrigin(req))
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  // ── 2. Parse body ────────────────────────────────────────────────────────────
  let body: { id?: unknown; contact_notes?: unknown; feedback?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const id            = typeof body.id            === 'string' ? body.id.trim()            : ''
  // contact_notes: saved facts about this contact (do not re-ask questions answered here)
  const suppliedContactNotes  = typeof body.contact_notes === 'string' ? body.contact_notes.trim() : ''
  // feedback: one-time guidance for this regeneration only, not stored
  const feedback      = typeof body.feedback      === 'string' ? body.feedback.trim()      : ''
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
  // Admin regeneration from PENDING_REVIEW goes directly PENDING_REVIEW → DRAFT_GENERATING
  // without touching processed=false, so n8n can never claim it as fresh inbound.
  const isPendingReview    = row.failed_reason === 'PENDING_REVIEW'

  if (!isFreshInbound && !isDraftFailed && !isDraftGenerating && !isPendingReview)
    return NextResponse.json({ ok: false, error: `Row is not in a retryable state (failed_reason=${row.failed_reason})` }, { status: 409 })

  // ── 4b. Idempotency guard: if a sibling for this sender is already generating, return noop ──
  // Prevents duplicate Routine fires when multiple DRAFT_FAILED rows exist for one sender.
  // When the caller explicitly re-retries a row that is already DRAFT_GENERATING (isDraftGenerating),
  // we allow it to supersede — so only check siblings in the normal DRAFT_FAILED path.
  if (!isDraftGenerating) {
    const sibling = await fetchSiblingGenerating(row.sender_id, id)
    if (sibling) {
      console.log(`[retry-draft] noop — sibling already generating | sender=${row.sender_id} sibling_gen=${sibling.generation_id}`)
      return NextResponse.json({ ok: true, status: 'already_generating', noop: true, generationId: sibling.generation_id })
    }
  }

  // ── 5. Generate new UUID + atomically claim DRAFT_GENERATING ──
  const generationId = randomUUID()

  const claimWhere = isFreshInbound
    ? `&failed_reason=is.null&processed=eq.false&processing_started_at=is.null`
    : isDraftFailed
      ? `&failed_reason=eq.DRAFT_FAILED`
      : isPendingReview
        ? `&failed_reason=eq.PENDING_REVIEW`
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
        admin_regen:           true,
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
  // assembleDmConversationHistory uses dm_response_feedback (canonical source) with
  // bounded truncation — same source as n8n BRP after the n8n context patch is applied.
  // This unifies the context path for ordinary drafts and regeneration.
  let context: [string, StoryCtx | null, PendingRow[], string]
  try {
    context = await Promise.all([
    assembleDmConversationHistory(row.sender_id),
    row.is_story_reply && row.story_id ? fetchStoryCtx(row.story_id) : Promise.resolve(null),
    fetchPendingInbound(row.sender_id, id),
    fetchSavedContactNotes(row.sender_id),
  ])
  } catch {
    // Release only this synthetic/current generation's claim, never a newer callback's claim.
    await fetch(`${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
      `?id=eq.${encodeURIComponent(id)}&generation_id=eq.${encodeURIComponent(generationId)}`,
      { method: 'PATCH', headers: SUPABASE_HEADERS(), body: JSON.stringify({
        failed_reason: row.failed_reason, generation_id: null,
        processed: row.processed, processing: false,
        processing_started_at: row.processing_started_at,
      }) }).catch(() => {})
    return NextResponse.json({ ok: false, error: 'Conversation context unavailable; retry generation' }, { status: 502 })
  }
  const [conversationHistory, storyCtx, pendingRows, savedContactNotes] = context
  const contactNotes = suppliedContactNotes || savedContactNotes

  // combined_message: all pending messages in chronological order + the current row.
  // Bundle instruction is prepended so the AI addresses the full conversation as one reply.
  const allRows = [...pendingRows, row].sort((a, b) =>
    Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id))
  const seen = new Set<string>()
  const allTexts = allRows.filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  }).map(r => (r.is_story_reply ? '[پاسخ به استوری] ' : '') +
    (r.message_text || `[پیام ${r.message_type}]`))
  const bundleNote = allTexts.length > 1
    ? `[BUNDLE: ${allTexts.length} consecutive messages — respond to all as ONE reply]\n`
    : ''
  const combinedMessage = bundleNote + allTexts.join('\n')

  // ── 7. Fire Claude Routine trigger ────────────────────────────────────────────
  const triggerPayload: Record<string, unknown> = {
    buffer_id:            id,
    sender_id:            row.sender_id,
    generation_id:        generationId,
    prompt_version:       DM_PROMPT_VERSION,
    message_text:         row.message_text ?? '',
    combined_message:     combinedMessage,
    bundle_size:          allTexts.length,
    is_story_reply:       row.is_story_reply ?? false,
    is_story_mention:     false,
    story_context:        storyCtx,
    conversation_history: conversationHistory,
    user_record: {
      migration_assistance_link_sent: false,
      course_link_sent:               false,
      consultation_link_sent:         false,
    },
  }
  // Include contact_notes and feedback only when non-empty, so the Routine
  // ignores absent fields and existing prompts remain unchanged.
  if (contactNotes) triggerPayload.contact_notes = contactNotes
  if (feedback)     triggerPayload.feedback       = feedback

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
  // If we started from PENDING_REVIEW, roll back there so the existing draft remains
  // visible and actionable. Other starting states roll back to DRAFT_FAILED.
  if (!triggerOk) {
    const rollbackReason = isPendingReview ? 'PENDING_REVIEW' : 'DRAFT_FAILED'
    await fetch(
      `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
      `?id=eq.${encodeURIComponent(id)}&generation_id=eq.${encodeURIComponent(generationId)}`,
      {
        method:  'PATCH',
        headers: SUPABASE_HEADERS(),
        body:    JSON.stringify({
          failed_reason:         rollbackReason,
          generation_id:         null,
          processed:             true,
          processing:            false,
          processing_started_at: null,
        }),
      }
    ).catch(e => console.error('[retry-draft] Rollback failed:', e))
    return NextResponse.json({ ok: false, error: `Failed to reach Claude Routine — row reverted to ${rollbackReason}` }, { status: 502 })
  }

  console.log(`[retry-draft] ✓ Routine triggered | id=${id} generation_id=${generationId}`)
  return NextResponse.json({ ok: true, status: 'generating', generationId })
  }
