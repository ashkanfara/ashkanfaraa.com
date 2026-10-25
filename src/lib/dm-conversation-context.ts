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
const FETCH_LIMIT     = 200   // page size only; every page is fetched
const ANCHOR_EVENTS   = 10    // when char budget forces truncation, preserve oldest 10 events
const MAX_CHAR_BUDGET = 12000 // primary constraint: hard character cap


// Fetch every page; the page size is not a conversation-history limit.
async function fetchAllContextRows<T>(path: string): Promise<T[]> {
  const rows: T[] = []
  let offset = 0
  for (;;) {
    const res = await fetch(`${SUPABASE_BASE()}/rest/v1/${path}&limit=${FETCH_LIMIT}&offset=${offset}`,
      { headers: { ...SUPABASE_HEADERS(), Prefer: 'count=exact' } })
    if (!res.ok) throw new Error(`DM context fetch failed: HTTP ${res.status}`)
    const page = await res.json() as T[]
    if (!Array.isArray(page)) throw new Error('Invalid DM context page')
    rows.push(...page)
    offset += page.length
    const range = res.headers.get('content-range')
    const total = range?.split('/')[1]
    if (page.length === 0 || (total && total !== '*' && offset >= Number(total))) return rows
  }
}

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
  const rows = await fetchAllContextRows<{
    buffer_id: string | null; inbound_context: string | null;
    final_sent_response: string | null; created_at: string
  }>(`dm_response_feedback?sender_id=eq.${encodeURIComponent(senderId)}` +
    '&select=id,buffer_id,inbound_context,final_sent_response,created_at&order=created_at.asc,id.asc')
  return rows
    .filter(r => r.final_sent_response?.trim())
    .map(r => ({
      bufferId:  r.buffer_id ?? null,
      inbound:   r.inbound_context?.trim() ?? '',
      outbound:  r.final_sent_response!.trim(),
      createdAt: r.created_at,
    }))
}

/**
 * Fetch ALL historical customer inbound messages from instagram_dm_buffer.
 *
 * Included states:
 *   response_sent=true   — primary approved rows; Ashkan sent a reply to these.
 *   failed_reason=SUPERSEDED — bundle siblings dismissed by supersedeBundleSiblings()
 *     when the primary was approved. Their message_text is NEVER in dm_response_feedback
 *     (saveDmFeedback only stores the primary row's text). Without them, e.g. a customer
 *     stating "Australia + job offer" in one bundle message is silently missing.
 *
 * Excluded states (intentional — each has a separate justification):
 *   PENDING_REVIEW / DRAFT_FAILED / DRAFT_GENERATING — the CURRENT unanswered batch;
 *     retry-draft/route.ts passes them as combined_message, not conversation_history.
 *   SUPERSEDED_BY_NEW_INBOUND — old messages from a CLOSED 24h window abandoned when
 *     customer sent a fresh message. Including stale window-expired intent risks confusing
 *     the model with context from a prior conversation thread the customer has moved on from.
 *     If the intent was still relevant the customer re-stated it in their new message.
 *
 * DB secondary sort `id.asc` makes ordering deterministic when two rows share an identical
 * `created_at` timestamp (unusual but possible in rapid bundles). Stable sort in the caller
 * then preserves this DB-level sequence during in-memory merging.
 */
export async function fetchHistoricalInbound(senderId: string): Promise<{ id: string; text: string; ts: string; confirmed: boolean }[]> {
  const rows = await fetchAllContextRows<{
    id: string; message_text: string | null; created_at: string; response_sent: boolean
  }>(`instagram_dm_buffer?sender_id=eq.${encodeURIComponent(senderId)}` +
    '&or=(response_sent.eq.true,failed_reason.eq.SUPERSEDED)' +
    '&select=id,message_text,created_at,response_sent&order=created_at.asc,id.asc')
  return rows
    .map(r => ({ id: r.id, text: r.message_text?.trim() || '', ts: r.created_at, confirmed: r.response_sent === true }))
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
  inboundRows:   { id?: string; text: string; ts: string }[],
  feedbackTurns: ConversationTurn[],
): string {
  const events: HistoryEvent[] = [
    ...inboundRows.filter(r => r.text.trim()).map(r => ({ type: 'customer' as const, text: r.text, ts: r.ts })),
    ...feedbackTurns.map(t => ({ type: 'ashkan' as const, text: t.outbound, ts: t.createdAt })),
  ]

  // Sort chronologically.
  // Tie-breaking for exact same ts:
  //   1. Customer before Ashkan (message received before reply written).
  //   2. Same type, same ts → return 0: JS sort is stable (V8/Node 12+), so the
  //      original input-array order is preserved — which reflects the DB ORDER BY
  //      created_at ASC, id ASC from fetchHistoricalInbound. This is message-arrival
  //      sequence, not arbitrary text order.
  events.sort((a, b) => {
    const cmp = a.ts.localeCompare(b.ts)
    if (cmp !== 0) return cmp
    if (a.type !== b.type) return a.type === 'customer' ? -1 : 1
    return 0  // preserve input/DB order (stable sort)
  })

  if (events.length === 0) return ''

  const lines = events.map(e => e.type === 'customer' ? `Customer: ${e.text}` : `Ashkan: ${e.text}`)
  const fullText = lines.join('\n')

  if (fullText.length <= MAX_CHAR_BUDGET) return fullText

  const marker = '\n[... conversation history shortened for context budget ...]\n'
  const anchors = lines.slice(0, ANCHOR_EVENTS)
  const headBudget = Math.floor((MAX_CHAR_BUDGET - marker.length) / 2)
  const perAnchor = Math.max(1, Math.floor(headBudget / Math.max(1, anchors.length)) - 1)
  const head = anchors.map(line => line.length <= perAnchor ? line :
    line.slice(0, perAnchor - 16) + ' [...shortened]').join('\n')
  const tailBudget = MAX_CHAR_BUDGET - head.length - marker.length
  let tail = fullText.slice(-tailBudget)
  const nl = tail.indexOf('\n')
  if (nl >= 0) tail = tail.slice(nl + 1)
  return head + marker + tail
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
  const confirmed = new Set(inboundRows.filter(r => r.confirmed).map(r => r.id))
  return buildMergedHistory(inboundRows, feedbackTurns.filter(t => t.bufferId && confirmed.has(t.bufferId)))
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
