// No real credentials or network: exercise the actual helpers/route with fakes.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const load = async source => {
  source = source.replace(/import \{ isMetaWindowError \} from '[^']*dm-send-error'/g, readFileSync('src/lib/dm-send-error.ts', 'utf8').replace('export function', 'function'))
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
}
process.env.SUPABASE_URL = 'https://database.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake'
process.env.INSTAGRAM_ACCESS_TOKEN = 'fake'
const response = (body, status = 200) => new Response(JSON.stringify(body), { status })
const db = await load(readFileSync('src/lib/supabase.ts', 'utf8'))
let calls = []
globalThis.fetch = async (url, options) => { calls.push({ url: new URL(url), options }); return response([]) }
assert.equal(await db.claimDmForSend('id', 'draft'), null)
assert.equal(calls[0].url.searchParams.get('response_sent'), 'eq.false')
const anchor = '2026-09-01T01:00:00.000Z'
calls = []
await db.supersedeBundleSiblings('sender', 'id', anchor)
assert.equal(calls.length, 2)
for (const c of calls) assert.equal(c.url.searchParams.get('created_at'), `lte.${anchor}`)
await assert.rejects(db.supersedeBundleSiblings('sender', 'id', 'invalid'), /boundary/)
globalThis.fetch = async () => response({}, 503)
await assert.rejects(db.claimDmForSend('id', 'draft'), /claim failed/)
await assert.rejects(db.fetchDmRowMeta('id'), /lookup failed/)
await assert.rejects(db.countFreshInboundAfter('sender', anchor), /lookup failed/)

let state, sends, cleanup
const reset = () => {
  state = null; sends = 0; cleanup = null
  globalThis.dmTestMocks = {
    supabaseConfigured: () => true,
    fetchDmRowMeta: async () => ({ senderId: 'sender', createdAt: anchor }),
    countFreshInboundAfter: async () => 0,
    claimDmForSend: async () => ({ senderId: 'sender', createdAt: anchor, responseText: 'draft', messageText: 'hi', draftSource: 'AI', sendingStartedAt: anchor }),
    markDmSent: async () => { state = 'SENT'; return true },
    markDmSendFailed: async () => { state = 'SEND_FAILED' },
    markDmStatusUnknown: async () => { state = 'SEND_STATUS_UNKNOWN' },
    getBlockedSenderIds: async () => new Set(),
    saveDmFeedback: async () => {},
    supersedeBundleSiblings: async (...args) => { cleanup = args; return 0 },
    requireAdminSession: () => true, validateSameOrigin: () => true,
  }
}
let src = readFileSync('src/app/api/admin/dm-inbox/send/route.ts', 'utf8')
src = src.replace(/import \{ NextRequest, NextResponse \} from 'next\/server'/, 'const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) }')
src = src.replace(/import \{([^}]*?)\} from '@\/lib\/(?:supabase|adminSession)'/g, (_all, names) => `const {${names}} = globalThis.dmTestMocks`)
let runN = 0
async function run(status, body) {
  globalThis.fetch = async (url, options) => {
    if (url.startsWith('https://graph.instagram.com/')) { sends++; return response(body, status) }
    assert.ok(url.startsWith('https://database.invalid/'))
    assert.ok(!options.method)
    return response([])
  }
  const { POST } = await load(src + `\n// case ${runN++}`)
  return POST(new Request('https://app.invalid/api/admin/dm-inbox/send', { method: 'POST', body: JSON.stringify({ id: 'id', finalText: 'draft' }) }))
}
reset(); dmTestMocks.claimDmForSend = async () => { throw new Error('db unavailable') }
assert.equal((await run(200, { message_id: 'fake' })).status, 503); assert.equal(sends, 0)
reset(); dmTestMocks.claimDmForSend = async () => null
assert.equal((await run(200, { message_id: 'fake' })).status, 409); assert.equal(sends, 0)
reset(); dmTestMocks.countFreshInboundAfter = async () => 1
assert.equal((await run(200, { message_id: 'fake' })).body.error, 'bundle_stale'); assert.equal(sends, 0)
// An old local timestamp must not prevent the mocked platform from accepting.
reset(); assert.equal((await run(200, { message_id: 'fake' })).body.sent, true)
assert.equal(state, 'SENT'); assert.equal(sends, 1); assert.deepEqual(cleanup, ['sender', 'id', anchor])
reset(); assert.equal((await run(400, { error: { message: 'Outside the messaging window' } })).body.error, 'ig_messaging_window'); assert.equal(state, 'SEND_FAILED')
reset(); assert.equal((await run(400, { error: { message: 'Cannot send messages to this account' } })).body.error, 'ig_send_failed')
reset(); assert.equal((await run(500, { error: { message: 'Server error' } })).body.error, 'send_status_unknown'); assert.equal(state, 'SEND_STATUS_UNKNOWN')
reset(); assert.equal((await run(200, {})).body.error, 'send_status_unknown'); assert.equal(state, 'SEND_STATUS_UNKNOWN')
console.log('PASS: unsent claims, preflight failures, fresh arrivals, bounded cleanup, old timestamps, platform rejection classification and uncertain sends')

reset(); assert.equal((await run(403, { error: { code: 10, error_subcode: 2534022, type: 'IGApiException', message: 'This message is sent outside of allowed window.' } })).body.error, 'ig_messaging_window'); assert.equal(state, 'SEND_FAILED')
reset(); assert.equal((await run(403, { error: { code: 10, message: 'This message is sent outside of allowed window.' } })).body.error, 'ig_messaging_window')
reset(); assert.equal((await run(403, { error: { code: 10, error_subcode: 2534022, message: 'Localized message' } })).body.error, 'ig_messaging_window')
console.log('PASS: exact production 403, message-only fallback, localized window error')
