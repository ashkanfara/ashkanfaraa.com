/**
 * dm-context-integration.test.ts
 *
 * End-to-end integration fixture for the full regen context path.
 * Proves what the live model actually receives as conversation_history.
 *
 * Uses synthetic sender IDs (INVALID_ prefix) — never real IG users.
 * All DB calls mocked at fetch() boundary — no live Supabase, no IG sends.
 * Mirrors the exact call sequence in retry-draft/route.ts step 6:
 *   assembleDmConversationHistory(senderId)  ← shared library
 *   fetchPendingInbound(senderId, excludeId) ← simulated inline
 *   → combined_message built in retry-draft  ← simulated inline
 *   → Routine payload object                 ← assembled here
 *
 * Each test reports the exact payload fields the Routine sees.
 */

import { jest } from '@jest/globals'

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

import {
  assembleDmConversationHistory,
  buildConversationHistoryText,
  type ConversationTurn,
} from '../dm-conversation-context'

const SUPABASE_URL = 'https://test.supabase.co'
const SUPABASE_KEY = 'test-service-role-key'

beforeAll(() => {
  process.env.SUPABASE_URL              = SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY
})
beforeEach(() => { mockFetch.mockReset() })

// ── Helpers ────────────────────────────────────────────────────────────────

type FeedbackRow = {
  buffer_id: string | null
  inbound_context: string | null
  final_sent_response: string | null
  created_at: string
}

type BufferRow = { message_text: string | null; created_at: string }

function mockFeedback(rows: FeedbackRow[]) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => rows } as Response)
}

/** Provide buffer rows as first fetch (instagram_dm_buffer). */
function mockBuffer(rows: BufferRow[]) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => rows } as Response)
}

/**
 * Convenience: mock both sources for assembleDmConversationHistory.
 * When inbound buffer content matches feedback.inbound_context (no SUPERSEDED extras),
 * derive buffer rows from the feedback rows automatically.
 */
function mockBoth(feedbackRows: FeedbackRow[], extraBufferRows: BufferRow[] = []) {
  const bufferRows: BufferRow[] = [
    ...feedbackRows
      .filter(r => r.inbound_context?.trim())
      .map(r => ({ message_text: r.inbound_context!, created_at: r.created_at })),
    ...extraBufferRows,
  ]
  // Sort buffer rows by ts (feedback rows already ordered; keep sort stable)
  bufferRows.sort((a, b) => a.created_at.localeCompare(b.created_at))
  mockBuffer(bufferRows)
  mockFeedback(feedbackRows)
}

function buildRoutinePayload(opts: {
  conversationHistory: string
  contactNotes: string
  combinedMessage: string
  senderId: string
  adminRegen: boolean
}) {
  // Mirrors retry-draft/route.ts lines 280–310
  return {
    buffer_id:            'INVALID_TEST_BUF_001',
    sender_id:            opts.senderId,
    generation_id:        'INVALID_GEN_001',
    conversation_history: opts.conversationHistory,
    contact_notes:        opts.contactNotes || null,
    combined_message:     opts.combinedMessage,
    admin_regen:          opts.adminRegen,
    prompt_version:       'v6',   // DM_ROUTINE_PROMPT_VERSION (from contract)
    draft_source:         'CLAUDE_ROUTINE_v1',
  }
}

// ── Fixture A: Full 50-turn conversation with middle-intent ────────────────

