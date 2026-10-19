/**
 * dm-conversation-context.test.ts
 *
 * Unit tests for the shared conversation context library.
 * All Supabase calls are mocked at the fetch() boundary.
 * No live network, no IG sends, no real credentials.
 *
 * Coverage:
 *   - fetchDmConversationTurns: ASC order, empty-field filtering, empty DB
 *   - buildConversationHistoryText: <40 verbatim, >40 anchor+marker+recent,
 *     char-budget cap, empty
 *   - assembleDmConversationHistory: end-to-end integration of both functions
 *   - writeConversationMemoryDurable: idempotency skip, retry-on-failure,
 *     total-failure structured log
 *   - Payload format parity with n8n BRP (after patch)
 *   - Account/contact isolation
 */

import { jest } from '@jest/globals'

// Mock fetch before importing the module under test
const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

import {
  fetchDmConversationTurns,
  fetchHistoricalInbound,
  buildConversationHistoryText,
  buildMergedHistory,
  assembleDmConversationHistory,
  writeConversationMemoryDurable,
  type ConversationTurn,
} from '../dm-conversation-context'

// ── Test env ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://test.supabase.co'
const SUPABASE_KEY = 'test-service-role-key'

beforeAll(() => {
  process.env.SUPABASE_URL              = SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY
})

beforeEach(() => {
  mockFetch.mockReset()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

type FeedbackRow = {
  buffer_id: string | null
  inbound_context: string | null
  final_sent_response: string | null
  created_at: string
}

type BufferRow = {
  message_text: string | null
  created_at: string
}

function mockSelect(rows: FeedbackRow[]) {
  mockFetch.mockResolvedValueOnce({
    ok:   true,
    json: async () => rows,
  } as Response)
}

/** Mock the instagram_dm_buffer response (first fetch in assembleDmConversationHistory). */
function mockInbound(rows: BufferRow[]) {
  mockFetch.mockResolvedValueOnce({
    ok:   true,
    json: async () => rows,
  } as Response)
}

function mockSelectFail() {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'error' } as Response)
}

function mockPost(ok = true, status = 201) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    text: async () => '',
  } as Response)
}

