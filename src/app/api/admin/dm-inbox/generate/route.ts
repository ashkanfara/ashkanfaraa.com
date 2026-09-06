/**
 * POST /api/admin/dm-inbox/generate
 *
 * Human-triggered draft generation. Generates a reply draft using Claude,
 * saves it as response_text, and transitions the row to PENDING_REVIEW so
 * the human can review and approve before any Instagram send.
 *
 * INVARIANT: AI MAY DRAFT. AI MAY NOT SEND. HUMAN DECIDES WHAT IS SENT.
 *
 * Body: { id: string, mode: 'claude' | 'api' }
 *   id   — instagram_dm_buffer UUID
 *   mode — 'claude' uses claude-sonnet-5; 'api' uses claude-haiku-4-5-20251001
 *
 * Returns: { ok: true, draft: string } | { ok: false, error: string }
 *
 * Security:
 *   - Admin session cookie required
 *   - Same-Origin validated (CSRF defence)
 *   - Row state verified server-side before generation
 *   - No Instagram send occurs here
 *   - ANTHROPIC_API_KEY is server-side only, never client-exposed
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession, validateSameOrigin } from '@/lib/adminSession'
import { supabaseConfigured } from '@/lib/supabase'

const SUPABASE_BASE = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_HEADERS = () => ({
  apikey:          process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  Authorization:  `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
  'Content-Type': 'application/json',
})

// ── DM_PROMPT_VERSION: bump when the system prompt changes materially ──────
const DM_PROMPT_VERSION = process.env.DM_PROMPT_VERSION ?? 'v1'

const SYSTEM_PROMPT = process.env.DM_SYSTEM_PROMPT ?? `
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
`.trim()

const MODEL: Record<string, string> = {
  claude: 'claude-sonnet-5',
  api:    'claude-haiku-4-5-20251001',
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────
  if (!requireAdminSession(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!validateSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  // ── 2. Parse input ───────────────────────────────────────────
  let body: { id?: unknown; mode?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const id   = typeof body.id   === 'string' ? body.id.trim()   : ''
  const mode = typeof body.mode === 'string' ? body.mode.trim() : 'claude'

  if (!id)           return NextResponse.json({ ok: false, error: 'id is required' }, { status: 422 })
  if (!MODEL[mode])  return NextResponse.json({ ok: false, error: 'mode must be claude or api' }, { status: 422 })

  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY is not configured on this server' }, { status: 503 })
  }

  const base = SUPABASE_BASE()
  const hdrs = SUPABASE_HEADERS()

  // ── 3. Read row — verify state server-side ───────────────────
  // Valid pre-generation states:
  //   (a) fresh manual_claude inbound: failed_reason IS NULL, processed=false, psa=null
  //   (b) PENDING_REVIEW with no draft yet: failed_reason=PENDING_REVIEW, response_text IS NULL
  const rowRes = await fetch(
    `${base}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=id,sender_id,message_text,message_type,created_at,failed_reason,processed,` +
    `processing_started_at,response_text,is_story_reply,story_id,response_sent`,
    { headers: hdrs }
  )
  if (!rowRes.ok) {
    return NextResponse.json({ ok: false, error: 'DB read failed' }, { status: 502 })
  }
  const rows = await rowRes.json() as Record<string, unknown>[]
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: 'Row not found' }, { status: 404 })
  }
  const row = rows[0]

  // Guard: response_sent must be false (never draft a sent message)
  if (row.response_sent === true) {
    return NextResponse.json({ ok: false, error: 'Message already sent — cannot regenerate' }, { status: 409 })
  }

  // Guard: must be in a valid pre-generation state
  const isFreshInbound    = row.failed_reason === null && row.processed === false && row.processing_started_at === null
  const isPendingNoDraft  = row.failed_reason === 'PENDING_REVIEW' && (row.response_text === null || row.response_text === '')
  if (!isFreshInbound && !isPendingNoDraft) {
    return NextResponse.json({ ok: false, error: `Row is not in a valid pre-generation state (failed_reason=${row.failed_reason})` }, { status: 409 })
  }

  // Guard: 24h messaging window
  const windowMs  = 24 * 60 * 60 * 1000
  const createdAt = new Date(row.created_at as string).getTime()
  if (Date.now() > createdAt + windowMs) {
    return NextResponse.json({ ok: false, error: 'messaging_window_expired' }, { status: 409 })
  }

  // ── 4. Fetch recent conversation history for context ─────────
  const histRes = await fetch(
    `${base}/rest/v1/instagram_dm_buffer` +
    `?sender_id=eq.${encodeURIComponent(row.sender_id as string)}` +
    `&response_sent=eq.true` +
    `&select=message_text,final_response_text,created_at` +
    `&order=created_at.desc&limit=8`,
    { headers: hdrs }
  )
  const histRows: { message_text: string | null; final_response_text: string | null; created_at: string }[] =
    histRes.ok ? await histRes.json() : []

  // ── 5. Build conversation for Claude ─────────────────────────
  type Message = { role: 'user' | 'assistant'; content: string }
  const messages: Message[] = []

  // Oldest exchanges first (histRows is newest-first, so reverse)
  for (const h of [...histRows].reverse()) {
    if (h.message_text)         messages.push({ role: 'user',      content: h.message_text })
    if (h.final_response_text)  messages.push({ role: 'assistant', content: h.final_response_text })
  }

  // Current inbound message
  const inboundText =
    (row.is_story_reply ? '[پاسخ به استوری] ' : '') +
    ((row.message_text as string | null) ?? '[پیام رسانه‌ای]')
  messages.push({ role: 'user', content: inboundText })

  // Ensure messages is non-empty and starts with user
  if (messages.length === 0 || messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: inboundText })
  }

  // ── 6. Call Anthropic API ─────────────────────────────────────
  let generatedDraft = ''
  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      MODEL[mode],
        max_tokens: 400,
        system:     SYSTEM_PROMPT,
        messages,
      }),
      signal: AbortSignal.timeout(25_000),
    })

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.json() as { error?: { message?: string } }
      console.error('[dm-generate] Anthropic API error:', anthropicRes.status, errBody)
      return NextResponse.json({ ok: false, error: `Claude API error: ${errBody.error?.message ?? anthropicRes.status}` }, { status: 502 })
    }

    const anthropicBody = await anthropicRes.json() as { content?: { type: string; text: string }[] }
    const textBlock = anthropicBody.content?.find(b => b.type === 'text')
    generatedDraft = textBlock?.text?.trim() ?? ''

    if (!generatedDraft) {
      return NextResponse.json({ ok: false, error: 'Claude returned an empty response' }, { status: 502 })
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    console.error('[dm-generate] Anthropic call failed:', isTimeout ? 'timeout (25s)' : err)
    return NextResponse.json({ ok: false, error: isTimeout ? 'Generation timed out (25s)' : 'Claude API call failed' }, { status: 502 })
  }

  // ── 7. Save draft + transition to PENDING_REVIEW ─────────────
  // WHERE guard prevents overwriting an already-sent or in-flight row.
  const draftSource = `GENERATE_WITH_${mode.toUpperCase()}_${DM_PROMPT_VERSION}`
  const patchRes = await fetch(
    `${base}/rest/v1/instagram_dm_buffer?id=eq.${encodeURIComponent(id)}` +
    `&response_sent=eq.false` +
    (isFreshInbound
      ? `&failed_reason=is.null&processed=eq.false&processing_started_at=is.null`
      : `&failed_reason=eq.PENDING_REVIEW`),
    {
      method:  'PATCH',
      headers: { ...hdrs, Prefer: 'return=representation' },
      body: JSON.stringify({
        failed_reason:        'PENDING_REVIEW',
        processed:            true,
        processing:           false,
        processing_started_at: new Date().toISOString(),
        response_text:        generatedDraft,
        draft_source:         draftSource,
      }),
    }
  )

  if (!patchRes.ok) {
    console.error('[dm-generate] PATCH failed:', patchRes.status, await patchRes.text())
    return NextResponse.json({ ok: false, error: 'Failed to save draft to database' }, { status: 502 })
  }

  const patched = await patchRes.json() as { id: string }[]
  if (patched.length === 0) {
    // Row was claimed by another operation between read and PATCH — safe to report as conflict
    return NextResponse.json({ ok: false, error: 'Row state changed before draft could be saved — refresh and try again' }, { status: 409 })
  }

  console.log(`[dm-generate] ✓ Draft generated | mode=${mode} model=${MODEL[mode]} id=${id} source=${draftSource}`)
  return NextResponse.json({ ok: true, draft: generatedDraft })
}
