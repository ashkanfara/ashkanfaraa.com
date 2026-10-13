/// <reference types="@jest/globals" />
/**
 * dm-draft-callback-regen.test.ts
 *
 * Tests stale callback rejection, requeue→retry race conditions, and auto-send guard.
 * Uses jest.mock() factories with jest.fn() inside (global jest, no import needed).
 * Supabase helpers and dm-send-engine are module-mocked; fetch is mocked globally.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

jest.mock('@/lib/supabase', () => ({
  supabaseConfigured:                   jest.fn(() => true),
  isAutoModeActive:                     jest.fn(() => Promise.resolve(false)),
  getAutoModeRecord:                    jest.fn(() => Promise.resolve(null)),
  upsertAutoModeEnrollment:             jest.fn(() => Promise.resolve(undefined)),
  claimDmForSend:                       jest.fn(() => Promise.resolve(null)),
  archiveWindowClosedSiblingsForSender: jest.fn(() => Promise.resolve(undefined)),
}))

jest.mock('@/lib/dm-send-engine', () => ({
  sendViaEngine: jest.fn(() => Promise.resolve(null)),
}))

import * as supabaseModule   from '@/lib/supabase'
import * as sendEngineModule from '@/lib/dm-send-engine'
import { POST }              from '../route'
import { DM_ROUTINE_PROMPT_VERSION } from '@/lib/dm-routine-contract'

const mIsAutoModeActive  = jest.mocked(supabaseModule.isAutoModeActive)
const mGetAutoModeRecord = jest.mocked(supabaseModule.getAutoModeRecord)
const mUpsertEnrollment  = jest.mocked(supabaseModule.upsertAutoModeEnrollment)
const mClaimDm           = jest.mocked(supabaseModule.claimDmForSend)
const mArchive           = jest.mocked(supabaseModule.archiveWindowClosedSiblingsForSender)
const mSendVia           = jest.mocked(sendEngineModule.sendViaEngine)

// ── Constants ──────────────────────────────────────────────────────────────
const CALLBACK_SECRET = 'test-callback-secret'
const SENDER_ID       = 'sender_001'
const BUFFER_ID       = 'buf_001'
const GENERATION_ID   = 'gen_aaa'
const DRAFT_TEXT      = 'سلام! وقت مشاوره رو رزرو کن.'
const PROMPT_VER      = DM_ROUTINE_PROMPT_VERSION
const DRAFT_SRC       = 'CLAUDE_ROUTINE_v1'

beforeAll(() => {
  process.env.SUPABASE_URL              = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.DM_CALLBACK_SECRET        = CALLBACK_SECRET
})

beforeEach(() => {
  mockFetch.mockReset()
  mIsAutoModeActive.mockReset();  mIsAutoModeActive.mockResolvedValue(false)
  mGetAutoModeRecord.mockReset(); mGetAutoModeRecord.mockResolvedValue(null)
  mUpsertEnrollment.mockReset();  mUpsertEnrollment.mockResolvedValue(undefined)
  mClaimDm.mockReset();           mClaimDm.mockResolvedValue(null)
  mArchive.mockReset();           mArchive.mockResolvedValue(undefined)
  mSendVia.mockReset();           mSendVia.mockResolvedValue(null)
})

// ── Request builder ────────────────────────────────────────────────────────

function makeReq(body: Record<string, unknown>, secret = CALLBACK_SECRET) {
  return new Request('http://localhost/api/dm-draft-callback', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
    body:    JSON.stringify(body),
  }) as any
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    buffer_id:      BUFFER_ID,
    sender_id:      SENDER_ID,
    generation_id:  GENERATION_ID,
    draft_text:     DRAFT_TEXT,
    prompt_version: PROMPT_VER,
    draft_source:   DRAFT_SRC,
    ...overrides,
  }
}

// ── DB mock helpers ────────────────────────────────────────────────────────

type PartialRow = Partial<{
  id: string; sender_id: string; created_at: string; failed_reason: string | null;
  processed: boolean; response_sent: boolean; response_text: string | null;
  draft_source: string | null; generation_id: string | null; admin_regen: boolean;
}>

function mockDbRow(row: PartialRow = {}) {
  mockFetch.mockResolvedValueOnce({
    ok:   true,
    json: async () => [{
      id:            BUFFER_ID,
      sender_id:     SENDER_ID,
      created_at:    new Date().toISOString(),
      failed_reason: 'DRAFT_GENERATING',
      processed:     true,
      response_sent: false,
      response_text: null,
      draft_source:  null,
      generation_id: GENERATION_ID,
      admin_regen:   false,
      ...row,
    }],
  } as Response)
}

function mockNotBlocked()   { mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] } as Response) }
function mockConvNormal()   { mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] } as Response) }
function mockPatchSuccess() { mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [{ id: BUFFER_ID }] } as Response) }
function mockPatchRace()    { mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] } as Response) }

// ── Stale callback tests ───────────────────────────────────────────────────

describe('Stale callback rejection', () => {
  it('returns 409 when generation_id does not match DB row', async () => {
    mockDbRow({ generation_id: 'gen_bbb_newer' })
    const res = await POST(makeReq(validBody({ generation_id: 'gen_aaa_old' })))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/stale|generation_id/i)
    expect(mSendVia).not.toHaveBeenCalled()
  })

  it('returns 409 when row state changed away from DRAFT_GENERATING (no matching draft_source)', async () => {
    mockDbRow({ failed_reason: 'PENDING_REVIEW', draft_source: null })
    const res = await POST(makeReq(validBody()))
    expect(res.status).toBe(409)
    expect(mSendVia).not.toHaveBeenCalled()
  })

  it('returns 409 when row is already response_sent=true', async () => {
    mockDbRow({ response_sent: true, failed_reason: null })
    const res = await POST(makeReq(validBody()))
    expect(res.status).toBe(409)
    expect(mSendVia).not.toHaveBeenCalled()
  })
})

// ── Duplicate idempotency ──────────────────────────────────────────────────

describe('Duplicate callback (idempotent re-delivery)', () => {
  it('returns 200 noop when row is already PENDING_REVIEW with same gen_id and draft_source', async () => {
    mockDbRow({ failed_reason: 'PENDING_REVIEW', draft_source: DRAFT_SRC, response_text: DRAFT_TEXT })
    const res = await POST(makeReq(validBody()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, noop: true })
    expect(mSendVia).not.toHaveBeenCalled()
  })
})

// ── Race: requeue → n8n claims before admin retry ─────────────────────────

describe('Requeue → n8n claims before admin retry-draft', () => {
  it('rejects admin Routine callback when n8n replaced generation_id', async () => {
    mockDbRow({ generation_id: 'gen_n8n_claimed' })
    const res = await POST(makeReq(validBody({ generation_id: 'gen_admin_fired' })))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/stale|generation_id/i)
    expect(mSendVia).not.toHaveBeenCalled()
  })

  it("accepts n8n's callback with n8n's generation_id", async () => {
    const N8N_GEN = 'gen_n8n_claimed'
    mockDbRow({ generation_id: N8N_GEN, failed_reason: 'DRAFT_GENERATING' })
    mockNotBlocked(); mockConvNormal(); mockPatchSuccess()
    const res = await POST(makeReq(validBody({ generation_id: N8N_GEN, auto_approved: false })))
    expect(res.status).toBe(200)
    expect((await res.json()).noop).toBeUndefined()
    expect(mSendVia).not.toHaveBeenCalled()
  })
})

// ── Previous draft preserved on patch-race ─────────────────────────────────

describe('Previous draft preserved when patch races', () => {
  it('returns 409 when patchRes returns 0 rows (concurrent write won)', async () => {
    mockDbRow({ failed_reason: 'DRAFT_GENERATING' })
    mockNotBlocked(); mockConvNormal(); mockPatchRace()
    const res = await POST(makeReq(validBody()))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/stale|race|changed/i)
    expect(mSendVia).not.toHaveBeenCalled()
  })
})

// ── Auto-send guard ────────────────────────────────────────────────────────

describe('Auto-send guard', () => {
  it('does NOT call sendViaEngine when auto_approved=false, even if enrolled', async () => {
    mockDbRow({})
    mockNotBlocked(); mockConvNormal(); mockPatchSuccess()
    mIsAutoModeActive.mockResolvedValue(true)
    const res = await POST(makeReq(validBody({ auto_approved: false })))
    expect(res.status).toBe(200)
    expect(mSendVia).not.toHaveBeenCalled()
    expect(mIsAutoModeActive).not.toHaveBeenCalled()
  })

  it('does NOT call sendViaEngine when auto_approved=true but DB enrollment is inactive', async () => {
    mockDbRow({})
    mockNotBlocked(); mockConvNormal(); mockPatchSuccess()
    mIsAutoModeActive.mockResolvedValue(false)
    const res = await POST(makeReq(validBody({ auto_approved: true, enrolled_reason: 'MIGRATION_LEAD' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.auto_sent).toBeUndefined()
    expect(mSendVia).not.toHaveBeenCalled()
  })

  it('calls sendViaEngine when auto_approved=true AND DB confirms active enrollment', async () => {
    mockDbRow({})
    mockNotBlocked(); mockConvNormal(); mockPatchSuccess()
    mIsAutoModeActive.mockResolvedValue(true)
    mClaimDm.mockResolvedValue({ sendingStartedAt: new Date().toISOString() } as any)
    mSendVia.mockResolvedValue({ outcome: 'sent', igHttpStatus: 200 } as any)
    const res = await POST(makeReq(validBody({ auto_approved: true, enrolled_reason: 'CONSULTATION_LEAD' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.auto_sent).toBe(true)
    expect(body.send_outcome).toBe('sent')
    expect(mSendVia).toHaveBeenCalledTimes(1)
  })

  it('does NOT call sendViaEngine when enrolled but claimDmForSend returns null', async () => {
    mockDbRow({})
    mockNotBlocked(); mockConvNormal(); mockPatchSuccess()
    mIsAutoModeActive.mockResolvedValue(true)
    mClaimDm.mockResolvedValue(null)
    const res = await POST(makeReq(validBody({ auto_approved: true, enrolled_reason: 'MIGRATION_LEAD' })))
    expect(res.status).toBe(200)
    expect(mSendVia).not.toHaveBeenCalled()
  })
})

// ── admin_regen flag: never auto-send ─────────────────────────────────────

describe('admin_regen=true: auto-send always blocked', () => {
  it('skips auto-send when row.admin_regen=true, even when enrolled and auto_approved=true', async () => {
    // admin_regen=true is set by retry-draft on the DB row; callback reads it from DB.
    // generation_id is a valid UUID (uuid column type — no prefix allowed).
    mockDbRow({ admin_regen: true, failed_reason: 'DRAFT_GENERATING' })
    mockNotBlocked(); mockConvNormal(); mockPatchSuccess()
    mIsAutoModeActive.mockResolvedValue(true)
    mClaimDm.mockResolvedValue({ sendingStartedAt: new Date().toISOString() } as any)
    const res = await POST(makeReq(validBody({ auto_approved: true, enrolled_reason: 'CONSULTATION_LEAD' })))
    expect(res.status).toBe(200)
    expect((await res.json()).auto_sent).toBeUndefined()
    expect(mSendVia).not.toHaveBeenCalled()
    expect(mIsAutoModeActive).not.toHaveBeenCalled()
  })

  it('race-proof: no auto-send even if callback arrives while enrolled (admin_regen column persists in DB)', () => {
    // When retry-draft claims PENDING_REVIEW → DRAFT_GENERATING, it writes admin_regen=true.
    // N8n cannot claim the row (processed stays true). If any callback arrives for
    // this admin-triggered generation, admin_regen=true in the DB row blocks auto-send.
    mockDbRow({ admin_regen: true, failed_reason: 'DRAFT_GENERATING' })
    mockNotBlocked(); mockConvNormal(); mockPatchSuccess()
    mIsAutoModeActive.mockResolvedValue(true)
    const resultPromise = POST(makeReq(validBody({ auto_approved: true })))
    return resultPromise.then(res => {
      expect(res.status).toBe(200)
      expect(mSendVia).not.toHaveBeenCalled()
    })
  })

  it('normal n8n generation (admin_regen=false) still allows auto-send when enrolled', async () => {
    // Regression: admin_regen=false rows must still reach auto-send path when all conditions met.
    mockDbRow({ admin_regen: false })
    mockNotBlocked(); mockConvNormal(); mockPatchSuccess()
    mIsAutoModeActive.mockResolvedValue(true)
    mClaimDm.mockResolvedValue({ sendingStartedAt: new Date().toISOString() } as any)
    mSendVia.mockResolvedValue({ outcome: 'sent', igHttpStatus: 200 } as any)
    const res = await POST(makeReq(validBody({ auto_approved: true, enrolled_reason: 'MIGRATION_LEAD' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.auto_sent).toBe(true)
    expect(mSendVia).toHaveBeenCalledTimes(1)
  })
})

// ── Expired window: draft still saved ─────────────────────────────────────

describe('Expired window: draft saved regardless', () => {
  it('saves draft to PENDING_REVIEW even when created_at is 30h ago', async () => {
    const oldCreatedAt = new Date(Date.now() - 30 * 3600 * 1000).toISOString()
    mockDbRow({ created_at: oldCreatedAt, failed_reason: 'DRAFT_GENERATING' })
    mockNotBlocked(); mockConvNormal(); mockPatchSuccess()
    const res = await POST(makeReq(validBody({ auto_approved: false })))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(mSendVia).not.toHaveBeenCalled()
  })
})

// ── Auth ───────────────────────────────────────────────────────────────────

describe('Authentication', () => {
  it('returns 401 for missing Authorization header', async () => {
    const req = new Request('http://localhost/api/dm-draft-callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    }) as any
    expect((await POST(req)).status).toBe(401)
  })

  it('returns 401 for wrong secret', async () => {
    expect((await POST(makeReq(validBody(), 'wrong-secret'))).status).toBe(401)
  })
})
