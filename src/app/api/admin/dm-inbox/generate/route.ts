/**
 * POST /api/admin/dm-inbox/generate
 *
 * Two modes — distinguished by `mode` in the request body:
 *
 *  mode='claude'  — ZERO Anthropic API call.
 *                   Builds the canonical prompt package server-side and returns it.
 *                   The admin copies it into Claude.ai manually.
 *                   Works with no ANTHROPIC_API_KEY.
 *                   Returns: { ok: true, promptPackage: string }
 *
 *  mode='api'     — ONE Anthropic API call (haiku model).
 *                   Requires ANTHROPIC_API_KEY.
 *                   Saves draft to DB, transitions row to PENDING_REVIEW.
 *                   Returns: { ok: true, draft: string }
 *
 * INVARIANT: AI MAY DRAFT. AI MAY NOT SEND. HUMAN DECIDES WHAT IS SENT.
 * This route never sends an Instagram message.
 *
 * Security:
 *   - Admin session cookie required
 *   - Same-Origin validated (CSRF defence)
 *   - Row state verified server-side before any action
 *   - ANTHROPIC_API_KEY is server-side only (mode='api' only)
 *   - No secrets are included in the promptPackage returned to the client
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

// ── Canonical system prompt ────────────────────────────────────────────────
// DM_PROMPT_VERSION must be bumped in the environment when the prompt changes
// materially, so feedback records stay traceable to the correct prompt version.
const DM_PROMPT_VERSION = process.env.DM_PROMPT_VERSION ?? 'v1'

const SYSTEM_PROMPT = (process.env.DM_SYSTEM_PROMPT ?? `
شما دستیار اشکان فارا هستید — مربی زندگی، خالق محتوا، و بنیانگذاری که به ایرانی‌ها کمک می‌کند تا از طریق ذهنیت، مهاجرت، و توسعه شخصی، زندگی بهتری بسازند. شما پیام‌های مستقیم اینستاگرام را از طرف او مدیریت می‌کنید.

قوانین:
- پاسخ‌ها را گرم، صمیمی، و طبیعی به فارسی محاوره‌ای ایرانی بنویسید (نه رسمی)
- پاسخ‌ها را کوتاه نگه دارید (۱-۴ جمله) مگر اینکه سوال نیاز به توضیح بیشتر داشته باشد
- صادقانه و بدون فروشندگی باشید — اول ارتباط بسازید
- اگر کسی درباره مشاوره یا دوره‌ها پرسید، با گرمی پاسخ دهید و یک سوال واجد شرایط بپرسید
- اگر کسی خبر شخصی به اشتراک گذاشت، با همدلی واقعی پاسخ دهید
- اگر پیام مبهم است، پاسخ کوتاه و گرم بدهید و آن‌ها را دعوت کنید بیشتر توضیح دهند
- هرگز جزئیاتی درباره برنامه، قیمت‌ها، یا در دسترس بودن اشکان را جعل نکنید
- هرگز نتایج خاصی وعده ندهید

اگر کاربر چند پیام متوالی فرستاده، همه آن‌ها را با هم در نظر بگیرید و یک پاسخ منسجم بنویسید که به نیت کلی مکالمه پاسخ دهد — نه جواب جداگانه برای هر پیام.
`).trim()

// ── Shared: fetch row + validate state ────────────────────────────────────

interface DmRow {
  id:                   string
  sender_id:            string
  message_text:         string | null
  message_type:         string
  created_at:           string
  failed_reason:        string | null
  processed:            boolean
  processing_started_at: string | null
  response_text:        string | null
  is_story_reply:       boolean
  story_id:             string | null
  response_sent:        boolean
}

interface StoryCtx {
  story_id:      string
  media_type:    string | null
  media_url:     string | null
  caption:       string | null
  ai_description: string | null
  ocr_text:      string | null
}

// Pending inbound row — another unsent message from the same sender
interface PendingInboundRow {
  id: string
  message_text: string | null
  message_type: string
  created_at: string
  is_story_reply: boolean
  story_id: string | null
  failed_reason: string | null
  processed: boolean
}

async function fetchRow(id: string): Promise<DmRow | null> {
  const base = SUPABASE_BASE()
  const hdrs = SUPABASE_HEADERS()
  const res = await fetch(
    `${base}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=id,sender_id,message_text,message_type,created_at,failed_reason,processed,` +
    `processing_started_at,response_text,is_story_reply,story_id,response_sent`,
    { headers: hdrs }
  )
  if (!res.ok) return null
  const rows = await res.json() as DmRow[]
  return rows[0] ?? null
}

async function fetchHistory(senderId: string): Promise<{ message_text: string | null; final_response_text: string | null; created_at: string }[]> {
  const base = SUPABASE_BASE()
  const hdrs = SUPABASE_HEADERS()
  const res = await fetch(
    `${base}/rest/v1/instagram_dm_buffer` +
    `?sender_id=eq.${encodeURIComponent(senderId)}` +
    `&response_sent=eq.true` +
    `&select=message_text,final_response_text,created_at` +
    `&order=created_at.desc&limit=8`,
    { headers: hdrs }
  )
  return res.ok ? res.json() : []
}

/**
 * Fetch other unsent inbound rows from the same sender that belong to the open
 * conversation window (last 24 h). Excludes the target row itself.
 *
 * Includes only genuinely unanswered inbound states:
 *   - failed_reason IS NULL + processed = false   → needs_generation (fresh inbound)
 *   - failed_reason = 'PENDING_REVIEW'            → needs_review (AI draft exists, not sent)
 *
 * Excludes:
 *   - failed_reason IS NULL + processed = true    → n8n "no reply needed" completion
 *   - AI_RECOMMENDED_IGNORE, HUMAN_TEMP_SKIP, STORY_MENTION_HUMAN_HOLD, SEND_FAILED, etc.
 *
 * Capped at 5 rows, chronological order.
 */
