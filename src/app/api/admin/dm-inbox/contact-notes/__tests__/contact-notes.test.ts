/**
 * contact-notes.test.ts
 *
 * Tests for /api/admin/dm-inbox/contact-notes (GET/PUT/DELETE).
 * Uses real requireAdminSession via NextRequest with a valid signed cookie.
 * All Supabase DB calls are mocked at the fetch() boundary.
 */

import { jest } from '@jest/globals'

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

import { NextRequest }       from 'next/server'
import { GET, PUT, DELETE }  from '../route'
import { createSessionToken, ADMIN_COOKIE } from '@/lib/adminSession'

const BASE = 'https://test.supabase.co'
let SESSION_TOKEN = ''

beforeAll(() => {
  process.env.SUPABASE_URL              = BASE
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.SESSION_SECRET            = 'test-session-secret-32-chars-min!!'
  SESSION_TOKEN = createSessionToken()
})

beforeEach(() => mockFetch.mockReset())

// ── Request factories ──────────────────────────────────────────────────────

function makeGetReq(params: Record<string, string>, authed = true) {
  const url = new URL('http://localhost/api/admin/dm-inbox/contact-notes')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const headers: Record<string, string> = {}
  if (authed) headers['Cookie'] = `${ADMIN_COOKIE}=${SESSION_TOKEN}`
  return new NextRequest(url.toString(), { headers })
}

function makePutReq(body: Record<string, unknown>, authed = true, origin = 'http://localhost') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Host': 'localhost' }
  if (authed) headers['Cookie'] = `${ADMIN_COOKIE}=${SESSION_TOKEN}`
  if (origin) headers['Origin'] = origin
  return new NextRequest('http://localhost/api/admin/dm-inbox/contact-notes', {
    method: 'PUT', headers, body: JSON.stringify(body),
  })
}

function makeDeleteReq(body: Record<string, unknown>, authed = true, origin = 'http://localhost') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Host': 'localhost' }
  if (authed) headers['Cookie'] = `${ADMIN_COOKIE}=${SESSION_TOKEN}`
  if (origin) headers['Origin'] = origin
  return new NextRequest('http://localhost/api/admin/dm-inbox/contact-notes', {
    method: 'DELETE', headers, body: JSON.stringify(body),
  })
}

function mockDbSelect(rows: Record<string, unknown>[]) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => rows } as Response)
}

function mockDbWrite(ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok, status: ok ? 201 : 500,
    text: async () => 'error',
    json: async () => ({}),
  } as Response)
}

// ── GET tests ──────────────────────────────────────────────────────────────

