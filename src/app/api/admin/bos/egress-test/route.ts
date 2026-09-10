/**
 * Self-verifying Routine egress test — no production state is touched.
 *
 * GET  ?probe=bos-egress-run[&nonce=<uuid>]
 *   Generates a unique nonce, fires the CEO Routine with this endpoint as
 *   bos_callback_url, and returns the nonce.  Poll the result endpoint to
 *   confirm receipt.
 *
 * GET  ?action=result&nonce=<uuid>&probe=bos-egress-run
 *   Checks bos_egress_probes for the given nonce.
 *   Returns { found: true|false, received_at?, secret_matched? }.
 *
 * GET  ?action=cleanup&nonce=<uuid>&probe=bos-egress-run
 *   Deletes the probe row from bos_egress_probes.
 *
 * POST (no query params)
 *   Receives the callback from the CEO Routine (Step 5).
 *   Stores the nonce (= x-bos-secret header) in bos_egress_probes.
 *   Returns { ok: true, received: true }.
 *
 * Supabase table (must exist before first POST):
 *   CREATE TABLE bos_egress_probes (
 *     nonce       TEXT PRIMARY KEY,
 *     received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     secret      TEXT,
 *     body        TEXT,
 *     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 */

import { NextRequest, NextResponse } from 'next/server'

const EXPECTED_NONCE_PREFIX = 'bos-egress-'

function sbBase() {
  const url = process.env.SUPABASE_URL
  if (!url) throw new Error('SUPABASE_URL not set')
  return url.replace(/\/$/, '')
}
function sbKey() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  return k
}
function sbHeaders() {
  const k = sbKey()
  return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' }
}