async function fetchPendingInbound(senderId: string, excludeId: string): Promise<PendingInboundRow[]> {
  const base = SUPABASE_BASE()
  const hdrs = SUPABASE_HEADERS()
  const windowCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Include all unresolved inbound states — fresh, awaiting draft, draft failed, or has a draft
  const res = await fetch(
    `${base}/rest/v1/instagram_dm_buffer` +
    `?sender_id=eq.${encodeURIComponent(senderId)}` +
    `&id=neq.${encodeURIComponent(excludeId)}` +
    `&response_sent=eq.false` +
    `&or=(failed_reason.is.null,failed_reason.eq.PENDING_REVIEW,failed_reason.eq.DRAFT_FAILED,failed_reason.eq.DRAFT_GENERATING)` +
    `&created_at=gt.${encodeURIComponent(windowCutoff)}` +
    `&select=id,message_text,message_type,created_at,is_story_reply,story_id,failed_reason,processed` +
    `&order=created_at.asc&limit=10`,
    { headers: hdrs }
  )
  if (!res.ok) return []
  const rows = await res.json() as PendingInboundRow[]

  return rows
    .filter(r => !(r.failed_reason === null && r.processed === true)) // exclude n8n "no reply" completions
    .slice(0, 9) // allow up to 9 siblings (+ the target row = 10 total)
}

async function fetchStoryCtx(storyId: string): Promise<StoryCtx | null> {
  const base = SUPABASE_BASE()
  const hdrs = SUPABASE_HEADERS()
  const res = await fetch(
    `${base}/rest/v1/story_context` +
    `?story_id=eq.${encodeURIComponent(storyId)}` +
    `&select=story_id,media_type,media_url,caption,ai_description,ocr_text` +
    `&limit=1`,
    { headers: hdrs }
  )
  if (!res.ok) return null
  const rows = await res.json() as StoryCtx[]
  return rows[0] ?? null
}

/** Batch-fetch story contexts for a list of story IDs. */
async function fetchStoryCtxBatch(storyIds: string[]): Promise<Record<string, StoryCtx>> {
  if (storyIds.length === 0) return {}
  const base = SUPABASE_BASE()
  const hdrs = SUPABASE_HEADERS()
  const idList = `(${storyIds.map(id => encodeURIComponent(id)).join(',')})`
  const res = await fetch(
    `${base}/rest/v1/story_context` +
    `?story_id=in.${idList}` +
    `&select=story_id,media_type,media_url,caption,ai_description,ocr_text`,
    { headers: hdrs }
  )
  if (!res.ok) return {}
  const rows = await res.json() as StoryCtx[]
  return Object.fromEntries(rows.map(r => [r.story_id, r]))
}

