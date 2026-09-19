// Isolated regression tests: fake credentials, mocked fetch, no live services.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync('src/lib/dm-draft-recovery.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { recoverStaleDmDrafts } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
process.env.SUPABASE_URL = 'https://database.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only'
const response = (body, status = 200) => new Response(JSON.stringify(body), { status })
const old = new Date(Date.now() - 60 * 60_000).toISOString()
let calls = []
globalThis.fetch = async (url, options) => {
  calls.push({ url: new URL(url), options })
  if (!options.method) return response([
    { id: 'old', generation_id: 'generation-1', processing_started_at: old },
    { id: 'legacy', generation_id: null, processing_started_at: old },
  ])
  // A concurrent callback has already completed the first row: no match.
  return response(new URL(url).searchParams.get('id') === 'eq.old' ? [] : [{ id: 'legacy' }])
}
assert.deepEqual(await recoverStaleDmDrafts(), { ok: true, reset: 1, found: 2, errors: 0 })
for (const call of calls) {
  assert.equal(call.url.searchParams.get('response_sent'), 'eq.false')
  assert.equal(call.url.searchParams.get('failed_reason'), 'eq.DRAFT_GENERATING')
  assert.ok(call.url.searchParams.getAll('processing_started_at').some(v => v.startsWith('lt.')))
}
for (const call of calls.slice(1)) {
  assert.ok(call.url.searchParams.getAll('processing_started_at').includes(`eq.${old}`))
  assert.deepEqual(JSON.parse(call.options.body), { failed_reason: 'DRAFT_FAILED', processing: false })
}
assert.equal(calls[1].url.searchParams.get('generation_id'), 'eq.generation-1')
assert.equal(calls[2].url.searchParams.get('generation_id'), 'is.null')

globalThis.fetch = async () => response([], 503)
await assert.rejects(recoverStaleDmDrafts(), /query failed/)
globalThis.fetch = async (_url, opts) => opts.method ? response({}, 500) : response([{ id: 'old', generation_id: null, processing_started_at: old }])
assert.deepEqual(await recoverStaleDmDrafts(), { ok: false, reset: 0, found: 1, errors: 1 })
globalThis.fetch = async () => response([])
assert.deepEqual(await recoverStaleDmDrafts(), { ok: true, reset: 0, found: 0, errors: 0 })
delete process.env.SUPABASE_SERVICE_ROLE_KEY
await assert.rejects(recoverStaleDmDrafts(), /not configured/)

// Exercise cron authentication without loading Next or contacting any database.
let route = readFileSync('src/app/api/cron/reset-stale-drafts/route.ts', 'utf8')
route = route.replace(/import .*from 'next\/server'/, 'const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) }')
route = route.replace(/import .*from '@\/lib\/dm-draft-recovery'/, 'const recoverStaleDmDrafts = async () => ({ ok: true, reset: 0 })')
const routeJs = ts.transpileModule(route, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { GET } = await import(`data:text/javascript;base64,${Buffer.from(routeJs).toString('base64')}`)
delete process.env.CRON_SECRET
assert.equal((await GET(new Request('https://app.invalid', { headers: { authorization: 'Bearer undefined' } }))).status, 401)
process.env.CRON_SECRET = 'test-cron'
assert.equal((await GET(new Request('https://app.invalid'))).status, 401)
assert.equal((await GET(new Request('https://app.invalid', { headers: { authorization: 'Bearer test-cron' } }))).status, 200)
console.log('PASS: recovery races, null claims, database failures, empty queue, missing config, cron authentication')
