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

یک پیشنهاد پاسخ برای آخرین پیام دریافتی بنویسید.
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

/** Validate that a row is in a legal pre-generation state. */
function classifyRow(row: DmRow): { valid: true; isFreshInbound: boolean } | { valid: false; error: string; status: number } {
  if (row.response_sent === true)
    return { valid: false, error: 'Message already sent — cannot draft again', status: 409 }

  const isFreshInbound   = row.failed_reason === null && row.processed === false && row.processing_started_at === null
  const isPendingNoDraft = row.failed_reason === 'PENDING_REVIEW' && (!row.response_text)
  if (!isFreshInbound && !isPendingNoDraft)
    return { valid: false, error: `Row is not in a pre-generation state (failed_reason=${row.failed_reason})`, status: 409 }

  const windowMs = 24 * 60 * 60 * 1000
  if (Date.now() > new Date(row.created_at).getTime() + windowMs)
    return { valid: false, error: 'messaging_window_expired', status: 409 }

  return { valid: true, isFreshInbound }
}

/** Build the Anthropic Messages API messages array. */
type AnthropicMessage = { role: 'user' | 'assistant'; content: string }

function buildMessages(
  row: DmRow,
  histRows: { message_text: string | null; final_response_text: string | null }[],
  storyCtx: StoryCtx | null
): AnthropicMessage[] {
  const messages: AnthropicMessage[] = []

  for (const h of [...histRows].reverse()) {
    if (h.message_text)         messages.push({ role: 'user',      content: h.message_text })
    if (h.final_response_text)  messages.push({ role: 'assistant', content: h.final_response_text })
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
  storyCtx: StoryCtx | null
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

  lines.push('')
  lines.push('━━━ CURRENT INBOUND MESSAGE ━━━')
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

  const { isFreshInbound } = classification

  // ── Shared: fetch history + story context ────────────────────
  const [histRows, storyCtx] = await Promise.all([
    fetchHistory(row.sender_id),
    row.is_story_reply && row.story_id ? fetchStoryCtx(row.story_id) : Promise.resolve(null),
  ])

  // ════════════════════════════════════════════════════════════
  // MODE: 'claude' — build prompt package, return it. ZERO API call.
  // ════════════════════════════════════════════════════════════
  if (mode === 'claude') {
    const promptPackage = buildPromptPackage(row, histRows, storyCtx)
    console.log(`[dm-generate] ✓ Prompt package built | mode=claude id=${id}`)
    return NextResponse.json({ ok: true, promptPackage })
  }

  // ════════════════════════════════════════════════════════════
  // MODE: 'api' — call Anthropic API (haiku), save draft to DB.
  // Exactly one API call per click.
  // ════════════════════════════════════════════════════════════
  const messages = buildMessages(row, histRows, storyCtx)

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