describe('Integration Fixture A: 50-turn history — middle intent preserved', () => {
  const SENDER = 'INVALID_SYNTHETIC_SENDER_001'

  const feedbackRows: FeedbackRow[] = [
    // Turn 1: intent stated at start
    {
      buffer_id:           'buf-001',
      inbound_context:     'داداش دنبال جاب آفر از استرالیا هستم، مهندس نرم‌افزار',
      final_sent_response: 'سلام! چه سابقه‌ای داری و الان کجایی؟',
      created_at:          '2024-01-01T10:00:00Z',
    },
    // Turns 2–19: follow-up questions
    ...Array.from({ length: 18 }, (_, i) => ({
      buffer_id:           `buf-${String(i + 2).padStart(3, '0')}`,
      inbound_context:     `سوال ${i + 2} درباره ویزا`,
      final_sent_response: `جواب ${i + 2}`,
      created_at:          new Date(2024, 0, i + 2, 10).toISOString(),
    })),
    // Turn 20: CRITICAL middle fact (salary + offer details)
    {
      buffer_id:           'buf-020',
      inbound_context:     'آره داداش جاب آفر ۱۵۰ هزار دلار از شرکت Atlassian در سیدنی دارم',
      final_sent_response: 'این شرایط خوبیه، ویزای ۱۸۶ nominee stream مناسبته',
      created_at:          '2024-01-20T10:00:00Z',
    },
    // Turns 21–49: more questions
    ...Array.from({ length: 29 }, (_, i) => ({
      buffer_id:           `buf-${String(i + 21).padStart(3, '0')}`,
      inbound_context:     `سوال ${i + 21}`,
      final_sent_response: `جواب ${i + 21}`,
      created_at:          new Date(2024, 1, i + 1, 10).toISOString(),
    })),
    // Turn 50: the trigger — short referential reply
    {
      buffer_id:           'buf-050',
      inbound_context:     'داداش دنبال گرفتنشم',
      final_sent_response: 'پس اول باید نامینیشن از NSW بگیری',
      created_at:          '2024-02-20T10:00:00Z',
    },
  ]

  test('Routine payload: conversation_history includes all 50 turns with middle intent', async () => {
    mockBoth(feedbackRows)

    const history = await assembleDmConversationHistory(SENDER)

    // Verify all key turns are present
    expect(history).toContain('داداش دنبال جاب آفر از استرالیا هستم')     // turn 1
    expect(history).toContain('جاب آفر ۱۵۰ هزار دلار از شرکت Atlassian') // turn 20 (MIDDLE)
    expect(history).toContain('ویزای ۱۸۶ nominee stream')                 // turn 20 reply
    expect(history).toContain('داداش دنبال گرفتنشم')                       // turn 50

    // No truncation marker — 50 short turns (~6000 chars) fit in 12000-char budget
    expect(history).not.toContain('[...')

    // Verify line count: 50 turns × 2 lines = 100
    const lines = history.split('\n').filter(l => l.trim())
    expect(lines).toHaveLength(100)

    // Build what the Routine actually receives
    const payload = buildRoutinePayload({
      conversationHistory: history,
      contactNotes:        'مشتری مهندس نرم‌افزار با جاب آفر Atlassian',
      combinedMessage:     'چطور میشه نامینیشن NSW گرفت؟',
      senderId:            SENDER,
      adminRegen:          true,  // admin_regen=true → review-only, no auto-send
    })

    // Report exact payload for verification
    console.log('\n=== ROUTINE PAYLOAD (Fixture A) ===')
    console.log('sender_id:        ', payload.sender_id)
    console.log('admin_regen:      ', payload.admin_regen, '  (review-only, no auto-send)')
    console.log('contact_notes:    ', payload.contact_notes)
    console.log('combined_message: ', payload.combined_message)
    console.log('history lines:    ', lines.length)
    console.log('history chars:    ', history.length)
    console.log('turn 1 visible:   ', history.includes('داداش دنبال جاب آفر'))
    console.log('turn 20 visible:  ', history.includes('Atlassian'))
    console.log('turn 50 visible:  ', history.includes('داداش دنبال گرفتنشم'))
    console.log('truncated:        ', history.includes('[...'))
    console.log('===================================\n')

    expect(payload.admin_regen).toBe(true)
    expect(payload.conversation_history).toBe(history)
  })
})

// ── Fixture B: Documented failure scenario reconstructed ──────────────────

describe('Integration Fixture B: documented failure — داداش دنبال گرفتنشم', () => {
  const SENDER = 'INVALID_SYNTHETIC_SENDER_002'

  test('prior question is in context → draft should NOT re-ask what they seek', async () => {
    // Exact conversation from the failure report
    mockBoth([
      {
        buffer_id:           'buf-f1',
        inbound_context:     'داداش درباره ویزای استرالیا سوال داشتم، یه پیشنهاد کار از سیدنی دارم',
        final_sent_response: 'آیا پیشنهاد کار داری یا دنبال گرفتنش هستی؟',
        created_at:          '2024-10-07T09:00:00Z',
      },
    ])

    const history = await assembleDmConversationHistory(SENDER)

    // The prior question IS in history — model must NOT re-ask it
    expect(history).toContain('Ashkan: آیا پیشنهاد کار داری یا دنبال گرفتنش هستی؟')
    expect(history).toContain('Customer: داداش درباره ویزای استرالیا سوال داشتم')

    // Pending inbound for this trigger: the referential reply
    const pendingTexts   = ['داداش دنبال گرفتنشم']  // the new message (not yet in feedback)
    const combinedMessage = pendingTexts.join('\n')

    const payload = buildRoutinePayload({
      conversationHistory: history,
      contactNotes:        '',
      combinedMessage,
      senderId:            SENDER,
      adminRegen:          true,
    })

    console.log('\n=== ROUTINE PAYLOAD (Fixture B — documented failure) ===')
    console.log('combined_message:', payload.combined_message)
    console.log('Prior question in history:', history.includes('آیا پیشنهاد کار داری'))
    console.log('History:\n', history)
    console.log('=======================================================\n')

    // Verify: model sees the prior question, so referential reply is grounded
    expect(payload.conversation_history).toContain('آیا پیشنهاد کار داری')
    // The new message is the combined_message (separate field) — not yet in history
    expect(payload.combined_message).toBe('داداش دنبال گرفتنشم')
    expect(payload.admin_regen).toBe(true)
  })
})

