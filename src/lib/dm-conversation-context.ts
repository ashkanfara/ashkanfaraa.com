/**
 * dm-conversation-context.ts
 *
 * Shared conversation context assembly for DM Routine drafts and regeneration.
 *
 * History source (merged, two tables):
 *   Customer lines — instagram_dm_buffer where response_sent=true OR
 *                    failed_reason=SUPERSEDED (bundle siblings).
 *   Ashkan lines  — dm_response_feedback.final_sent_response (confirmed sends).
 *   Merged by created_at timestamp; chat-budget truncation applied after merge.
 *
 * WHY two sources: saveDmFeedback stores only the PRIMARY row's message_text as
 * inbound_context. When Ashkan approves a reply, supersedeBundleSiblings marks
 * earlier bundle-sibling rows SUPERSEDED. Their message_text (e.g. a job-offer
 * statement like "جاب آفر ۱۵۰ هزار دلار استرالیا") never enters dm_response_feedback
 * and was silently dropped from conversation_history. Fetching SUPERSEDED rows
 * from instagram_dm_buffer restores that intent.
 *
 * Bounded truncation strategy:
 *   Total chars ≤ MAX_CHAR_BUDGET  → all events verbatim, chronological.
 *   Budget exceeded                 → oldest ANCHOR_EVENTS events
 *                                    + explicit marker + tail of remaining budget.
 *   Never silently drops events.
 *
 * Memory persistence (instagram_dm_memory):
 *   Written by writeConversationMemoryDurable() after every confirmed IG send.
 *   Used by n8n BRP node until n8n FCH is updated to call the merged history source.
 *   Idempotency: buffer_id stored in message JSONB; dedup by pre-check before insert.
 *   Durability: up to MAX_WRITE_ATTEMPTS with RETRY_DELAY_MS between tries.
 *   On total failure: structured recoverable error logged (backfill script can repair).
 *
 * Genuinely unavailable sources (not accessible without new infrastructure):
 *   - Manual IG replies sent via Instagram mobile app: require message_echo webhook
 *     handling. No webhook handler for echo events exists in this codebase.
 *   - IG Story replies not yet fetched (handled separately via story_context table).
 */

const SUPABASE_BASE = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_HEADERS = () => ({
  apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
  'Content-Type': 'application/json',
})

// ── Truncation parameters ────────────────────────────────────────────────────
const FETCH_LIMIT     = 200   // fetch up to 200 events per source; realistic max is ~30-50
const ANCHOR_EVENTS   = 10    // when char budget forces truncation, preserve oldest 10 events
const MAX_CHAR_BUDGET = 12000 // primary constraint: hard character cap

// ── Retry parameters for memory writes ──────────────────────────────────────
const MAX_WRITE_ATTEMPTS = 3
const RETRY_DELAY_MS     = 250

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConversationTurn {
  bufferId:      string | null
  inbound:       string  // customer message text (from dm_response_feedback.inbound_context)
  outbound:      string  // sent reply text (from dm_response_feedback.final_sent_response)
  createdAt:     string
}

// A flat event in the merged timeline (customer message OR Ashkan response)
interface HistoryEvent {
  type:  'customer' | 'ashkan'
  text:  string
  ts:    string
}

// ── Context assembly ──────────────────────────────────────────────────────────

/**
 * Fetch confirmed-send history from dm_response_feedback.
 * Returns turns in chronological order. Used for Ashkan: lines in merged history.
 */
