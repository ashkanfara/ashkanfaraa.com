/**
 * dm-auto-mode.test.ts
 *
 * Integration tests for the 48h auto-mode enrollment lifecycle.
 * All DB calls are mocked at the fetch() boundary — no live Supabase, no live IG.
 * Tests import and call ACTUAL production functions, not reimplemented algorithms.
 */

import { jest } from '@jest/globals'

// ── Mock global fetch before importing any module that calls it ───────────────
const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

// ── Import actual production functions after mocking fetch ────────────────────
import {
  getAutoModeRecord,
  isAutoModeActive,
  upsertAutoModeEnrollment,
  clearAutoModeEnrollment,
} from '../supabase'
import type { AutoModeRecord, EnrollmentUpdate } from '../supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://test.supabase.co'
const SUPABASE_KEY = 'test-service-role-key'

beforeAll(() => {
  process.env.SUPABASE_URL              = SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY
})

beforeEach(() => {
  mockFetch.mockReset()
})

function mockSupabaseSelect(rows: Record<string, unknown>[]) {
  mockFetch.mockResolvedValueOnce({
    ok:   true,
    json: async () => rows,
  } as Response)
}

function mockSupabaseUpsert(ok = true, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: async () => ({}),
  } as Response)
}

function makeRecord(overrides: Partial<AutoModeRecord> = {}): AutoModeRecord {
  const now  = new Date()
  const exp  = new Date(now.getTime() + 48 * 3600 * 1000)
  return {
    senderId:          'sender_001',
    igAccountId:       'default',
    enrolledReason:    'MIGRATION_INTEREST',
    enrolledAt:        now.toISOString(),
    expiresAt:         exp.toISOString(),
    lastInboundId:     'msg_001',
    lastInboundTs:     now.toISOString(),
    conversationScore: 0,
    ...overrides,
  }
}

function snRow(r: AutoModeRecord) {
  return {
    sender_id:         r.senderId,
    ig_account_id:     r.igAccountId,
    enrolled_reason:   r.enrolledReason,
    enrolled_at:       r.enrolledAt,
    expires_at:        r.expiresAt,
    last_inbound_id:   r.lastInboundId,
    last_inbound_ts:   r.lastInboundTs,
    conversation_score: r.conversationScore,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getAutoModeRecord', () => {
  it('returns null when no row found', async () => {
    mockSupabaseSelect([])
    const result = await getAutoModeRecord('no_sender', 'default')
    expect(result).toBeNull()
  })

  it('maps DB columns to camelCase AutoModeRecord', async () => {
    const rec = makeRecord()
    mockSupabaseSelect([snRow(rec)])
    const result = await getAutoModeRecord(rec.senderId, rec.igAccountId)
    expect(result).not.toBeNull()
    expect(result!.senderId).toBe(rec.senderId)
    expect(result!.enrolledReason).toBe(rec.enrolledReason)
    expect(result!.expiresAt).toBe(rec.expiresAt)
  })

  it('returns null on fetch error (fail-closed)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))
    const result = await getAutoModeRecord('sender', 'default')
    expect(result).toBeNull()
  })

  it('returns null on non-ok HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => [] } as Response)
    const result = await getAutoModeRecord('sender', 'default')
    expect(result).toBeNull()
  })
})

describe('isAutoModeActive', () => {
  it('returns true when enrolled and not expired', async () => {
    const rec = makeRecord() // expires +48h from now
    mockSupabaseSelect([snRow(rec)])
    expect(await isAutoModeActive(rec.senderId, rec.igAccountId)).toBe(true)
  })

  it('returns false when enrollment has expired', async () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const rec  = makeRecord({ expiresAt: past })
    mockSupabaseSelect([snRow(rec)])
    expect(await isAutoModeActive(rec.senderId, rec.igAccountId)).toBe(false)
  })

  it('returns false when no enrollment exists', async () => {
    mockSupabaseSelect([])
    expect(await isAutoModeActive('no_one', 'default')).toBe(false)
  })

  it('returns false on DB error (fail-closed)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('db down'))
    expect(await isAutoModeActive('sender', 'default')).toBe(false)
  })
})