describe('GET /contact-notes', () => {
  it('returns empty string when no row exists', async () => {
    mockDbSelect([])
    const res = await GET(makeGetReq({ senderId: 'sender_a' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, notes: '' })
  })

  it('returns saved notes for correct sender', async () => {
    mockDbSelect([{ notes: 'Interested in migration program.' }])
    const res = await GET(makeGetReq({ senderId: 'sender_a' }))
    expect(await res.json()).toEqual({ ok: true, notes: 'Interested in migration program.' })
  })

  it('requires senderId', async () => {
    const res = await GET(makeGetReq({}))
    expect(res.status).toBe(422)
  })

  it('rejects unauthenticated request', async () => {
    const res = await GET(makeGetReq({ senderId: 'sender_a' }, false))
    expect(res.status).toBe(401)
  })

  it('passes ig_account_id to Supabase query for isolation', async () => {
    mockDbSelect([])
    await GET(makeGetReq({ senderId: 'sender_a', igAccountId: 'account_2' }))
    const calledUrl = (mockFetch.mock.calls[0] as [string])[0]
    expect(calledUrl).toContain('ig_account_id=eq.account_2')
    expect(calledUrl).toContain('sender_id=eq.sender_a')
  })

  it('defaults ig_account_id to "default" when not supplied', async () => {
    mockDbSelect([])
    await GET(makeGetReq({ senderId: 'sender_b' }))
    const calledUrl = (mockFetch.mock.calls[0] as [string])[0]
    expect(calledUrl).toContain('ig_account_id=eq.default')
  })
})

// ── PUT tests ──────────────────────────────────────────────────────────────

describe('PUT /contact-notes', () => {
  it('saves notes successfully', async () => {
    mockDbWrite(true)
    const res = await PUT(makePutReq({ senderId: 'sender_a', notes: 'Wants consultation.' }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('requires senderId', async () => {
    const res = await PUT(makePutReq({ notes: 'Some notes' }))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/senderId/)
  })

  it('rejects notes longer than 2000 chars', async () => {
    const res = await PUT(makePutReq({ senderId: 'sender_a', notes: 'x'.repeat(2001) }))
    expect(res.status).toBe(422)
  })

  it('allows empty string notes (save to empty)', async () => {
    mockDbWrite(true)
    const res = await PUT(makePutReq({ senderId: 'sender_a', notes: '' }))
    expect(res.status).toBe(200)
  })

  it('rejects unauthenticated request', async () => {
    const res = await PUT(makePutReq({ senderId: 'sender_a', notes: 'test' }, false))
    expect(res.status).toBe(401)
  })

  it('rejects cross-origin request (different Origin host)', async () => {
    const res = await PUT(makePutReq({ senderId: 'sender_a', notes: 'test' }, true, 'http://evil.example.com'))
    expect(res.status).toBe(403)
  })

  it('passes ig_account_id to Supabase body for contact isolation', async () => {
    mockDbWrite(true)
    await PUT(makePutReq({ senderId: 'sender_a', igAccountId: 'account_2', notes: 'note' }))
    const reqBody = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(reqBody.ig_account_id).toBe('account_2')
    expect(reqBody.sender_id).toBe('sender_a')
  })
})

// ── DELETE tests ───────────────────────────────────────────────────────────
// DELETE upserts notes='' (tombstone) rather than removing the row.
// This prevents getDmInbox from resurrecting instagram_users.notes after clear.

describe('DELETE /contact-notes', () => {
  it('clears notes successfully (upsert tombstone)', async () => {
    mockDbWrite(true)
    const res = await DELETE(makeDeleteReq({ senderId: 'sender_a' }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('uses POST (upsert) not DELETE so tombstone row survives — prevents instagram_users.notes fallback', async () => {
    mockDbWrite(true)
    await DELETE(makeDeleteReq({ senderId: 'sender_a' }))
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('POST')
    const reqBody = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(reqBody.notes).toBe('')
    expect(reqBody.sender_id).toBe('sender_a')
  })

  it('requires senderId', async () => {
    const res = await DELETE(makeDeleteReq({}))
    expect(res.status).toBe(422)
  })

  it('rejects unauthenticated request', async () => {
    const res = await DELETE(makeDeleteReq({ senderId: 'sender_a' }, false))
    expect(res.status).toBe(401)
  })

  it('rejects cross-origin request', async () => {
    const res = await DELETE(makeDeleteReq({ senderId: 'sender_a' }, true, 'http://attacker.com'))
    expect(res.status).toBe(403)
  })

  it('passes ig_account_id in tombstone body for isolation', async () => {
    mockDbWrite(true)
    await DELETE(makeDeleteReq({ senderId: 'sender_a', igAccountId: 'account_2' }))
    const reqBody = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(reqBody.ig_account_id).toBe('account_2')
    expect(reqBody.sender_id).toBe('sender_a')
    expect(reqBody.notes).toBe('')
  })
})

// ── Cross-sender isolation ─────────────────────────────────────────────────

describe('Cross-sender isolation', () => {
  it('GET for sender_b queries sender_b only (not sender_a)', async () => {
    mockDbSelect([])
    await GET(makeGetReq({ senderId: 'sender_b' }))
    const calledUrl = (mockFetch.mock.calls[0] as [string])[0]
    expect(calledUrl).toContain('sender_id=eq.sender_b')
    expect(calledUrl).not.toContain('sender_a')
  })

  it('PUT for sender_b writes sender_b in Supabase body', async () => {
    mockDbWrite(true)
    await PUT(makePutReq({ senderId: 'sender_b', notes: 'note for B' }))
    const reqBody = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(reqBody.sender_id).toBe('sender_b')
  })
})
