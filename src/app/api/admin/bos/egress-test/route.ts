/**
 * GET  /api/admin/bos/egress-test?secret=<BOS_DISPATCH_SECRET>
 *   Fires the CEO Routine with THIS endpoint as bos_callback_url.
 *   Purpose: isolated proof-of-concept for Routine → ashkanfaraa.com egress.
 *   No bos_tasks, bos_objectives, bos_agent_runs, or DM data are touched.
 *
 * POST /api/admin/bos/egress-test
 *   Receives the callback from the Routine (Step 5 of CEO instructions).
 *   Logs the arrival and returns 200. No production data mutated.
 *   Server-side evidence: look for "[bos/egress-test] POST RECEIVED" in Vercel logs.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Auth: reuse BOS_DISPATCH_SECRET so no new env var is needed
  const provided = req.nextUrl.searchParams.get('secret')
  if (!provided || provided !== process.env.BOS_DISPATCH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const routineUrl   = process.env.BOS_CEO_ROUTINE_URL
  const routineToken = process.env.BOS_CEO_ROUTINE_TOKEN
  if (!routineUrl || !routineToken) {
    return NextResponse.json(
      { error: 'BOS_CEO_ROUTINE_URL or BOS_CEO_ROUTINE_TOKEN not configured' },
      { status: 503 },
    )
  }

  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.ashkanfaraa.com'
  const callbackUrl = `${siteUrl}/api/admin/bos/egress-test`

  // Minimal payload that satisfies the CEO Routine input schema.
  // bos_callback_url is the key variable: Routine Step 5 POSTs to it.
  // task_description asks Claude to skip Supabase steps and go straight to Step 5
  // — this shortens the test without changing the instructions.
  const payload = {
    bos_task_id:         'egress-test-task-001',
    bos_run_id:          'egress-test-run-001',
    bos_callback_url:    callbackUrl,
    bos_callback_secret: 'egress-test-marker-2026',
    task_title:          'EGRESS CONNECTIVITY TEST — no business action required',
    task_description:    'This is an automated network-reachability test. Skip Steps 1–4. Proceed DIRECTLY to Step 5 and POST to bos_callback_url now. This verifies Routine-to-website HTTP connectivity. Do not read Supabase, do not create tasks, do not write any bos_agent_runs row.',
    task_priority:       'P0',
    task_type:           'operational',
    acceptance_criteria: 'Callback received by the test endpoint.',
    evidence_so_far:     '[]',
    approval_category:   'none',
    notes:               'Automated egress test — safe to ignore in task list',
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

  return NextResponse.json({
    ok:            true,
    fire_status:   fireStatus,
    callback_url:  callbackUrl,
    marker:        'egress-test-marker-2026',
    instructions:  'Routine fired. Wait 60–120 s, then check Vercel function logs for "[bos/egress-test] POST RECEIVED". That log line is the server-side proof.',
  })
}

export async function POST(req: NextRequest) {
  // Receive the callback that the CEO Routine fires in Step 5.
  // No auth enforcement — marker in body is sufficient to confirm origin.
  // No production data is written.
  let body: unknown = null
  try { body = await req.json() } catch { /* ignore */ }

  const secret = req.headers.get('x-bos-secret') ?? '(none)'

  console.log('[bos/egress-test] ========================================')
  console.log('[bos/egress-test] POST RECEIVED — EGRESS CONFIRMED')
  console.log('[bos/egress-test] x-bos-secret:', secret)
  console.log('[bos/egress-test] body:', JSON.stringify(body))
  console.log('[bos/egress-test] timestamp:', new Date().toISOString())
  console.log('[bos/egress-test] ========================================')

  return NextResponse.json({ ok: true, received: true, timestamp: new Date().toISOString() })
}