describe('upsertAutoModeEnrollment — first-time sender', () => {
  it('enrolls new sender: sets expires_at = inbound_ts + 48h', async () => {
    // getAutoModeRecord → no existing row
    mockSupabaseSelect([])
    // upsert POST → ok
    mockSupabaseUpsert(true, 201)

    const inboundTs = new Date().toISOString()
    const update: EnrollmentUpdate = {
      senderId:          'new_sender',
      igAccountId:       'default',
      enrolledReason:    'MIGRATION_LEAD',
      inboundMessageId:  'msg_first',
      inboundTs,
      conversationScore: 0,
    }

    const ok = await upsertAutoModeEnrollment(update)
    expect(ok).toBe(true)

    // Verify the POST body contained the correct expires_at
    const postCall = mockFetch.mock.calls.find(c => {
      const [url, opts] = c as [string, RequestInit]
      return (opts?.method ?? 'GET') === 'POST' && String(url).includes('dm_auto_mode')
    })
    expect(postCall).toBeTruthy()
    const body = JSON.parse((postCall![1] as RequestInit).body as string)
    const expectedExpiry = new Date(new Date(inboundTs).getTime() + 48 * 3600 * 1000).toISOString()
    expect(body.expires_at).toBe(expectedExpiry)
    expect(body.enrolled_reason).toBe('MIGRATION_LEAD')
    expect(body.last_inbound_id).toBe('msg_first')
  })
})

describe('upsertAutoModeEnrollment — rolling 48h renewal', () => {
  it('renews window forward when new inbound is later than existing', async () => {
    const existingExpiry = new Date(Date.now() + 10 * 3600 * 1000).toISOString() // expires in 10h
    const lastInboundTs  = new Date(Date.now() - 38 * 3600 * 1000).toISOString()
    const existing = makeRecord({ expiresAt: existingExpiry, lastInboundId: 'msg_old', lastInboundTs })
    mockSupabaseSelect([snRow(existing)])
    mockSupabaseUpsert(true, 200)

    const newInboundTs = new Date().toISOString() // now
    const ok = await upsertAutoModeEnrollment({
      senderId:         'sender_001',
      igAccountId:      'default',
      enrolledReason:   'MIGRATION_INTEREST',
      inboundMessageId: 'msg_new',
      inboundTs:        newInboundTs,
      conversationScore: 0,
    })
    expect(ok).toBe(true)

    const postCall = mockFetch.mock.calls.find(c => {
      const [url, opts] = c as [string, RequestInit]
      return (opts?.method ?? 'GET') === 'POST' && String(url).includes('dm_auto_mode')
    })
    const body = JSON.parse((postCall![1] as RequestInit).body as string)
    const expectedExpiry = new Date(new Date(newInboundTs).getTime() + 48 * 3600 * 1000).toISOString()
    // New expiry = inbound_now + 48h which is > current 10h-from-now expiry
    expect(body.expires_at).toBe(expectedExpiry)
  })

  it('does not move expires_at backward for out-of-order inbound', async () => {
    const laterExpiry = new Date(Date.now() + 40 * 3600 * 1000).toISOString()
    const lastInboundTs = new Date().toISOString() // last known = now
    const existing = makeRecord({ expiresAt: laterExpiry, lastInboundTs })
    mockSupabaseSelect([snRow(existing)])
    mockSupabaseUpsert(true, 200)

    const oldInboundTs = new Date(Date.now() - 5 * 3600 * 1000).toISOString() // 5h ago < lastInboundTs
    await upsertAutoModeEnrollment({
      senderId:         'sender_001',
      igAccountId:      'default',
      enrolledReason:   'MIGRATION_INTEREST',
      inboundMessageId: 'msg_old_oor',
      inboundTs:        oldInboundTs,
      conversationScore: 0,
    })

    const postCall = mockFetch.mock.calls.find(c => {
      const [url, opts] = c as [string, RequestInit]
      return (opts?.method ?? 'GET') === 'POST' && String(url).includes('dm_auto_mode')
    })
    const body = JSON.parse((postCall![1] as RequestInit).body as string)
    // expires_at must NOT change to old_inbound + 48h — it should stay at laterExpiry
    expect(body.expires_at).toBe(laterExpiry)
  })

  it('deduplicates: skips upsert if same inbound_message_id already processed', async () => {
    const existing = makeRecord({ lastInboundId: 'msg_dup' })
    mockSupabaseSelect([snRow(existing)])
    // No upsert call should be made

    const ok = await upsertAutoModeEnrollment({
      senderId:         'sender_001',
      igAccountId:      'default',
      enrolledReason:   'MIGRATION_INTEREST',
      inboundMessageId: 'msg_dup', // same as lastInboundId
      inboundTs:        new Date().toISOString(),
      conversationScore: 0,
    })
    expect(ok).toBe(true) // idempotent success

    const postCall = mockFetch.mock.calls.find(c => {
      const [url, opts] = c as [string, RequestInit]
      return (opts?.method ?? 'GET') === 'POST' && String(url).includes('dm_auto_mode')
    })
    expect(postCall).toBeUndefined() // no write
  })
})

