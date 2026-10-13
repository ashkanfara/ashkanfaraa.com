/**
 * retry-draft.test.ts
 *
 * Tests for /api/admin/dm-inbox/retry-draft route.
 * Uses real requireAdminSession via NextRequest + signed cookie.
 * All Supabase and Routine calls mocked at the fetch() boundary.
 */

import { jest } from '@jest/globals'

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

// supabaseConfigured is called once at startup; mock the module to avoid env checks
jest.mock('@/lib/supabase', () => ({
  supabaseConfigured: () => true,
}))

import { NextRequest }  from 'next/server'
import { POST }         from '../route'
import { createSessionToken, ADMIN_COOKIE } from '@/lib/adminSession'

const ROUTINE_URL = 'https://api.anthropic.com/v1/routines/trigger/test'
const BUFFER_ID   = 'buf_retry_001'
const SENDER_ID   = 'sender_retry_001'
const GEN_ID      = 'gen_retry_001'
let SESSION_TOKEN  = ''

beforeAll(() => {
  process.env.SUPABASE_URL                 = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY    = 'test-service-role-key'
  process.env.CLAUDE_ROUTINE_TRIGGER_URL   = ROUTINE_URL
  process.env.CLAUDE_ROUTINE_TRIGGER_TOKEN = 'test-routine-token'
  process.env.SESSION_SECRET               = 'test-session-secret-32-chars-min!!'
  SESSION_TOKEN = createSessionToken()
})

beforeEach(() => mockFetch.mockReset())

function makeReq(body: Record<string, unknown>, authed = true, sameOrigin = true): Parameters<typeof POST>[0] {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Host': 'localhost' }
  if (authed)     headers['Cookie'] = `${ADMIN_COOKIE}=${SESSION_TOKEN}`
  if (sameOrigin) headers['Origin'] = 'http://localhost'
  return new NextRequest('http://localhost/api/admin/dm-inbox/retry-draft', {
    method: 'POST', headers, body: JSON.stringify(body),
  })
}

function mockRow(overrides: Record<string, unknown> = {}) {
  mockFetch.mockResolvedValueOnce({
    ok:   true,
    json: async () => [{
      id:                    BUFFER_ID,
      sender_id:             SENDER_ID,
      message_text:          'سلام',
      message_type:          'text',
      created_at:            new Date().toISOString(),
      failed_reason:         'DRAFT_FAILED',
      processed:             true,
      processing_started_at: null,
      response_sent:         false,
      is_story_reply:        false,
      story_id:              null,
      generation_id:         null,
      ...overrides,
    }],
  } as Response)
}

function mockNoSibling()         { mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] } as Response) }
function mockSiblingGenerating() { mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [{ generation_id: 'sibling_gen' }] } as Response) }
function mockClaimSuccess()      { mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [{ id: BUFFER_ID }] } as Response) }
function mockHistory()           { mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] } as Response) }
function mockNoPending()         { mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] } as Response) }
function mockRoutineOk()         { mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response) }
function mockRoutineFail()       { mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'fail' } as Response) }
function mockRollback()          { mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [{ id: BUFFER_ID }] } as Response) }

// ── State gating ───────────────────────────────────────────────────────────