type RowClass = 'fresh_inbound' | 'draft_failed' | 'pending_no_draft'
/** Validate that a row is in a legal pre-generation state. */
function classifyRow(row: DmRow): { valid: true; rowClass: RowClass } | { valid: false; error: string; status: number } {
  if (row.response_sent === true)
    return { valid: false, error: 'Message already sent — cannot draft again', status: 409 }

  const isFreshInbound   = row.failed_reason === null && row.processed === false && row.processing_started_at === null
  const isDraftFailed    = row.failed_reason === 'DRAFT_FAILED'
  const isPendingNoDraft = row.failed_reason === 'PENDING_REVIEW' && (!row.response_text)
  if (!isFreshInbound && !isDraftFailed && !isPendingNoDraft)
    return { valid: false, error: `Row is not in a pre-generation state (failed_reason=${row.failed_reason})`, status: 409 }

  const windowMs = 24 * 60 * 60 * 1000
  if (Date.now() > new Date(row.created_at).getTime() + windowMs)
    return { valid: false, error: 'messaging_window_expired', status: 409 }

  const rowClass: RowClass = isFreshInbound ? 'fresh_inbound' : isDraftFailed ? 'draft_failed' : 'pending_no_draft'
  return { valid: true, rowClass }
}

/** Build the Anthropic Messages API messages array. */
type AnthropicMessage = { role: 'user' | 'assistant'; content: string }

function formatPendingText(p: PendingInboundRow, storyCtx: StoryCtx | null): string {
  const parts: string[] = []
  if (p.is_story_reply) parts.push('[پاسخ به استوری]')
  if (p.message_text)   parts.push(p.message_text)
  else if (p.message_type !== 'TEXT') parts.push(`[پیام ${p.message_type}]`)
  else parts.push('[پیام بدون متن]')
  if (storyCtx?.caption)        parts.push(`\n[کپشن استوری: ${storyCtx.caption}]`)
  if (storyCtx?.ai_description) parts.push(`[توضیح هوش مصنوعی: ${storyCtx.ai_description}]`)
  if (storyCtx?.ocr_text)       parts.push(`[متن تصویر: ${storyCtx.ocr_text}]`)
  return parts.join(' ')
}

function buildMessages(
  row: DmRow,
  histRows: { message_text: string | null; final_response_text: string | null }[],
  storyCtx: StoryCtx | null,
  pendingRows: PendingInboundRow[] = [],
  pendingStoryCtxMap: Record<string, StoryCtx> = {}
): AnthropicMessage[] {
  const messages: AnthropicMessage[] = []

  for (const h of [...histRows].reverse()) {
    if (h.message_text)         messages.push({ role: 'user',      content: h.message_text })
    if (h.final_response_text)  messages.push({ role: 'assistant', content: h.final_response_text })
  }

  // Inject earlier pending inbound messages before the target — each as a standalone user turn
  for (const p of pendingRows) {
    const pCtx = p.story_id ? (pendingStoryCtxMap[p.story_id] ?? null) : null
    messages.push({ role: 'user', content: formatPendingText(p, pCtx) })
  }

  const parts: string[] = []
  if (row.is_story_reply) parts.push('[پاسخ به استوری]')
  if (row.message_text)   parts.push(row.message_text)
  else if (row.message_type !== 'TEXT') parts.push(`[پیام ${row.message_type}]`)
  else parts.push('[پیام بدون متن]')

  if (storyCtx) {
    if (storyCtx.caption)        parts.push(`\n[کپشن استوری: ${storyCtx.caption}]`)
    if (storyCtx.ai_description) parts.push(`[توضیح هوش مصنوعی: ${storyCtx.ai_description}]`)
    if (storyCtx.ocr_text)       parts.push(`[متن تصویر: ${storyCtx.ocr_text}]`)
  }

  messages.push({ role: 'user', content: parts.join(' ') })
  return messages
}