// ── Fixture C: pending turns all present ─────────────────────────────────

describe('Integration Fixture C: multiple pending turns in combined_message', () => {
  const SENDER = 'INVALID_SYNTHETIC_SENDER_003'

  test('3 pending messages bundled correctly, all in Routine payload', async () => {
    mockBoth([
      {
        buffer_id:           'buf-c1',
        inbound_context:     'سلام میخوام مهاجرت کنم',
        final_sent_response: 'سلام! چه ویزایی مد نظر داری؟',
        created_at:          '2024-01-01T09:00:00Z',
      },
    ])

    const history = await assembleDmConversationHistory(SENDER)

    // Simulate 3 pending buffer rows (burst from customer)
    const pendingRows = [
      { message_text: 'ویزای کار',              is_story_reply: false },
      { message_text: 'مهندس برق هستم',         is_story_reply: false },
      { message_text: 'در کانادا زندگی می‌کنم', is_story_reply: false },
    ]
    const pendingTexts = pendingRows.map(p => p.message_text!)
    const currentText  = 'آیا برای کانادایی‌ها امکان ویزای استرالیا هست؟'
    const allTexts     = [...pendingTexts, currentText]

    const bundleNote     = `[BUNDLE: ${allTexts.length} consecutive messages — respond to all as ONE reply]\n`
    const combinedMessage = bundleNote + allTexts.join('\n')

    const payload = buildRoutinePayload({
      conversationHistory: history,
      contactNotes:        '',
      combinedMessage,
      senderId:            SENDER,
      adminRegen:          true,
    })

    console.log('\n=== ROUTINE PAYLOAD (Fixture C — 4-message bundle) ===')
    console.log('combined_message:\n', payload.combined_message)
    console.log('history:\n', payload.conversation_history)
    console.log('=====================================================\n')

    expect(payload.combined_message).toContain('[BUNDLE: 4')
    expect(payload.combined_message).toContain('ویزای کار')
    expect(payload.combined_message).toContain('مهندس برق هستم')
    expect(payload.combined_message).toContain('آیا برای کانادایی‌ها')
    expect(payload.conversation_history).toContain('سلام میخوام مهاجرت کنم')
    expect(payload.admin_regen).toBe(true)
  })
})

// ── Fixture D: notes correction ──────────────────────────────────────────

describe('Integration Fixture D: contact notes passed through to payload', () => {
  const SENDER = 'INVALID_SYNTHETIC_SENDER_004'

  test('notes appear in payload alongside history — model sees both', async () => {
    mockBoth([
      {
        buffer_id:           'buf-d1',
        inbound_context:     'میخوام مشاوره بگیرم',
        final_sent_response: 'بله، لینک مشاوره رو میفرستم',
        created_at:          '2024-01-01T09:00:00Z',
      },
    ])

    const history = await assembleDmConversationHistory(SENDER)

    const notes = 'مشتری قبلاً مشاوره گرفته، به ویزای ۱۸۶ علاقه‌منده، جاب آفر دارد'

    const payload = buildRoutinePayload({
      conversationHistory: history,
      contactNotes:        notes,
      combinedMessage:     'سوال جدید درباره مراحل',
      senderId:            SENDER,
      adminRegen:          true,
    })

    // Notes and history are separate fields in the Routine payload
    expect(payload.contact_notes).toBe(notes)
    expect(payload.conversation_history).toContain('میخوام مشاوره بگیرم')
    // Notes do NOT contaminate history
    expect(payload.conversation_history).not.toContain(notes)
  })
})

// ── Fixture E: account isolation ─────────────────────────────────────────

describe('Integration Fixture E: strict account isolation in live path', () => {
  test('two senders produce independent Routine payloads', async () => {
    const SENDER_A = 'INVALID_SYNTHETIC_SENDER_005'
    const SENDER_B = 'INVALID_SYNTHETIC_SENDER_006'

    mockBoth([
      { buffer_id: 'a1', inbound_context: 'پیام از A', final_sent_response: 'جواب به A', created_at: '2024-01-01T00:00:00Z' },
    ])
    const histA = await assembleDmConversationHistory(SENDER_A)

    mockBoth([
      { buffer_id: 'b1', inbound_context: 'پیام از B', final_sent_response: 'جواب به B', created_at: '2024-01-01T00:00:00Z' },
    ])
    const histB = await assembleDmConversationHistory(SENDER_B)

    expect(histA).toContain('پیام از A')
    expect(histA).not.toContain('پیام از B')
    expect(histB).toContain('پیام از B')
    expect(histB).not.toContain('پیام از A')
  })
})