describe('State gating', () => {
  it('accepts PENDING_REVIEW row and claims directly (no requeue gap)', async () => {
    mockRow({ failed_reason: 'PENDING_REVIEW', processed: true })
    mockNoSibling(); mockClaimSuccess(); mockHistory(); mockNoPending(); mockRoutineOk()
    const res = await POST(makeReq({ id: BUFFER_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('generating')
    // The claim PATCH must use PENDING_REVIEW in the WHERE so n8n never sees processed=false
    const claimCall = (mockFetch.mock.calls as Array<[string, RequestInit]>)
      .find(([url]) => typeof url === 'string' && url.includes('PENDING_REVIEW'))
    expect(claimCall).toBeDefined()
  })

  it('accepts DRAFT_FAILED row and triggers Routine', async () => {
    mockRow({ failed_reason: 'DRAFT_FAILED' })
    mockNoSibling(); mockClaimSuccess(); mockHistory(); mockNoPending(); mockRoutineOk()
    const res = await POST(makeReq({ id: BUFFER_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('generating')
  })

  it('accepts DRAFT_GENERATING row (re-retry after timeout)', async () => {
    mockRow({ failed_reason: 'DRAFT_GENERATING', generation_id: GEN_ID })
    mockClaimSuccess(); mockHistory(); mockNoPending(); mockRoutineOk()
    const res = await POST(makeReq({ id: BUFFER_ID }))
    expect(res.status).toBe(200)
  })

  it('returns 404 for non-existent row', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
    const res = await POST(makeReq({ id: 'nonexistent' }))
    expect(res.status).toBe(404)
  })

  it('returns 409 for already-sent row', async () => {
    mockRow({ response_sent: true, failed_reason: null })
    const res = await POST(makeReq({ id: BUFFER_ID }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/sent/i)
  })
})

// ── Sibling idempotency ────────────────────────────────────────────────────

describe('Sibling idempotency', () => {
  it('returns noop when sibling for same sender is already generating', async () => {
    mockRow({ failed_reason: 'DRAFT_FAILED' })
    mockSiblingGenerating()
    const res = await POST(makeReq({ id: BUFFER_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.noop).toBe(true)
    expect(body.status).toBe('already_generating')
  })
})

// ── contact_notes + feedback forwarding ───────────────────────────────────

describe('contact_notes + feedback forwarding', () => {
  async function capturePayload(body: Record<string, unknown>) {
    mockRow({ failed_reason: 'DRAFT_FAILED' })
    mockNoSibling(); mockClaimSuccess(); mockHistory(); mockNoPending(); mockRoutineOk()
    await POST(makeReq(body))
    const routineCall = (mockFetch.mock.calls as Array<[string, RequestInit]>)
      .find(([url]) => url.includes(ROUTINE_URL))
    if (!routineCall) return null
    return JSON.parse(JSON.parse(routineCall[1].body as string).text) as Record<string, unknown>
  }

  it('forwards contact_notes when non-empty', async () => {
    const p = await capturePayload({ id: BUFFER_ID, contact_notes: 'Visited course page.' })
    expect(p!.contact_notes).toBe('Visited course page.')
  })

  it('forwards feedback when non-empty', async () => {
    const p = await capturePayload({ id: BUFFER_ID, feedback: 'Address WhatsApp question.' })
    expect(p!.feedback).toBe('Address WhatsApp question.')
  })

  it('forwards both contact_notes and feedback together', async () => {
    const p = await capturePayload({
      id: BUFFER_ID,
      contact_notes: 'Saved fact: wants group class.',
      feedback:      'Lead toward consultation.',
    })
    expect(p!.contact_notes).toBe('Saved fact: wants group class.')
    expect(p!.feedback).toBe('Lead toward consultation.')
  })

  it('does NOT include contact_notes key when empty string', async () => {
    const p = await capturePayload({ id: BUFFER_ID, contact_notes: '' })
    expect(Object.prototype.hasOwnProperty.call(p, 'contact_notes')).toBe(false)
  })

  it('does NOT include feedback key when empty string', async () => {
    const p = await capturePayload({ id: BUFFER_ID, feedback: '' })
    expect(Object.prototype.hasOwnProperty.call(p, 'feedback')).toBe(false)
  })

  it('does NOT include contact_notes when not supplied', async () => {
    const p = await capturePayload({ id: BUFFER_ID })
    expect(Object.prototype.hasOwnProperty.call(p, 'contact_notes')).toBe(false)
  })
})

// ── Routine failure rollback ───────────────────────────────────────────────

describe('Routine failure rollback', () => {
  it('returns 502 and rolls back to DRAFT_FAILED when Routine trigger fails (from DRAFT_FAILED)', async () => {
    mockRow({ failed_reason: 'DRAFT_FAILED' })
    mockNoSibling(); mockClaimSuccess(); mockHistory(); mockNoPending()
    mockRoutineFail(); mockRollback()
    const res = await POST(makeReq({ id: BUFFER_ID }))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/DRAFT_FAILED/i)
  })

  it('rolls back to PENDING_REVIEW (preserving old draft) when trigger fails from PENDING_REVIEW', async () => {
    mockRow({ failed_reason: 'PENDING_REVIEW', processed: true, response_text: 'old draft' })
    mockNoSibling(); mockClaimSuccess(); mockHistory(); mockNoPending()
    mockRoutineFail(); mockRollback()
    const res = await POST(makeReq({ id: BUFFER_ID }))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/PENDING_REVIEW/i)
  })
})

describe('admin_ generation_id prefix', () => {
  it('generation_id in Routine trigger payload starts with admin_', async () => {
    mockRow({ failed_reason: 'DRAFT_FAILED' })
    mockNoSibling(); mockClaimSuccess(); mockHistory(); mockNoPending(); mockRoutineOk()
    await POST(makeReq({ id: BUFFER_ID }))
    const routineCall = (mockFetch.mock.calls as Array<[string, RequestInit]>)
      .find(([url]) => typeof url === 'string' && url.includes(ROUTINE_URL))
    const payload = JSON.parse(JSON.parse(routineCall![1].body as string).text) as Record<string, unknown>
    expect(typeof payload.generation_id).toBe('string')
    expect((payload.generation_id as string).startsWith('admin_')).toBe(true)
  })
})

// ── Auth ───────────────────────────────────────────────────────────────────

describe('Authentication', () => {
  it('returns 401 when no session cookie', async () => {
    const res = await POST(makeReq({ id: BUFFER_ID }, false))
    expect(res.status).toBe(401)
  })

  it('returns 403 when Origin does not match Host', async () => {
    const res = await POST(makeReq({ id: BUFFER_ID }, true, false))
    // validateSameOrigin requires Origin header; without it → 403
    expect(res.status).toBe(403)
  })
})