/** Build the human-readable prompt package for copy-paste into Claude.ai. */
function buildPromptPackage(
  row: DmRow,
  histRows: { message_text: string | null; final_response_text: string | null; created_at: string }[],
  storyCtx: StoryCtx | null,
  pendingRows: PendingInboundRow[] = [],
  pendingStoryCtxMap: Record<string, StoryCtx> = {}
): string {
  const lines: string[] = []

  lines.push(`━━━ SYSTEM PROMPT (DM_PROMPT_VERSION: ${DM_PROMPT_VERSION}) ━━━`)
  lines.push('')
  lines.push(SYSTEM_PROMPT)
  lines.push('')
  lines.push('━━━ CONVERSATION HISTORY (oldest → newest, sent exchanges only) ━━━')
  lines.push('')

  const sorted = [...histRows].reverse()
  if (sorted.length === 0) {
    lines.push('(no prior sent exchanges with this sender)')
  } else {
    for (const h of sorted) {
      const date = new Date(h.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      if (h.message_text)        lines.push(`[${date}] Inbound: ${h.message_text}`)
      if (h.final_response_text) lines.push(`[${date}] Sent reply: ${h.final_response_text}`)
    }
  }

  // Earlier pending inbound messages — only shown when >0 (target itself is NOT duplicated here)
  if (pendingRows.length > 0) {
    lines.push('')
    lines.push('━━━ UNANSWERED / PENDING INBOUND MESSAGES (chronological, not yet replied to) ━━━')
    lines.push('')
    for (const p of pendingRows) {
      const date = new Date(p.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      const pCtx = p.story_id ? (pendingStoryCtxMap[p.story_id] ?? null) : null
      const typeTag = p.is_story_reply ? 'STORY REPLY' : p.message_type !== 'TEXT' ? p.message_type : null
      const msgText = p.message_text ?? `[${p.message_type} — no text]`
      lines.push(`[${date}]${typeTag ? ` [${typeTag}]` : ''} ${msgText}`)
      if (pCtx) {
        if (pCtx.caption)         lines.push(`  Story caption: ${pCtx.caption}`)
        if (pCtx.ai_description)  lines.push(`  Story description: ${pCtx.ai_description}`)
        if (pCtx.ocr_text)        lines.push(`  Story text: ${pCtx.ocr_text}`)
      }
    }
  }

  lines.push('')
  lines.push('━━━ LATEST INBOUND MESSAGE ━━━')
  lines.push('')

  if (row.is_story_reply) lines.push('Type: STORY REPLY')
  else if (row.message_type !== 'TEXT') lines.push(`Type: ${row.message_type}`)

  if (row.message_text) {
    lines.push(`Message: ${row.message_text}`)
  } else {
    lines.push(`Message: [${row.message_type} — no text]`)
  }

  if (storyCtx) {
    lines.push('')
    lines.push('Story context:')
    if (storyCtx.media_type) lines.push(`  Media type: ${storyCtx.media_type}`)
    if (storyCtx.caption)    lines.push(`  Caption: ${storyCtx.caption}`)
    if (storyCtx.ai_description) lines.push(`  AI description: ${storyCtx.ai_description}`)
    if (storyCtx.ocr_text)  lines.push(`  OCR text: ${storyCtx.ocr_text}`)
  }

  lines.push('')
  lines.push('━━━ TASK ━━━')
  lines.push('')
  lines.push('Respond to the conversation as a whole. The sender may have sent several consecutive messages.')
  lines.push('Address their combined intent naturally in ONE concise reply.')
  lines.push('Do NOT reply separately to each message unless clearly necessary.')
  lines.push('Reply ONLY with the draft message text. No explanation, no prefixes, no quotes.')
  lines.push('Follow all rules in the system prompt exactly.')

  return lines.join('\n')
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!requireAdminSession(req))
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!validateSameOrigin(req))
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  let body: { id?: unknown; mode?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const id   = typeof body.id   === 'string' ? body.id.trim()   : ''
  const mode = typeof body.mode === 'string' ? body.mode.trim() : 'claude'

  if (!id)                              return NextResponse.json({ ok: false, error: 'id is required' }, { status: 422 })
  if (mode !== 'claude' && mode !== 'api') return NextResponse.json({ ok: false, error: 'mode must be claude or api' }, { status: 422 })

  if (!supabaseConfigured())
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })

  // mode='api' is the only path that requires ANTHROPIC_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (mode === 'api' && !anthropicKey)
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY is not configured — use Generate with Claude instead' }, { status: 503 })

  // ── Read + validate row ──────────────────────────────────────
  const row = await fetchRow(id)
  if (!row) return NextResponse.json({ ok: false, error: 'Row not found' }, { status: 404 })

  const classification = classifyRow(row)
  if (!classification.valid)
    return NextResponse.json({ ok: false, error: classification.error }, { status: classification.status })

  const { rowClass } = classification
  const isFreshInbound = rowClass === 'fresh_inbound' || rowClass === 'draft_failed'

  // ── Shared: fetch history + story context + earlier pending inbound ─────
  const [histRows, storyCtx, pendingRows] = await Promise.all([
    fetchHistory(row.sender_id),
    row.is_story_reply && row.story_id ? fetchStoryCtx(row.story_id) : Promise.resolve(null),
    fetchPendingInbound(row.sender_id, id),
  ])

  // Batch-fetch story contexts for any pending rows that are story replies
  const pendingStoryIds = pendingRows.filter(p => p.is_story_reply && p.story_id).map(p => p.story_id as string)
  const pendingStoryCtxMap = await fetchStoryCtxBatch(pendingStoryIds)

  // ════════════════════════════════════════════════════════════
  // MODE: 'claude' — build prompt package, return it. ZERO API call.
  // ════════════════════════════════════════════════════════════
  if (mode === 'claude') {
    const promptPackage = buildPromptPackage(row, histRows, storyCtx, pendingRows, pendingStoryCtxMap)
    console.log(`[dm-generate] ✓ Prompt package built | mode=claude id=${id} pending=${pendingRows.length}`)
    return NextResponse.json({ ok: true, promptPackage })
  }

  // ════════════════════════════════════════════════════════════
  // MODE: 'api' — call Anthropic API (haiku), save draft to DB.
  // Exactly one API call per click.
  // ════════════════════════════════════════════════════════════
  const messages = buildMessages(row, histRows, storyCtx, pendingRows, pendingStoryCtxMap)

  let generatedDraft = ''
  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         anthropicKey!,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system:     SYSTEM_PROMPT,
        messages,
      }),
      signal: AbortSignal.timeout(25_000),
    })

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.json() as { error?: { message?: string } }
      console.error('[dm-generate] Anthropic error:', anthropicRes.status, errBody)
      return NextResponse.json({
        ok:    false,
        error: `Anthropic API error: ${errBody.error?.message ?? anthropicRes.status}`,
      }, { status: 502 })
    }

    const anthropicBody = await anthropicRes.json() as { content?: { type: string; text: string }[] }
    generatedDraft = anthropicBody.content?.find(b => b.type === 'text')?.text?.trim() ?? ''

    if (!generatedDraft)
      return NextResponse.json({ ok: false, error: 'API returned an empty response' }, { status: 502 })

  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    console.error('[dm-generate] API call failed:', isTimeout ? 'timeout(25s)' : err)
    return NextResponse.json({
      ok:    false,
      error: isTimeout ? 'API generation timed out (25s)' : 'API call failed',
    }, { status: 502 })
  }

  // Save draft + transition to PENDING_REVIEW
  const base = SUPABASE_BASE()
  const hdrs = SUPABASE_HEADERS()
  const draftSource = `ANTHROPIC_API_${DM_PROMPT_VERSION}`

  const patchRes = await fetch(
    `${base}/rest/v1/instagram_dm_buffer?id=eq.${encodeURIComponent(id)}` +
    `&response_sent=eq.false` +
    (rowClass === 'fresh_inbound'
      ? `&failed_reason=is.null&processed=eq.false&processing_started_at=is.null`
      : rowClass === 'draft_failed'
        ? `&failed_reason=eq.DRAFT_FAILED`
        : `&failed_reason=eq.PENDING_REVIEW`),
    {
      method:  'PATCH',
      headers: { ...hdrs, Prefer: 'return=representation' },
      body:    JSON.stringify({
        failed_reason:         'PENDING_REVIEW',
        processed:             true,
        processing:            false,
        processing_started_at: new Date().toISOString(),
        response_text:         generatedDraft,
        draft_source:          draftSource,
      }),
    }
  )

  if (!patchRes.ok) {
    console.error('[dm-generate] PATCH failed:', patchRes.status, await patchRes.text())
    return NextResponse.json({ ok: false, error: 'Failed to save draft to database' }, { status: 502 })
  }

  const patched = await patchRes.json() as { id: string }[]
  if (patched.length === 0)
    return NextResponse.json({ ok: false, error: 'Row state changed before draft could be saved — refresh and try again' }, { status: 409 })

  console.log(`[dm-generate] ✓ API draft saved | model=haiku id=${id} source=${draftSource}`)
  return NextResponse.json({ ok: true, draft: generatedDraft })
}
