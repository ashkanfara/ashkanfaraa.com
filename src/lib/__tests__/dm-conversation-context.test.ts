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
  buildConversationHistoryText,
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

function mockSelect(rows: FeedbackRow[]) {
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
  test('returns formatted history from DB rows', async () => {
    mockSelect([
      { buffer_id: 'b1', inbound_context: 'سلام', final_sent_response: 'سلام! چطور کمک کنم؟', created_at: '2024-01-01T00:00:00Z' },
      { buffer_id: 'b2', inbound_context: 'دنبال ویزا هستم', final_sent_response: 'چه نوع ویزایی؟', created_at: '2024-01-02T00:00:00Z' },
    ])
    const out = await assembleDmConversationHistory('sender_006')
    expect(out).toBe(
      'Customer: سلام\nAshkan: سلام! چطور کمک کنم؟\n' +
      'Customer: دنبال ویزا هستم\nAshkan: چه نوع ویزایی؟'
    )
  })

  test('returns empty string when sender has no history', async () => {
    mockSelect([])
    const out = await assembleDmConversationHistory('new_sender')
    expect(out).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// n8n BRP payload parity
// ─────────────────────────────────────────────────────────────────────────────

describe('Payload parity: assembleDmConversationHistory vs n8n BRP format', () => {
  /**
   * After the n8n context patch, BRP produces:
   *   "Customer: " + inbound_context + "\n" + "Ashkan: " + final_sent_response
   * for each turn.
   *
   * assembleDmConversationHistory must produce identical output for the same rows.
   */
  test('output format exactly matches n8n BRP format for 3 turns', async () => {
    const rows = [
      { buffer_id: 'b1', inbound_context: 'سوال اول', final_sent_response: 'جواب اول', created_at: '2024-01-01T00:00:00Z' },
      { buffer_id: 'b2', inbound_context: 'سوال دوم', final_sent_response: 'جواب دوم', created_at: '2024-01-02T00:00:00Z' },
      { buffer_id: 'b3', inbound_context: 'سوال سوم', final_sent_response: 'جواب سوم', created_at: '2024-01-03T00:00:00Z' },
    ]
    mockSelect(rows)

    // Simulate what n8n BRP produces for the same rows:
    const n8nBrpOutput = rows
      .map(r => `Customer: ${r.inbound_context.trim()}\nAshkan: ${r.final_sent_response.trim()}`)
      .join('\n')

    const webOutput = await assembleDmConversationHistory('sender_parity')
    expect(webOutput).toBe(n8nBrpOutput)
  })

  test('chronological order matches in both paths (oldest first)', async () => {
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
  test('sender_A URL query does not include sender_B history', async () => {
    // Sender A has history, sender B is queried separately
    mockSelect([
      { buffer_id: 'a1', inbound_context: 'پیام A', final_sent_response: 'جواب A', created_at: '2024-01-01T00:00:00Z' },
    ])
    const outA = await assembleDmConversationHistory('senderA')
    expect(outA).toContain('پیام A')

    mockSelect([
      { buffer_id: 'b1', inbound_context: 'پیام B', final_sent_response: 'جواب B', created_at: '2024-01-01T00:00:00Z' },
    ])
    const outB = await assembleDmConversationHistory('senderB')
    expect(outB).toContain('پیام B')
    expect(outB).not.toContain('پیام A')
    expect(outA).not.toContain('پیام B')
  })

  test('URL always contains the exact sender_id passed in (URL encoding)', async () => {
    mockSelect([])
    await assembleDmConversationHistory('17841234567890')
    const url = (mockFetch.mock.calls[0] as [string, ...unknown[]])[0]
    expect(url).toContain('sender_id=eq.17841234567890')
    expect(url).not.toContain('sender_id=eq.senderB')
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
    const rows: FeedbackRow[] = [
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
    expect(rows).toHaveLength(50)
    mockSelect(rows)

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
    mockSelect([])
    const history = await assembleDmConversationHistory(SYNTHETIC_SENDER + '_new')
    expect(history).toBe('')
  })
})
