/**
 * POST /api/admin/bos/fire
 *
 * Called by the BOS Dispatcher (n8n every 5 min) to dispatch one task to its
 * appropriate Claude Routine manager.
 *
 * Authentication: x-bos-dispatch-secret header = BOS_DISPATCH_SECRET env var.
 * Body: { task_id: string }
 *
 * Manager → Routine URL + per-Routine token env vars:
 *   BOS_CEO_ROUTINE_URL      + BOS_CEO_ROUTINE_TOKEN
 *   BOS_SALES_ROUTINE_URL    + BOS_SALES_ROUTINE_TOKEN
 *   BOS_MARKETING_ROUTINE_URL + BOS_MARKETING_ROUTINE_TOKEN
 *   BOS_CONTENT_ROUTINE_URL  + BOS_CONTENT_ROUTINE_TOKEN
 * Each Routine has its own authorization token (per-Routine auth model).
 *
 * Flow:
 *   1. Auth check
 *   2. Load task, verify dispatchable (open, non-technical, deps satisfied)
 *   3. Atomic claim (PATCH WHERE status=eq.open)
 *   4. Create bos_agent_runs row
 *   5. Build context payload for Routine
 *   6. Fire Routine (POST to manager's trigger URL)
 *   7. Return { ok, dispatched, run_id }
 *
 * The Routine completes asynchronously and POSTs back to /api/admin/bos/callback.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getBosTask, claimBosTask, createBosRun, updateBosTask, closeBosRun,
  evaluateDependencies, getBosTasks,
} from '@/lib/bos'
import type { TaskOwner } from '@/lib/bos'

const MAX_RETRIES = 3

function routineUrl(owner: TaskOwner): string | null {
  const map: Record<TaskOwner, string | undefined> = {
    ceo:       process.env.BOS_CEO_ROUTINE_URL,
    sales:     process.env.BOS_SALES_ROUTINE_URL,
    marketing: process.env.BOS_MARKETING_ROUTINE_URL,
    content:   process.env.BOS_CONTENT_ROUTINE_URL,
    technical: undefined,
  }
  return map[owner] ?? null
}

function routineToken(owner: TaskOwner): string | null {
  const map: Record<TaskOwner, string | undefined> = {
    ceo:       process.env.BOS_CEO_ROUTINE_TOKEN,
    sales:     process.env.BOS_SALES_ROUTINE_TOKEN,
    marketing: process.env.BOS_MARKETING_ROUTINE_TOKEN,
    content:   process.env.BOS_CONTENT_ROUTINE_TOKEN,
    technical: undefined,
  }
  return map[owner] ?? null
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const secret = process.env.BOS_DISPATCH_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'BOS_DISPATCH_SECRET not configured' }, { status: 503 })
  }
  if (req.headers.get('x-bos-dispatch-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: { task_id?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }
  const taskId = typeof body.task_id === 'string' ? body.task_id.trim() : ''
  if (!taskId) return NextResponse.json({ ok: false, error: 'task_id required' }, { status: 422 })

  // ── 3. Load task ──────────────────────────────────────────────────────────
  const task = await getBosTask(taskId)
  if (!task) return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 })

  if (task.status !== 'open') {
    return NextResponse.json({ ok: false, skipped: true, reason: `status=${task.status}` })
  }
  if (task.owner === 'technical') {
    return NextResponse.json({ ok: false, skipped: true, reason: 'technical tasks are manually invoked' })
  }

  const url = routineUrl(task.owner)
  if (!url) {
    return NextResponse.json({ ok: false, error: `No Routine URL configured for owner=${task.owner}` }, { status: 503 })
  }

  const token = routineToken(task.owner)
  if (!token) {
    return NextResponse.json({ ok: false, error: `No Routine token configured for owner=${task.owner}` }, { status: 503 })
  }

  // ── 4. Check dependencies ─────────────────────────────────────────────────
  if (task.depends_on && task.depends_on.length > 0) {
    const depTasks = await getBosTasks({ status: 'done' })
    const doneIds = new Set(depTasks.map(t => t.id))
    const unsatisfied = task.depends_on.filter(id => !doneIds.has(id))
    if (unsatisfied.length > 0) {
      // Block the task with the unsatisfied dep reason
      await updateBosTask(taskId, {
        status: 'blocked',
        blocked_reason: `Waiting on deps: ${unsatisfied.join(', ')}`,
      })
      return NextResponse.json({ ok: false, skipped: true, reason: 'dependencies not satisfied' })
    }
  }

  // ── 5. Check retry exhaustion ─────────────────────────────────────────────
  if (task.retry_count >= MAX_RETRIES) {
    await updateBosTask(taskId, {
      status: 'blocked',
      blocked_reason: `Retry exhausted (${task.retry_count}/${MAX_RETRIES})`,
    })
    return NextResponse.json({ ok: false, skipped: true, reason: 'retry exhausted' })
  }

  // ── 6. Atomic claim ───────────────────────────────────────────────────────
  const claimed = await claimBosTask(taskId)
  if (!claimed) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'task already claimed (concurrent dispatch)' })
  }

  // ── 7. Create agent run ───────────────────────────────────────────────────
  const runId = await createBosRun({
    task_id:       taskId,
    manager:       task.owner,
    trigger_type:  'scheduled',
    input_summary: `Dispatching ${task.priority} task: ${task.title}`,
    model_runtime: 'anthropic-routine',
  })

  // Build callback URL for the Routine to POST back to
  const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.ashkanfaraa.com'}/api/admin/bos/callback`

  // ── 8. Build Routine payload ──────────────────────────────────────────────
  const payload = {
    bos_task_id:         taskId,
    bos_run_id:          runId,
    bos_callback_url:    callbackUrl,
    // Callback token: derived from run_id so Routine can auth the callback.
    // The callback route validates this same derivation.
    task_title:          task.title,
    task_description:    task.description ?? '',
    task_priority:       task.priority,
    task_type:           task.task_type,
    acceptance_criteria: task.acceptance_criteria ?? '',
    evidence_so_far:     JSON.stringify(task.evidence ?? []),
    approval_category:   task.approval_category,
    notes:               task.notes ?? '',
  }

  // ── 9. Fire Routine ───────────────────────────────────────────────────────
  let fireOk = false
  try {
    const fireRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'Authorization':     `Bearer ${token}`,
        'anthropic-beta':    'experimental-cc-routine-2026-04-01',
        'anthropic-version': '2023-06-01',
      },
      body:   JSON.stringify({ text: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(20_000),
    })
    fireOk = fireRes.ok
    if (!fireOk) {
      const errBody = await fireRes.text()
      console.error(`[bos/fire] Routine fire failed: ${fireRes.status}`, errBody)
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    console.error('[bos/fire] Routine fire error:', isTimeout ? 'timeout(20s)' : err)
  }

  if (!fireOk) {
    // Increment retry_count and reset to open so dispatcher can retry
    await updateBosTask(taskId, {
      status:      'open',
      retry_count: task.retry_count + 1,
    })
    if (runId) {
      await closeBosRun(runId, {
        status:         'failed',
        result_summary: 'Routine fire failed — task returned to open for retry',
        error_detail:   'HTTP error or timeout when calling Routine trigger URL',
      })
    }
    return NextResponse.json({ ok: false, error: 'Routine fire failed; task queued for retry' })
  }

  // Routine fired successfully. Task stays in_progress until callback arrives.
  console.log(`[bos/fire] ✓ dispatched task=${taskId} owner=${task.owner} run=${runId}`)
  return NextResponse.json({ ok: true, dispatched: true, run_id: runId })
}