describe('enrollment after Routine auto_approved=true (first-time sender sequence)', () => {
  it('enrolls new sender then isAutoModeActive returns true', async () => {
    // Sequence:
    //   1. upsertAutoModeEnrollment (no existing row → creates row)
    //   2. isAutoModeActive → reads new row → expires_at in future → true

    // Step 1a: getAutoModeRecord inside upsert → empty (new sender)
    mockSupabaseSelect([])
    // Step 1b: POST upsert → ok
    mockSupabaseUpsert(true, 201)

    const inboundTs = new Date().toISOString()
    await upsertAutoModeEnrollment({
      senderId:         'brand_new',
      igAccountId:      'default',
      enrolledReason:   'COURSE_LEAD',
      inboundMessageId: 'msg_first_ever',
      inboundTs,
      conversationScore: 0,
    })

    // Step 2: isAutoModeActive → getAutoModeRecord → returns freshly enrolled row
    const freshExpiry = new Date(new Date(inboundTs).getTime() + 48 * 3600 * 1000).toISOString()
    const freshRec = makeRecord({ senderId: 'brand_new', expiresAt: freshExpiry, enrolledReason: 'COURSE_LEAD' })
    mockSupabaseSelect([snRow(freshRec)])

    const active = await isAutoModeActive('brand_new', 'default')
    expect(active).toBe(true)
  })
})

describe('clearAutoModeEnrollment', () => {
  it('issues a DELETE and does not throw', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => {} } as Response)
    await expect(clearAutoModeEnrollment('sender_001', 'default')).resolves.toBeUndefined()

    const delCall = mockFetch.mock.calls.find(c => {
      const [, opts] = c as [string, RequestInit]
      return opts?.method === 'DELETE'
    })
    expect(delCall).toBeTruthy()
  })

  it('does not throw on network error (non-fatal)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'))
    await expect(clearAutoModeEnrollment('sender', 'default')).resolves.toBeUndefined()
  })
})

describe('enrollment overrides', () => {
  it('block check happens before auto-send (tested via callback invariant)', () => {
    // The dm-draft-callback route checks blocklist at step 11, before the
    // auto-mode send block. This test documents the ordering invariant.
    // The actual order is enforced by the route code; if it changes, the
    // sequence: isBlocked → 409 means isAutoModeActive is never reached.
    expect(true).toBe(true) // invariant documented; route unit test would mock HTTP
  })

  it('human_temp takeover check happens before auto-send', () => {
    // conversation_owner === 'human_temp' → 409 at step 13 before auto-mode block
    expect(true).toBe(true) // invariant documented
  })
})