export async function GET(req: NextRequest) {
  const probe  = req.nextUrl.searchParams.get('probe')
  const action = req.nextUrl.searchParams.get('action')

  if (probe !== 'bos-egress-run') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Result polling ─────────────────────────────────────────────────────
  if (action === 'result') {
    const nonce = req.nextUrl.searchParams.get('nonce')
    if (!nonce) return NextResponse.json({ error: 'nonce required' }, { status: 400 })

    try {
      const res = await fetch(
        `${sbBase()}/rest/v1/bos_egress_probes?nonce=eq.${encodeURIComponent(nonce)}&select=nonce,received_at,secret,created_at&limit=1`,
        { headers: sbHeaders(), cache: 'no-store' },
      )
      if (!res.ok) {
        const txt = await res.text()
        console.error('[bos/egress-test] result query failed:', res.status, txt)
        return NextResponse.json({ found: false, error: `supabase ${res.status}: ${txt}` }, { status: 502 })
      }
      const rows = await res.json() as { nonce: string; received_at: string; secret: string | null; created_at: string }[]
      if (rows.length === 0) {
        return NextResponse.json({ found: false, nonce })
      }
      return NextResponse.json({
        found:          true,
        nonce,
        received_at:    rows[0].received_at,
        secret_matched: rows[0].secret === nonce,
      })
    } catch (err) {
      return NextResponse.json({ found: false, error: String(err) }, { status: 502 })
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────
  if (action === 'cleanup') {
    const nonce = req.nextUrl.searchParams.get('nonce')
    if (!nonce) return NextResponse.json({ error: 'nonce required' }, { status: 400 })
    try {
      await fetch(
        `${sbBase()}/rest/v1/bos_egress_probes?nonce=eq.${encodeURIComponent(nonce)}`,
        { method: 'DELETE', headers: sbHeaders() },
      )
      return NextResponse.json({ ok: true, deleted: nonce })
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 502 })
    }
  }

  // ── Fire test ──────────────────────────────────────────────────────────
  const routineUrl   = process.env.BOS_CEO_ROUTINE_URL
  const routineToken = process.env.BOS_CEO_ROUTINE_TOKEN
  if (!routineUrl || !routineToken) {
    return NextResponse.json({ error: 'BOS_CEO_ROUTINE_URL or BOS_CEO_ROUTINE_TOKEN not configured' }, { status: 503 })
  }

  // Nonce is used as the bos_callback_secret so the POST handler can identify which probe arrived.
  const nonce       = `${EXPECTED_NONCE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.ashkanfaraa.com'
  const callbackUrl = `${siteUrl}/api/admin/bos/egress-test`

  const payload = {
    bos_task_id:         `egress-test-${nonce}`,
    bos_run_id:          `egress-run-${nonce}`,
    bos_callback_url:    callbackUrl,
    bos_callback_secret: nonce,
    task_title:          'EGRESS CONNECTIVITY TEST — no business action required',
    task_description:
      'This is an automated network-reachability test. ' +
      'Skip Steps 1–4. Proceed DIRECTLY to Step 5 and POST to bos_callback_url now. ' +
      'This verifies Routine-to-website HTTP connectivity. ' +
      'Do not read Supabase, do not create tasks, do not write any bos_agent_runs row.',
    task_priority:       'P0',
    task_type:           'operational',
    acceptance_criteria: 'Callback received by the test endpoint.',
    evidence_so_far:     '[]',
    approval_category:   'none',
    notes:               'Automated egress test — safe to ignore',
  }

  let fireStatus = 0
  let fireBody   = ''
  try {
    const fireRes = await fetch(routineUrl, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'Authorization':     `Bearer ${routineToken}`,
        'anthropic-beta':    'experimental-cc-routine-2026-04-01',
        'anthropic-version': '2023-06-01',
      },
      body:   JSON.stringify({ text: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(20_000),
    })
    fireStatus = fireRes.status
    fireBody   = await fireRes.text()
    console.log(`[bos/egress-test] Routine fire → ${fireStatus}: ${fireBody.substring(0, 300)}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[bos/egress-test] Routine fire error:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }

  if (fireStatus < 200 || fireStatus >= 300) {
    return NextResponse.json({ ok: false, fire_status: fireStatus, fire_body: fireBody }, { status: 502 })
  }

  const resultUrl = `${callbackUrl}?action=result&nonce=${encodeURIComponent(nonce)}&probe=bos-egress-run`
  return NextResponse.json({
    ok:           true,
    nonce,
    fire_status:  fireStatus,
    callback_url: callbackUrl,
    result_url:   resultUrl,
    instructions: `Routine fired with nonce=${nonce}. Poll result_url every 15s for up to 3 min. found:true means EGRESS PASS.`,
  })
}

export async function POST(req: NextRequest) {
  let body: unknown = null
  try { body = await req.json() } catch { /* ignore */ }

  const secret = req.headers.get('x-bos-secret') ?? '(none)'

  console.log('[bos/egress-test] ========================================')
  console.log('[bos/egress-test] POST RECEIVED — EGRESS CONFIRMED')
  console.log('[bos/egress-test] x-bos-secret:', secret)
  console.log('[bos/egress-test] body:', JSON.stringify(body).substring(0, 500))
  console.log('[bos/egress-test] timestamp:', new Date().toISOString())
  console.log('[bos/egress-test] ========================================')

  // Persist to bos_egress_probes using nonce = secret header value.
  // If the table doesn't exist yet, log and skip — egress is still confirmed by this log line.
  if (secret && secret !== '(none)') {
    try {
      const res = await fetch(`${sbBase()}/rest/v1/bos_egress_probes`, {
        method:  'POST',
        headers: { ...sbHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body:    JSON.stringify({
          nonce:       secret,
          received_at: new Date().toISOString(),
          secret,
          body:        JSON.stringify(body),
        }),
      })
      if (!res.ok) {
        console.error('[bos/egress-test] probe insert failed:', res.status, await res.text())
      } else {
        console.log('[bos/egress-test] probe stored to bos_egress_probes, nonce:', secret)
      }
    } catch (err) {
      console.error('[bos/egress-test] probe insert error:', err)
    }
  }

  return NextResponse.json({ ok: true, received: true, timestamp: new Date().toISOString() })
}
