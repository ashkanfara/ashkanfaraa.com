/**
 * dm-conversation-context.ts
 *
 * Shared conversation context assembly for DM Routine drafts and regeneration.
 *
 * Source of truth: dm_response_feedback — written by saveDmFeedback() after every
 * confirmed send (admin-approved or auto-mode). Has both inbound_context (customer
 * text) and final_sent_response (what was sent). Never includes ambiguous/failed
 * sends in context — only rows with a non-null final_sent_response that corresponds
 * to a user-visible message.
 *
 * Bounded truncation strategy for long conversations:
 *   ≤ MAX_VERBATIM turns  → all turns verbatim, chronological order
 *   > MAX_VERBATIM turns  → first ANCHOR_TURNS turns (anchor older intent)
 *                           + explicit truncation marker
 *                           + most-recent (MAX_VERBATIM - ANCHOR_TURNS) turns
 *
 * This preserves:
 *   - Original intent (job-offer ask, migration goal, etc.) — from anchor turns
 *   - Recent exchange verbatim — for referential replies like "داداش دنبال گرفتنشم"
 *   - No silent drop without a visible marker
 *
 * Memory persistence (instagram_dm_memory):
 *   Written by writeConversationMemoryDurable() after every confirmed IG send.
 *   Used by n8n BRP node until n8n is patched to read dm_response_feedback directly.
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
const FETCH_LIMIT     = 200   // fetch up to 200 turns; realistic max is ~30-50
const ANCHOR_TURNS    = 5     // when char budget forces truncation, preserve oldest 5 turns
const MAX_CHAR_BUDGET = 12000 // primary constraint: hard character cap

// ── Retry parameters for memory writes ──────────────────────────────────────
const MAX_WRITE_ATTEMPTS = 3
const RETRY_DELAY_MS     = 250

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConversationTurn {
  bufferId:      string | null
  inbound:       string  // customer message text
  outbound:      string  // sent reply text
  createdAt:     string
}

// ── Context assembly ──────────────────────────────────────────────────────────

/**
 * Fetch confirmed-send history from dm_response_feedback for this sender.
 * Returns turns in chronological order (oldest first).
 * Only includes turns where both inbound and outbound are non-empty strings.
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
 * Build the conversation_history string passed to the Routine.
 *
 * Primary strategy: include ALL turns. Character budget (12000 chars) is the
 * only truncation gate — not a fixed turn count. This preserves middle-turn
 * facts (e.g. job offer stated in turn 20 of 50) as long as they fit in budget.
 *
 * Real DM conversations in Farsi average ~60–100 chars per message, so 80 turns
 * ≈ 9600 chars — comfortably under budget. Truncation only activates for
 * unusually long histories (>~100 short turns, or fewer long-message turns).
 *
 * When budget IS exceeded: keep ANCHOR_TURNS oldest (preserve original intent)
 * + explicit marker + tail of remaining budget. Never silently drops turns.
 *
 * Format matches BRP output and Routine prompt expectation:
 *   Customer: <text>
 *   Ashkan: <text>
 *   ...
 */
export function buildConversationHistoryText(turns: ConversationTurn[]): string {
  if (turns.length === 0) return ''

  // Build full text — include every turn
  const lines: string[] = []
  for (const t of turns) {
    lines.push(`Customer: ${t.inbound}`)
    lines.push(`Ashkan: ${t.outbound}`)
  }
  const fullText = lines.join('\n')

  // Happy path: all turns fit in budget (the common case)
  if (fullText.length <= MAX_CHAR_BUDGET) return fullText

  // Budget exceeded: anchor oldest ANCHOR_TURNS + marker + tail
  const anchorLines: string[] = []
  for (const t of turns.slice(0, ANCHOR_TURNS)) {
    anchorLines.push(`Customer: ${t.inbound}`)
    anchorLines.push(`Ashkan: ${t.outbound}`)
  }
  const anchorText   = anchorLines.join('\n')
  const marker       = `\n[... earlier context truncated for length — original intent in turns above ...]\n`
  const tailBudget   = MAX_CHAR_BUDGET - anchorText.length - marker.length

  if (tailBudget <= 0) {
    // Anchor itself overflows — tail-only truncation
    const raw = fullText.slice(fullText.length - MAX_CHAR_BUDGET)
    const nl  = raw.indexOf('\n')
    return `[... earlier context truncated for length ...]\n${nl >= 0 ? raw.slice(nl + 1) : raw}`
  }

  const tailRaw = fullText.slice(fullText.length - tailBudget)
  const nl      = tailRaw.indexOf('\n')
  const tail    = nl >= 0 ? tailRaw.slice(nl + 1) : tailRaw
  return `${anchorText}${marker}${tail}`
}

/**
 * Convenience: fetch turns and build text in one call.
 */
export async function assembleDmConversationHistory(senderId: string): Promise<string> {
  const turns = await fetchDmConversationTurns(senderId)
  return buildConversationHistoryText(turns)
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