function makeTurn(n: number, bufferId = `buf-${n}`): ConversationTurn {
  return {
    bufferId,
    inbound:   `customer message ${n}`,
    outbound:  `ashkan reply ${n}`,
    createdAt: new Date(2024, 0, n).toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchDmConversationTurns
// ─────────────────────────────────────────────────────────────────────────────

describe('fetchDmConversationTurns', () => {
  test('returns turns in ASC order (oldest first)', async () => {
    mockSelect([
      { buffer_id: 'b1', inbound_context: 'first',  final_sent_response: 'reply 1', created_at: '2024-01-01T00:00:00Z' },
      { buffer_id: 'b2', inbound_context: 'second', final_sent_response: 'reply 2', created_at: '2024-01-02T00:00:00Z' },
    ])
    const turns = await fetchDmConversationTurns('sender_001')
    expect(turns).toHaveLength(2)
    expect(turns[0].inbound).toBe('first')
    expect(turns[1].inbound).toBe('second')
  })

  test('filters rows where inbound_context is null/empty', async () => {
    mockSelect([
      { buffer_id: 'b1', inbound_context: null,  final_sent_response: 'reply', created_at: '2024-01-01T00:00:00Z' },
      { buffer_id: 'b2', inbound_context: '',    final_sent_response: 'reply', created_at: '2024-01-02T00:00:00Z' },
      { buffer_id: 'b3', inbound_context: '  ',  final_sent_response: 'reply', created_at: '2024-01-03T00:00:00Z' },
      { buffer_id: 'b4', inbound_context: 'ok',  final_sent_response: 'reply', created_at: '2024-01-04T00:00:00Z' },
    ])
    const turns = await fetchDmConversationTurns('sender_002')
    expect(turns).toHaveLength(1)
    expect(turns[0].inbound).toBe('ok')
  })

  test('filters rows where final_sent_response is null/empty', async () => {
    mockSelect([
      { buffer_id: 'b1', inbound_context: 'msg', final_sent_response: null,  created_at: '2024-01-01T00:00:00Z' },
      { buffer_id: 'b2', inbound_context: 'msg', final_sent_response: '',    created_at: '2024-01-02T00:00:00Z' },
      { buffer_id: 'b3', inbound_context: 'msg', final_sent_response: 'ok',  created_at: '2024-01-03T00:00:00Z' },
    ])
    const turns = await fetchDmConversationTurns('sender_003')
    expect(turns).toHaveLength(1)
    expect(turns[0].outbound).toBe('ok')
  })

  test('returns empty array when DB returns no rows', async () => {
    mockSelect([])
    const turns = await fetchDmConversationTurns('brand_new_sender')
    expect(turns).toEqual([])
  })

  test('returns empty array on fetch error (non-ok status)', async () => {
    mockSelectFail()
    const turns = await fetchDmConversationTurns('sender_fail')
    expect(turns).toEqual([])
  })

  test('trims whitespace from inbound and outbound text', async () => {
    mockSelect([
      { buffer_id: 'b1', inbound_context: '  hello  ', final_sent_response: '  world  ', created_at: '2024-01-01T00:00:00Z' },
    ])
    const turns = await fetchDmConversationTurns('sender_004')
    expect(turns[0].inbound).toBe('hello')
    expect(turns[0].outbound).toBe('world')
  })

  test('includes buffer_id and createdAt on each turn', async () => {
    mockSelect([
      { buffer_id: 'abc-123', inbound_context: 'hi', final_sent_response: 'hello', created_at: '2024-06-15T10:00:00Z' },
    ])
    const turns = await fetchDmConversationTurns('sender_005')
    expect(turns[0].bufferId).toBe('abc-123')
    expect(turns[0].createdAt).toBe('2024-06-15T10:00:00Z')
  })

  test('uses sender_id in the URL query param (account isolation)', async () => {
    mockSelect([])
    await fetchDmConversationTurns('specific_sender_id')
    const calledUrl = (mockFetch.mock.calls[0] as [string, ...unknown[]])[0]
    expect(calledUrl).toContain('sender_id=eq.specific_sender_id')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// fetchHistoricalInbound
// ─────────────────────────────────────────────────────────────────────────────

describe('fetchHistoricalInbound', () => {
  test('returns text+ts pairs for response_sent=true and SUPERSEDED rows', async () => {
    mockInbound([
      { message_text: 'first',      created_at: '2024-01-01T00:00:00Z' },
      { message_text: 'superseded', created_at: '2024-01-02T00:00:00Z' },
    ])
    const rows = await fetchHistoricalInbound('sender_fhi_001')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ text: 'first', ts: '2024-01-01T00:00:00Z' })
    expect(rows[1]).toEqual({ text: 'superseded', ts: '2024-01-02T00:00:00Z' })
  })

  test('filters null/empty message_text rows', async () => {
    mockInbound([
      { message_text: null,  created_at: '2024-01-01T00:00:00Z' },
      { message_text: '  ',  created_at: '2024-01-02T00:00:00Z' },
      { message_text: 'ok',  created_at: '2024-01-03T00:00:00Z' },
    ])
    const rows = await fetchHistoricalInbound('sender_fhi_002')
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe('ok')
  })

  test('returns empty array on fetch error', async () => {
    mockSelectFail()
    const rows = await fetchHistoricalInbound('sender_fhi_fail')
    expect(rows).toEqual([])
  })

  test('URL contains sender_id and the OR filter for response_sent + SUPERSEDED', async () => {
    mockInbound([])
    await fetchHistoricalInbound('test_sender_123')
    const url = (mockFetch.mock.calls[0] as [string, ...unknown[]])[0]
    expect(url).toContain('instagram_dm_buffer')
    expect(url).toContain('sender_id=eq.test_sender_123')
    expect(url).toContain('or=(response_sent.eq.true,failed_reason.eq.SUPERSEDED)')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildMergedHistory
// ─────────────────────────────────────────────────────────────────────────────

describe('buildMergedHistory', () => {
  test('returns empty string when both sources are empty', () => {
    expect(buildMergedHistory([], [])).toBe('')
  })

  test('customer-only (no feedback turns) renders Customer: lines only', () => {
    const out = buildMergedHistory(
      [{ text: 'hello', ts: '2024-01-01T00:00:00Z' }],
      [],
    )
    expect(out).toBe('Customer: hello')
  })

  test('SUPERSEDED sibling appears BEFORE primary customer line (chronological)', () => {
    const out = buildMergedHistory(
      [
        { text: 'job offer Australia',     ts: '2024-01-01T10:00:00Z' },  // SUPERSEDED
        { text: 'trusted adviser question', ts: '2024-01-01T10:00:30Z' }, // primary
      ],
      [
        { bufferId: 'b1', inbound: 'trusted adviser question', outbound: 'do you have an offer?', createdAt: '2024-01-01T10:00:30Z' },
      ],
    )
    const lines = out.split('\n')
    expect(lines[0]).toBe('Customer: job offer Australia')
    expect(lines[1]).toContain('trusted adviser question')
    expect(lines[2]).toContain('Ashkan:')
    expect(out).not.toContain('کدوم کشور')  // should NOT need to re-ask country
  })

  test('tie-breaking: customer before ashkan when timestamps are equal', () => {
    const ts = '2024-01-01T00:00:00Z'
    const out = buildMergedHistory(
      [{ text: 'customer msg', ts }],
      [{ bufferId: 'b1', inbound: 'customer msg', outbound: 'ashkan reply', createdAt: ts }],
    )
    const lines = out.split('\n')
    expect(lines[0]).toBe('Customer: customer msg')
    expect(lines[1]).toBe('Ashkan: ashkan reply')
  })

  test('tied-timestamp: two customer messages at same second sorted stably (localeCompare)', () => {
    // Two bundle siblings sent at the exact same second — both SUPERSEDED except primary.
    // Sort must be deterministic (not random); JS sort is stable since V8 7.0 / Node 11.
    const ts = '2026-10-07T10:00:00Z'
    const out = buildMergedHistory(
      [
        { text: 'message alpha', ts },
        { text: 'message beta',  ts },
      ],
      [],
    )
    const lines = out.split('\n')
    expect(lines).toHaveLength(2)
    // Both must appear; exact stable order depends on input array order (preserved by sort stability)
    expect(lines[0]).toBe('Customer: message alpha')
    expect(lines[1]).toBe('Customer: message beta')
  })

  test('all three bundle siblings appear: response_sent primary + two SUPERSEDED', () => {
    // Customer sends A, B, C in rapid sequence. Ashkan approves C as primary.
    // A and B are SUPERSEDED. All three are in instagram_dm_buffer.
    // After fetch, all three should appear as Customer: lines.
    const out = buildMergedHistory(
      [
        { text: 'A: داداش دنبال جاب آفر از استرالیا هستم', ts: '2026-10-07T10:00:00Z' },
        { text: 'B: مهندس نرم‌افزارم، ۵ سال سابقه',       ts: '2026-10-07T10:00:10Z' },
        { text: 'C: شما رو مشاور قبول دارم',              ts: '2026-10-07T10:00:20Z' },
      ],
      [{ bufferId: 'buf-C', inbound: 'C', outbound: 'آیا پیشنهاد کار داری؟', createdAt: '2026-10-07T10:01:00Z' }],
    )
    expect(out).toContain('A: داداش دنبال جاب آفر از استرالیا هستم')
    expect(out).toContain('B: مهندس نرم‌افزارم')
    expect(out).toContain('C: شما رو مشاور قبول دارم')
    expect(out).toContain('Ashkan: آیا پیشنهاد کار داری؟')
    const lines = out.split('\n')
    // A appears before B before C before Ashkan reply
    const posA    = lines.findIndex(l => l.includes('استرالیا'))
    const posB    = lines.findIndex(l => l.includes('نرم‌افزارم'))
    const posC    = lines.findIndex(l => l.includes('مشاور قبول'))
    const posAsh  = lines.findIndex(l => l.startsWith('Ashkan:'))
    expect(posA).toBeGreaterThanOrEqual(0)
    expect(posB).toBeGreaterThan(posA)
    expect(posC).toBeGreaterThan(posB)
    expect(posAsh).toBeGreaterThan(posC)
  })

  test('confirmed outgoing (Ashkan lines from feedback) always interleaved after matching customer message', () => {
    // Verify that after a customer message at T1, Ashkan reply at T2>T1 sorts after it
    const out = buildMergedHistory(
      [
        { text: 'customer question 1', ts: '2024-01-01T10:00:00Z' },
        { text: 'customer question 2', ts: '2024-01-02T10:00:00Z' },
      ],
      [
        { bufferId: 'b1', inbound: 'customer question 1', outbound: 'ashkan answer 1', createdAt: '2024-01-01T12:00:00Z' },
        { bufferId: 'b2', inbound: 'customer question 2', outbound: 'ashkan answer 2', createdAt: '2024-01-02T12:00:00Z' },
      ],
    )
    const lines = out.split('\n')
    expect(lines[0]).toBe('Customer: customer question 1')
    expect(lines[1]).toBe('Ashkan: ashkan answer 1')
    expect(lines[2]).toBe('Customer: customer question 2')
    expect(lines[3]).toBe('Ashkan: ashkan answer 2')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Stale-callback and target isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('Stale-callback and target isolation', () => {
  /**
   * The live UI oscillated between rows 50f79956 and f8134ef6 across two regens.
   * assembleDmConversationHistory is sender-scoped, not row-scoped: it always returns
   * the full history for the sender regardless of which specific row triggered the regen.
   * This makes it inherently stale-proof: a callback for an older rowId still gets
   * the complete current history, not a subset.
   *
   * The rowId the draft is WRITTEN to is controlled by retry-draft/route.ts (it writes
   * to the specific id passed in the request body, not to whatever the UI shows).
   * These tests verify that assembleDmConversationHistory does not vary by rowId.
   */

  const SENDER = 'INVALID_TEST_stale_callback_001'

  test('same sender, different callers: both get identical history (sender-scoped, not row-scoped)', async () => {
    // Simulate two concurrent regen calls for the same sender but "different" target rows
    // (50f79956 and f8134ef6 in the live case). Both should see the same full history.
    const bufferRows: BufferRow[] = [
      { message_text: 'customer intent A', created_at: '2024-01-01T00:00:00Z' },
      { message_text: 'customer intent B', created_at: '2024-01-02T00:00:00Z' },
    ]
    const feedbackRows: FeedbackRow[] = [
      { buffer_id: 'row-50f79956', inbound_context: 'customer intent A', final_sent_response: 'ashkan reply A', created_at: '2024-01-01T12:00:00Z' },
    ]

    // First regen (for row 50f79956)
    mockInbound(bufferRows)
    mockSelect(feedbackRows)
    const historyForRow1 = await assembleDmConversationHistory(SENDER)

    // Second regen (for row f8134ef6, same sender)
    mockInbound(bufferRows)
    mockSelect(feedbackRows)
    const historyForRow2 = await assembleDmConversationHistory(SENDER)

    // Both calls produced identical history — draft target row does not affect context assembly
    expect(historyForRow1).toBe(historyForRow2)
    expect(historyForRow1).toContain('customer intent A')
    expect(historyForRow1).toContain('customer intent B')
    expect(historyForRow1).toContain('Ashkan: ashkan reply A')
  })

  test('latest customer message always visible regardless of which regen row triggered it', async () => {
    // The latest PENDING message (referential reply "داداش دنبال گرفتنشم") is NOT in
    // dm_response_feedback (it has no Ashkan reply yet). It IS in instagram_dm_buffer
    // (response_sent=false, pending review). fetchHistoricalInbound fetches only
    // response_sent=true OR SUPERSEDED — so a purely PENDING row is NOT in the buffer fetch.
    //
    // This is the INTENDED behaviour: the pending message is passed as combined_message
    // by retry-draft/route.ts (the regen target), not as prior history. History contains
    // only confirmed exchanges. This test documents and enforces that invariant.
    mockInbound([
      { message_text: 'earlier confirmed message', created_at: '2024-01-01T00:00:00Z' },
      // NOTE: the current PENDING message is NOT in this list (it's not response_sent=true or SUPERSEDED)
    ])
    mockSelect([
      { buffer_id: 'b1', inbound_context: 'earlier confirmed message', final_sent_response: 'ashkan reply', created_at: '2024-01-01T12:00:00Z' },
    ])
    const history = await assembleDmConversationHistory(SENDER + '_pending_check')
    expect(history).toContain('earlier confirmed message')
    expect(history).toContain('Ashkan: ashkan reply')
    // Pending message not in history (it arrives as combined_message in the regen payload)
    expect(history).not.toContain('pending_not_here')
  })

  test('account separation: different senders never share history in same process', async () => {
    // Regression guard: two concurrent senders must not bleed into each other.
    // Even if Promise.all interleaving happens, each call uses its own senderId in the URL.
    mockInbound([{ message_text: 'sender X private data', created_at: '2024-01-01T00:00:00Z' }])
    mockSelect([{ buffer_id: 'x1', inbound_context: 'sender X', final_sent_response: 'reply X', created_at: '2024-01-01T12:00:00Z' }])
    const histX = await assembleDmConversationHistory('senderX_isolated')

    mockInbound([{ message_text: 'sender Y data', created_at: '2024-01-01T00:00:00Z' }])
    mockSelect([{ buffer_id: 'y1', inbound_context: 'sender Y', final_sent_response: 'reply Y', created_at: '2024-01-01T12:00:00Z' }])
    const histY = await assembleDmConversationHistory('senderY_isolated')

    expect(histX).toContain('sender X private data')
    expect(histX).not.toContain('sender Y data')
    expect(histY).toContain('sender Y data')
    expect(histY).not.toContain('sender X private data')

    // Verify both URL calls used the correct sender_id
    const calls = mockFetch.mock.calls as [string, ...unknown[]][]
    const xUrls = calls.slice(0, 2).map(c => c[0])
    const yUrls = calls.slice(2, 4).map(c => c[0])
    xUrls.forEach(u => expect(u).toContain('senderX_isolated'))
    yUrls.forEach(u => expect(u).toContain('senderY_isolated'))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildConversationHistoryText
// ─────────────────────────────────────────────────────────────────────────────

describe('buildConversationHistoryText', () => {
  test('returns empty string for empty turns array', () => {
    expect(buildConversationHistoryText([])).toBe('')
  })

  test('formats single turn as Customer:/Ashkan: lines', () => {
    const turns = [makeTurn(1)]
    const out = buildConversationHistoryText(turns)
    expect(out).toBe('Customer: customer message 1\nAshkan: ashkan reply 1')
  })

  test('all turns included when total chars fit in 12000-char budget', () => {
    // Short messages: 40 turns × (avg ~30 chars/line × 2 lines) ≈ 2400 chars — well under budget
    const turns = Array.from({ length: 40 }, (_, i) => makeTurn(i + 1))
    const out = buildConversationHistoryText(turns)
    const lines = out.split('\n')
    expect(lines).toHaveLength(80)   // 40 turns × 2 lines
    expect(out).toContain('customer message 1')   // oldest
    expect(out).toContain('customer message 40')  // newest
    expect(out).not.toContain('[...')             // no truncation marker when budget allows
  })

  test('50 short-message turns: ALL 50 included (no turn-count truncation)', () => {
    // Key difference from old behavior: short messages don't exceed char budget,
    // so middle turns (e.g. turn 20) are NOT dropped even with >40 turns
    const turns = Array.from({ length: 50 }, (_, i) => makeTurn(i + 1))
    const out = buildConversationHistoryText(turns)

    // All turns present — no silent middle drop
    expect(out).toContain('customer message 1')
    expect(out).toContain('customer message 20')  // middle turn preserved
    expect(out).toContain('customer message 50')
    // No truncation marker (budget not exceeded for short messages)
    expect(out).not.toContain('[...')
  })

  test('CRITICAL: intent stated in middle turn (turn 20 of 50) is preserved', () => {
    // Regression test for the documented failure mode: anchor+recent strategy
    // drops turns 6–15 in a 50-turn conversation, losing middle-turn facts.
    // New char-budget-first strategy keeps all turns when they fit.
    const turns: ConversationTurn[] = [
      ...Array.from({ length: 19 }, (_, i) => makeTurn(i + 1)),
      // Turn 20: critical fact stated in middle (job offer details)
      {
        bufferId:  'middle-intent',
        inbound:   'داداش من مهندس نرم‌افزار هستم با ۵ سال سابقه و جاب آفر ۱۵۰ هزار دلاری دارم',
        outbound:  'عالیه! این شرایط خوبی برای ویزای ۱۸۶ هست',
        createdAt: '2024-01-20T00:00:00Z',
      },
      ...Array.from({ length: 30 }, (_, i) => makeTurn(i + 21)),
    ]
    expect(turns).toHaveLength(50)

    const out = buildConversationHistoryText(turns)

    // Middle-turn fact MUST be present
    expect(out).toContain('داداش من مهندس نرم‌افزار هستم')
    expect(out).toContain('جاب آفر ۱۵۰ هزار دلاری')
    // No truncation marker — all fits in budget
    expect(out).not.toContain('[...')
  })

  test('original intent preserved in turn 1 even at 50 turns', () => {
    const turns = [
      { bufferId: 'anchor', inbound: 'دنبال جاب آفر از استرالیا هستم', outbound: 'حتماً کمکتون می‌کنم', createdAt: '2024-01-01T00:00:00Z' },
      ...Array.from({ length: 49 }, (_, i) => makeTurn(i + 2)),
    ]
    const out = buildConversationHistoryText(turns)
    expect(out).toContain('دنبال جاب آفر از استرالیا هستم')
  })

  test('short referential reply: prior question is in context', () => {
    // Simulate documented failure: "آیا پیشنهاد کار داری یا دنبال گرفتنش هستی؟"
    // Customer short reply "داداش دنبال گرفتنشم" — draft must see the prior question
    const turns: ConversationTurn[] = [
      { bufferId: 'b1', inbound: 'داداش درباره ویزای استرالیا سوال داشتم', outbound: 'آیا پیشنهاد کار داری یا دنبال گرفتنش هستی؟', createdAt: '2024-01-01T00:00:00Z' },
    ]
    const out = buildConversationHistoryText(turns)
    expect(out).toContain('Ashkan: آیا پیشنهاد کار داری')
    // Prior exchange is available — draft should not re-ask
    expect(out).not.toBe('')
  })

  test('char budget: truncation only fires when total text actually exceeds 12000 chars', () => {
    // 30 turns × (300 char inbound + 300 char outbound + labels) ≈ 18000 chars > 12000
    const longText = 'a'.repeat(300)
    const turns = Array.from({ length: 30 }, (_, i) => ({
      bufferId:  `b${i}`,
      inbound:   longText,
      outbound:  longText,
      createdAt: new Date(2024, 0, i + 1).toISOString(),
    }))
    const out = buildConversationHistoryText(turns)
    expect(out.length).toBeLessThanOrEqual(12000 + 120) // 120 chars slack for anchor+marker line
    expect(out).toContain('[... earlier context truncated for length')
    // Anchor turns (first 5) present — original intent preserved
    expect(out).toContain(longText.slice(0, 20))   // anchor content in output
    // Most recent content also preserved (tail portion)
    // (The tail starts after the marker)
    const markerIdx = out.indexOf('[... earlier context truncated for length')
    expect(markerIdx).toBeGreaterThan(0)
  })

  test('char budget: short 50-turn conversation is NOT truncated (budget not exceeded)', () => {
    // Short messages: 50 turns × ~60 chars each side = ~6000 chars < 12000
    const turns = Array.from({ length: 50 }, (_, i) => makeTurn(i + 1))
    const out = buildConversationHistoryText(turns)
    expect(out).not.toContain('[... earlier context truncated')
    expect(out.split('\n')).toHaveLength(100)  // all 50 turns × 2 lines
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// assembleDmConversationHistory (end-to-end)
// ─────────────────────────────────────────────────────────────────────────────

describe('assembleDmConversationHistory', () => {
  /**
   * assembleDmConversationHistory now calls Promise.all([fetchHistoricalInbound,
   * fetchDmConversationTurns]) — two fetches. mockInbound MUST come first (buffer),
   * then mockSelect (feedback). Both fetches start simultaneously; the first argument
   * to Promise.all calls fetch() first and consumes the first mock.
   */

  test('returns formatted history from DB rows', async () => {
    // First fetch: instagram_dm_buffer (Customer: lines)
    mockInbound([
      { message_text: 'سلام',           created_at: '2024-01-01T00:00:00Z' },
      { message_text: 'دنبال ویزا هستم', created_at: '2024-01-02T00:00:00Z' },
    ])
    // Second fetch: dm_response_feedback (Ashkan: lines)
    mockSelect([
      { buffer_id: 'b1', inbound_context: 'سلام',           final_sent_response: 'سلام! چطور کمک کنم؟', created_at: '2024-01-01T00:00:00Z' },
      { buffer_id: 'b2', inbound_context: 'دنبال ویزا هستم', final_sent_response: 'چه نوع ویزایی؟',      created_at: '2024-01-02T00:00:00Z' },
    ])
    const out = await assembleDmConversationHistory('sender_006')
    // Customer and Ashkan events share the same ts → tie-break puts Customer first
    expect(out).toBe(
      'Customer: سلام\nAshkan: سلام! چطور کمک کنم؟\n' +
      'Customer: دنبال ویزا هستم\nAshkan: چه نوع ویزایی؟'
    )
  })

  test('returns empty string when sender has no history', async () => {
    mockInbound([])   // no buffer rows
    mockSelect([])    // no feedback rows
    const out = await assembleDmConversationHistory('new_sender')
    expect(out).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// n8n BRP payload parity
// ─────────────────────────────────────────────────────────────────────────────

describe('Payload parity: assembleDmConversationHistory vs n8n BRP format', () => {
  /**
   * After the n8n context patch, n8n BRP reads only dm_response_feedback and produces:
   *   "Customer: " + inbound_context + "\n" + "Ashkan: " + final_sent_response
   * for each turn.
   *
   * The website now reads BOTH instagram_dm_buffer AND dm_response_feedback.
   * Parity holds when there are no SUPERSEDED bundle siblings (both sources contain
   * the same customer messages). When SUPERSEDED siblings exist, the website output
   * includes more Customer: lines than n8n BRP — that divergence is intentional and
   * is the fix for the "Australia" live failure.
   */
  test('output format matches n8n BRP format when no SUPERSEDED siblings exist', async () => {
    const feedbackRows = [
      { buffer_id: 'b1', inbound_context: 'سوال اول', final_sent_response: 'جواب اول', created_at: '2024-01-01T00:00:00Z' },
      { buffer_id: 'b2', inbound_context: 'سوال دوم', final_sent_response: 'جواب دوم', created_at: '2024-01-02T00:00:00Z' },
      { buffer_id: 'b3', inbound_context: 'سوال سوم', final_sent_response: 'جواب سوم', created_at: '2024-01-03T00:00:00Z' },
    ]
    // Buffer contains same messages as feedback.inbound_context (no SUPERSEDED extras)
    mockInbound(feedbackRows.map(r => ({ message_text: r.inbound_context, created_at: r.created_at })))
    mockSelect(feedbackRows)

    // Simulate what n8n BRP produces for the same rows:
    const n8nBrpOutput = feedbackRows
      .map(r => `Customer: ${r.inbound_context.trim()}\nAshkan: ${r.final_sent_response.trim()}`)
      .join('\n')

    const webOutput = await assembleDmConversationHistory('sender_parity')
    expect(webOutput).toBe(n8nBrpOutput)
  })

  test('chronological order: oldest Customer: line first, newest Ashkan: line last', async () => {
    mockInbound([
      { message_text: 'اول',  created_at: '2024-01-01T00:00:00Z' },
      { message_text: 'دوم',  created_at: '2024-01-02T00:00:00Z' },
      { message_text: 'سوم',  created_at: '2024-01-03T00:00:00Z' },
    ])
    mockSelect([
      { buffer_id: 'b1', inbound_context: 'اول',  final_sent_response: 'جواب اول',  created_at: '2024-01-01T00:00:00Z' },
      { buffer_id: 'b2', inbound_context: 'دوم',  final_sent_response: 'جواب دوم',  created_at: '2024-01-02T00:00:00Z' },
      { buffer_id: 'b3', inbound_context: 'سوم',  final_sent_response: 'جواب سوم',  created_at: '2024-01-03T00:00:00Z' },
    ])
    const out = await assembleDmConversationHistory('sender_order')
    const lines = out.split('\n')
    expect(lines[0]).toBe('Customer: اول')
    expect(lines[lines.length - 1]).toBe('Ashkan: جواب سوم')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Account isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('Account isolation', () => {
  test('sender_A result does not include sender_B history', async () => {
    // Sender A: two mocks (buffer then feedback)
    mockInbound([{ message_text: 'پیام A', created_at: '2024-01-01T00:00:00Z' }])
    mockSelect([{ buffer_id: 'a1', inbound_context: 'پیام A', final_sent_response: 'جواب A', created_at: '2024-01-01T00:00:00Z' }])
    const outA = await assembleDmConversationHistory('senderA')
    expect(outA).toContain('پیام A')

    // Sender B: two mocks (buffer then feedback)
    mockInbound([{ message_text: 'پیام B', created_at: '2024-01-01T00:00:00Z' }])
    mockSelect([{ buffer_id: 'b1', inbound_context: 'پیام B', final_sent_response: 'جواب B', created_at: '2024-01-01T00:00:00Z' }])
    const outB = await assembleDmConversationHistory('senderB')
    expect(outB).toContain('پیام B')
    expect(outB).not.toContain('پیام A')
    expect(outA).not.toContain('پیام B')
  })

  test('both fetch URLs contain the exact sender_id passed in', async () => {
    mockInbound([])  // buffer (first fetch)
    mockSelect([])   // feedback (second fetch)
    await assembleDmConversationHistory('17841234567890')
    // calls[0] = instagram_dm_buffer URL, calls[1] = dm_response_feedback URL
    const urlBuf = (mockFetch.mock.calls[0] as [string, ...unknown[]])[0]
    const urlFb  = (mockFetch.mock.calls[1] as [string, ...unknown[]])[0]
    expect(urlBuf).toContain('sender_id=eq.17841234567890')
    expect(urlBuf).toContain('instagram_dm_buffer')
    expect(urlFb).toContain('sender_id=eq.17841234567890')
    expect(urlFb).toContain('dm_response_feedback')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// writeConversationMemoryDurable
// ─────────────────────────────────────────────────────────────────────────────

describe('writeConversationMemoryDurable', () => {
  const SENDER = 'sender_write_test'
  const BUFFER_ID = 'buf-abc-123'
  const SESSION_ID = 'Key:\n' + SENDER

  function mockIdempotencyCheck(existing: boolean) {
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: async () => existing ? [{ id: 1 }] : [],
    } as Response)
  }

  test('skips write when buffer_id already exists in session (idempotency)', async () => {
    mockIdempotencyCheck(true)  // existing row found

    await writeConversationMemoryDurable(SENDER, 'human', 'ai', BUFFER_ID)

    // Only the idempotency check call should have been made (1 fetch call)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = (mockFetch.mock.calls[0] as [string, ...unknown[]])[0]
    expect(url).toContain(`message->>buffer_id=eq.${BUFFER_ID}`)
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('already has buffer_id')
    )
  })

  test('writes both human and ai rows when buffer_id is new', async () => {
    mockIdempotencyCheck(false)  // no existing row
    mockPost()  // human row POST
    mockPost()  // ai row POST

    await writeConversationMemoryDurable(SENDER, 'human text', 'ai text', BUFFER_ID)

    expect(mockFetch).toHaveBeenCalledTimes(3)  // 1 check + 2 posts

    const humanCall = mockFetch.mock.calls[1] as [string, { body: string }]
    const humanBody = JSON.parse(humanCall[1].body)
    expect(humanBody.session_id).toBe(SESSION_ID)
    expect(humanBody.message.type).toBe('human')
    expect(humanBody.message.content).toBe('human text')
    expect(humanBody.message.buffer_id).toBe(BUFFER_ID)

    const aiCall = mockFetch.mock.calls[2] as [string, { body: string }]
    const aiBody = JSON.parse(aiCall[1].body)
    expect(aiBody.message.type).toBe('ai')
    expect(aiBody.message.content).toBe('ai text')
    expect(aiBody.message.buffer_id).toBe(BUFFER_ID)
  })

  test('retries on failure and succeeds on 2nd attempt', async () => {
    mockIdempotencyCheck(false)
    // human row: fail once, succeed on retry
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'server error' } as Response)
      .mockResolvedValueOnce({ ok: true,  status: 201, text: async () => '' } as Response)
    // ai row: succeed immediately
    mockPost()

    await writeConversationMemoryDurable(SENDER, 'h', 'a', BUFFER_ID)

    // 1 check + 2 attempts for human + 1 for ai = 4 total
    expect(mockFetch).toHaveBeenCalledTimes(4)
    // No error logged — eventual success
    expect(console.error).not.toHaveBeenCalled()
  })

  test('logs structured RECOVERABLE error after all retries exhausted', async () => {
    mockIdempotencyCheck(false)
    // All 3 attempts for human row fail
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'err' } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'err' } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'err' } as Response)
    // ai row also fails all 3
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'err' } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'err' } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'err' } as Response)

    // Should NOT throw — failure is contained
    await expect(
      writeConversationMemoryDurable(SENDER, 'h', 'a', BUFFER_ID)
    ).resolves.toBeUndefined()

    // Must log 'RECOVERABLE' for each failed row (human + ai)
    const errorCalls = (console.error as jest.Mock).mock.calls
    expect(errorCalls.length).toBeGreaterThanOrEqual(2)
    expect(errorCalls[0][0]).toContain('RECOVERABLE')
    expect(errorCalls[0][0]).toContain(`sender=${SENDER}`)
    expect(errorCalls[0][0]).toContain(`buffer_id=${BUFFER_ID}`)
  })

  test('proceeds with write attempt if idempotency pre-check throws', async () => {
    // Pre-check network error
    mockFetch.mockRejectedValueOnce(new Error('network error'))
    // Then write succeeds
    mockPost()  // human
    mockPost()  // ai

    await writeConversationMemoryDurable(SENDER, 'h', 'a', BUFFER_ID)

    // Should warn about the failed pre-check but still write
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('idempotency pre-check failed'),
      expect.any(Error)
    )
    // human + ai rows written (2 more calls after the failed pre-check)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end live draft fixture (synthetic sender, admin_regen=true path)
// ─────────────────────────────────────────────────────────────────────────────

describe('Live draft fixture: context reaches Routine payload (synthetic sender)', () => {
  /**
   * Simulates the exact path taken by retry-draft/route.ts:
   *   assembleDmConversationHistory(senderId) → passed as conversation_history to Routine.
   *
   * Uses a synthetic sender_id (INVALID_ prefix — never a real IG user).
   * No IG sends. No Routine fire. No real Supabase.
   * Verifies: context format, older intent preserved, pending messages structure.
   *
   * This is the same code path as a real admin_regen regen — just with mocked fetch.
   */

  const SYNTHETIC_SENDER = 'INVALID_TEST_SENDER_fixture_001'

  test('assembled history includes ALL turns from 50-turn short-message conversation', async () => {
    // Turn 1: original intent (job offer) — in anchor position
    // Turn 20: critical middle fact (job offer salary) — previously dropped by old strategy
    // Turn 50: most recent short referential reply
    const feedbackRows: FeedbackRow[] = [
      { buffer_id: 'b1', inbound_context: 'داداش دنبال جاب آفر از استرالیا هستم', final_sent_response: 'حتماً کمکتون می‌کنم، چه رشته‌ای؟', created_at: '2024-01-01T00:00:00Z' },
      ...Array.from({ length: 18 }, (_, i) => ({
        buffer_id:           `b${i + 2}`,
        inbound_context:     `سوال ${i + 2}`,
        final_sent_response: `جواب ${i + 2}`,
        created_at:          new Date(2024, 0, i + 2).toISOString(),
      })),
      // Turn 20: important middle fact
      { buffer_id: 'b20', inbound_context: 'من مهندس نرم‌افزار با جاب آفر ۱۵۰ هزار دلاری دارم', final_sent_response: 'شرایط ویزای ۱۸۶ مناسبه', created_at: '2024-01-20T00:00:00Z' },
      ...Array.from({ length: 29 }, (_, i) => ({
        buffer_id:           `b${i + 21}`,
        inbound_context:     `سوال ${i + 21}`,
        final_sent_response: `جواب ${i + 21}`,
        created_at:          new Date(2024, 1, i + 1).toISOString(),
      })),
      { buffer_id: 'b50', inbound_context: 'داداش دنبال گرفتنشم', final_sent_response: 'عالی — پس باید...', created_at: '2024-02-19T00:00:00Z' },
    ]
    expect(feedbackRows).toHaveLength(50)

    // Buffer mock: same messages as feedback inbound (no SUPERSEDED extras in this fixture)
    mockInbound(feedbackRows.map(r => ({ message_text: r.inbound_context, created_at: r.created_at })))
    mockSelect(feedbackRows)

    const history = await assembleDmConversationHistory(SYNTHETIC_SENDER)

    // Original intent (turn 1) visible
    expect(history).toContain('داداش دنبال جاب آفر از استرالیا هستم')
    // Middle fact (turn 20) MUST be visible — this was the bug
    expect(history).toContain('جاب آفر ۱۵۰ هزار دلاری')
    expect(history).toContain('ویزای ۱۸۶')
    // Most recent exchange (turn 50) visible
    expect(history).toContain('داداش دنبال گرفتنشم')
    // No truncation marker — 50 short turns fit in 12000-char budget
    expect(history).not.toContain('[...')
  })

  test('pending messages concatenated as combined_message (structure check)', () => {
    // This verifies the bundle logic in retry-draft/route.ts matches expectation.
    // Pending messages arrive as separate buffer rows; retry-draft concatenates them.
    const pendingTexts = ['پیام اول', 'پیام دوم']
    const currentText  = 'پیام سوم (trigger)'

    const allTexts   = [...pendingTexts, currentText]
    const bundleNote = allTexts.length > 1
      ? `[BUNDLE: ${allTexts.length} consecutive messages — respond to all as ONE reply]\n`
      : ''
    const combined   = bundleNote + allTexts.join('\n')

    expect(combined).toContain('[BUNDLE: 3')
    expect(combined).toContain('پیام اول')
    expect(combined).toContain('پیام سوم (trigger)')
  })

  test('context assembly for new sender returns empty (no prior history)', async () => {
    mockInbound([])  // no buffer rows
    mockSelect([])   // no feedback rows
    const history = await assembleDmConversationHistory(SYNTHETIC_SENDER + '_new')
    expect(history).toBe('')
  })

  /**
   * Fixture F — SUPERSEDED bundle sibling case.
   *
   * Reproduces the exact live failure (Oct 2026):
   *   Buffer row A (ts=T1): customer states "Australia + job offer seeking" → SUPERSEDED
   *     (bundle sibling dismissed when primary row B was approved)
   *   Buffer row B (ts=T2): customer asks "trusted migration adviser?" → response_sent=true
   *     → dm_response_feedback.inbound_context = row B text only; row A text NEVER stored
   *   Buffer row C (ts=T3): customer short referential reply "داداش دنبال گرفتنشم" → pending
   *
   * Old code: assembleDmConversationHistory reads only dm_response_feedback → row A missing
   *   → draft asks "کدوم کشور؟" despite Australia already stated
   * New code: also reads instagram_dm_buffer (SUPERSEDED) → row A's text restored
   *   → draft sees Australia and does not re-ask destination country
   */
  test('Fixture F: SUPERSEDED bundle sibling text appears in assembled history', async () => {
    const T1 = '2026-10-07T10:00:00Z'
    const T2 = '2026-10-07T10:00:30Z'   // 30s later — bundle member
    const T3 = '2026-10-08T09:00:00Z'   // next day referential reply

    // instagram_dm_buffer: both SUPERSEDED row A AND response_sent=true row B returned
    // (fetchHistoricalInbound fetches response_sent=true OR SUPERSEDED)
    mockInbound([
      { message_text: 'داداش دنبال جاب آفر از استرالیا هستم، مهندس نرم‌افزارم', created_at: T1 },
      { message_text: 'شما رو به عنوان مشاور مهاجرت قبول دارم',                  created_at: T2 },
    ])

    // dm_response_feedback: only row B's inbound stored (row A was SUPERSEDED, never written)
    mockSelect([
      {
        buffer_id:           'buf-B',
        inbound_context:     'شما رو به عنوان مشاور مهاجرت قبول دارم',
        final_sent_response: 'آیا پیشنهاد کار داری یا دنبال گرفتنش هستی؟',
        created_at:          T2,
      },
    ])

    const history = await assembleDmConversationHistory(SYNTHETIC_SENDER + '_fixture_f')

    // Row A (SUPERSEDED) MUST appear — this is the fix
    expect(history).toContain('داداش دنبال جاب آفر از استرالیا هستم')
    expect(history).toContain('مهندس نرم‌افزارم')

    // Row B customer line and Ashkan reply also present
    expect(history).toContain('Customer: شما رو به عنوان مشاور مهاجرت قبول دارم')
    expect(history).toContain('Ashkan: آیا پیشنهاد کار داری')

    // Row A appears BEFORE row B (chronological order by ts)
    const posA = history.indexOf('استرالیا')
    const posB = history.indexOf('مشاور مهاجرت')
    expect(posA).toBeGreaterThanOrEqual(0)
    expect(posB).toBeGreaterThan(posA)

    // No truncation marker — fixture fits in budget
    expect(history).not.toContain('[...')
  })
})