export async function fetchDmConversationTurns(senderId: string): Promise<ConversationTurn[]> {
  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/dm_response_feedback` +
    `?sender_id=eq.${encodeURIComponent(senderId)}` +
    `&select=buffer_id,inbound_context,final_sent_response,created_at` +
    `&order=created_at.asc` +
    `&limit=${FETCH_LIMIT}`,
    { headers: SUPABASE_HEADERS() }
  )
  if (!res.ok) return []
  const rows = await res.json() as {
    buffer_id:           string | null
    inbound_context:     string | null
    final_sent_response: string | null
    created_at:          string
  }[]
  return rows
    .filter(r => r.inbound_context?.trim() && r.final_sent_response?.trim())
    .map(r => ({
      bufferId:  r.buffer_id ?? null,
      inbound:   r.inbound_context!.trim(),
      outbound:  r.final_sent_response!.trim(),
      createdAt: r.created_at,
    }))
}

/**
 * Fetch ALL historical customer inbound messages from instagram_dm_buffer:
 *   - response_sent=true (primary approved rows — Ashkan replied to these)
 *   - failed_reason=SUPERSEDED (bundle siblings dismissed when primary was approved)
 *
 * SUPERSEDED rows capture bundle-member messages whose text was never stored in
 * dm_response_feedback.inbound_context (saveDmFeedback only stores the primary row's
 * message_text). Without this, earlier messages in a bundle (e.g. a customer stating
 * their Australia job offer) are silently missing from conversation_history.
 */
export async function fetchHistoricalInbound(senderId: string): Promise<{ text: string; ts: string }[]> {
  const res = await fetch(
    `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
    `?sender_id=eq.${encodeURIComponent(senderId)}` +
    `&message_text=not.is.null` +
    `&or=(response_sent.eq.true,failed_reason.eq.SUPERSEDED)` +
    `&order=created_at.asc` +
    `&limit=${FETCH_LIMIT}`,
    { headers: SUPABASE_HEADERS() }
  )
  if (!res.ok) return []
  const rows = await res.json() as { message_text: string | null; created_at: string }[]
  return rows
    .filter(r => r.message_text?.trim())
    .map(r => ({ text: r.message_text!.trim(), ts: r.created_at }))
}

/**
 * Build conversation_history string from merged inbound + outbound event streams.
 *
 * Events are sorted chronologically. Customer: lines come from instagram_dm_buffer
 * (full inbound history including SUPERSEDED bundle siblings). Ashkan: lines come
 * from dm_response_feedback (confirmed sends only).
 *
 * Character-budget truncation (12000 chars is the primary gate, not event count):
 *   All events fit    → verbatim, oldest first.
 *   Budget exceeded   → keep oldest ANCHOR_EVENTS events + marker + tail.
 *   Never silent drop — always emits a marker when truncating.
 */
export function buildMergedHistory(
  inboundRows:   { text: string; ts: string }[],
  feedbackTurns: ConversationTurn[],
): string {
  const events: HistoryEvent[] = [
    ...inboundRows.map(r => ({ type: 'customer' as const, text: r.text, ts: r.ts })),
    ...feedbackTurns.map(t => ({ type: 'ashkan' as const, text: t.outbound, ts: t.createdAt })),
  ]

  // Sort chronologically; on exact ts tie: customer before ashkan, then text for stability
  events.sort((a, b) => {
    const cmp = a.ts.localeCompare(b.ts)
    if (cmp !== 0) return cmp
    if (a.type !== b.type) return a.type === 'customer' ? -1 : 1
    return a.text.localeCompare(b.text)
  })

  if (events.length === 0) return ''

  const lines = events.map(e => e.type === 'customer' ? `Customer: ${e.text}` : `Ashkan: ${e.text}`)
  const fullText = lines.join('\n')

  if (fullText.length <= MAX_CHAR_BUDGET) return fullText

  // Budget exceeded — anchor oldest ANCHOR_EVENTS events + marker + tail
  const anchorLines = lines.slice(0, ANCHOR_EVENTS)
  const anchorText  = anchorLines.join('\n')
  const marker      = `\n[... earlier context truncated for length — original intent above ...]\n`
  const tailBudget  = MAX_CHAR_BUDGET - anchorText.length - marker.length

  if (tailBudget <= 0) {
    const raw = fullText.slice(fullText.length - MAX_CHAR_BUDGET)
    const nl  = raw.indexOf('\n')
    return `[... earlier context truncated for length ...]\n${nl >= 0 ? raw.slice(nl + 1) : raw}`
  }

  const tailRaw = fullText.slice(fullText.length - tailBudget)
  const nl      = tailRaw.indexOf('\n')
  return `${anchorText}${marker}${nl >= 0 ? tailRaw.slice(nl + 1) : tailRaw}`
}

/**
 * Backwards-compatible builder from ConversationTurn[] only (used by tests
 * that mock only dm_response_feedback). Wraps buildMergedHistory with inbound
 * derived from the turns' inbound field so existing callers continue to work.
 */
export function buildConversationHistoryText(turns: ConversationTurn[]): string {
  const inboundRows = turns.map(t => ({ text: t.inbound, ts: t.createdAt }))
  return buildMergedHistory(inboundRows, turns)
}

/**
 * Fetch merged conversation history for a sender and build the text.
 * Customer: lines from instagram_dm_buffer (response_sent=true + SUPERSEDED siblings).
 * Ashkan:   lines from dm_response_feedback (confirmed sends).
 * Merged by timestamp; char-budget truncation applied.
 */
export async function assembleDmConversationHistory(senderId: string): Promise<string> {
  const [inboundRows, feedbackTurns] = await Promise.all([
    fetchHistoricalInbound(senderId),
    fetchDmConversationTurns(senderId),
  ])
  return buildMergedHistory(inboundRows, feedbackTurns)
}

// ── Durable memory write (instagram_dm_memory) ────────────────────────────────

/**
 * Write a confirmed send turn to instagram_dm_memory for n8n BRP compatibility.
 * Stores buffer_id in message JSONB for idempotency (dedup on re-run or retry).
 *
 * Schema: { id serial, session_id text, message jsonb }
 * Session key: 'Key:\n' + senderId  (matches LangChain Postgres memory convention)
 * Message JSONB: { type: 'human'|'ai', content: string, buffer_id: string }
 *
 * Durability: retries up to MAX_WRITE_ATTEMPTS times. On total failure, logs a
 * structured error that the backfill script can use for recovery. Does NOT affect
 * the Instagram send outcome or the dm_response_feedback canonical record.
 */
export async function writeConversationMemoryDurable(
  senderId:   string,
  humanText:  string,
  aiText:     string,
  bufferId:   string,
): Promise<void> {
  const sessionId = 'Key:\n' + senderId
  const endpoint  = `${SUPABASE_BASE()}/rest/v1/instagram_dm_memory`
  const headers   = SUPABASE_HEADERS()

  // Idempotency check: skip write if buffer_id already present for this session.
  // Supabase REST supports JSONB property filter: message->>buffer_id=eq.{value}
  try {
    const checkRes = await fetch(
      `${endpoint}?session_id=eq.${encodeURIComponent(sessionId)}` +
      `&message->>buffer_id=eq.${encodeURIComponent(bufferId)}` +
      `&select=id&limit=1`,
      { headers }
    )
    if (checkRes.ok) {
      const existing = await checkRes.json() as { id: number }[]
      if (existing.length > 0) {
        console.log(`[dm-context] instagram_dm_memory already has buffer_id=${bufferId} — skipping duplicate write`)
        return
      }
    }
  } catch (e) {
    // Pre-check failure is non-blocking — proceed to write attempt
    console.warn('[dm-context] idempotency pre-check failed (proceeding with write):', e)
  }

  // Write human row then ai row in sequence (serial id ordering ensures human < ai)
  const rows = [
    { session_id: sessionId, message: { type: 'human', content: humanText, buffer_id: bufferId } },
    { session_id: sessionId, message: { type: 'ai',    content: aiText,    buffer_id: bufferId } },
  ]

  for (const row of rows) {
    let lastErr: unknown
    for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method:  'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body:    JSON.stringify(row),
        })
        if (res.ok) { lastErr = undefined; break }
        lastErr = `HTTP ${res.status}: ${await res.text()}`
      } catch (e) {
        lastErr = e
      }
      if (attempt < MAX_WRITE_ATTEMPTS) await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
    }
    if (lastErr) {
      // Structured recoverable error — backfill script can recover from dm_response_feedback
      console.error(
        '[dm-context] RECOVERABLE: instagram_dm_memory write failed after retries.' +
        ` sender=${senderId} buffer_id=${bufferId} type=${row.message.type}` +
        ` error=${lastErr}`
      )
    }
  }
}
