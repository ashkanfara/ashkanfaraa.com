/**
 * POST /api/admin/bos/callback
 *
 * Called by Claude Routines when they complete a BOS task.
 * Also called by the n8n BOS Callback workflow for intermediate events.
 *
 * Authentication: x-bos-secret header = BOS_CALLBACK_SECRET env var.
 *
 * Body (from Routine):
 * {
 *   task_id:           string            — task that was completed
 *   run_id:            string | null     — agent run ID to close
 *   status:            'done' | 'awaiting_human' | 'failed' | 'blocked'
 *   outcome?:          string            — one-line result summary
 *   evidence?:         object[]          — evidence items to APPEND (not replace)
 *   approval_note?:    string            — shown to Ashkan for awaiting_human
 *   approval_category?: string           — if changing approval category
 *   blocked_reason?:   string            — if status=blocked
 *   new_tasks?:        NewTaskInput[]    — handoff tasks to create
 * }
 *
 * Flow:
 *   1. Auth
 *   2. Load current task (for existing evidence)
 *   3. Append evidence, update status/outcome
 *   4. Close agent run
 *   5. Update bos_state timestamps (last_ceo_run_at if CEO task)
 *   6. Evaluate dependency graph → unblock waiting tasks
 *   7. Create new handoff tasks
 *   8. Return { ok, unblocked_tasks, created_tasks }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getBosTask, updateBosTask, closeBosRun,
  createBosTask, evaluateDependencies, updateBosState,
} from '@/lib/bos'
import type { TaskOwner, TaskPriority, ApprovalCategory, TaskStatus } from '@/lib/bos'

interface NewTaskInput {
  title:               string
  owner:               TaskOwner
  priority:            TaskPriority
  task_type?:          string
  description?:        string
  acceptance_criteria?: string
  depends_on?:         string[]
  approval_category?:  ApprovalCategory
  notes?:              string
}

interface CallbackBody {
  task_id:           string
  run_id?:           string | null
  status:            'done' | 'awaiting_human' | 'failed' | 'blocked'
  outcome?:          string
  evidence?:         object[]
  approval_note?:    string
  approval_category?: string
  blocked_reason?:   string
  new_tasks?:        NewTaskInput[]
}

const ALLOWED_STATUSES = new Set(['done', 'awaiting_human', 'failed', 'blocked'])

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const secret = process.env.BOS_CALLBACK_SECRET
  if (!secret) {
    console.error('[bos/callback] BOS_CALLBACK_SECRET not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  if (req.headers.get('x-bos-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: CallbackBody
  try { body = await req.json() as CallbackBody } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { task_id, run_id, status, outcome, evidence, approval_note,
          blocked_reason, new_tasks } = body

  if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 422 })
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 422 })
  }

  // ── 3. Load task (need existing evidence to append, not replace) ──────────
  const task = await getBosTask(task_id)
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // Idempotency: if already done/cancelled, accept silently
  if (task.status === 'done' || task.status === 'cancelled') {
    console.warn(`[bos/callback] task ${task_id} already ${task.status} — ignoring`)
    return NextResponse.json({ ok: true, idempotent: true })
  }

  // ── 4. Build evidence array ───────────────────────────────────────────────
  const existingEvidence = Array.isArray(task.evidence) ? task.evidence : []
  const newEvidence      = Array.isArray(evidence) ? evidence : []
  const mergedEvidence   = [...existingEvidence, ...newEvidence]

  // ── 5. Update task ────────────────────────────────────────────────────────
  const taskUpdates: Parameters<typeof updateBosTask>[1] = {
    status:  status as TaskStatus,
    outcome: outcome ?? null,
    evidence: mergedEvidence,
  }
  if (approval_note)       taskUpdates.approval_note = approval_note
  if (blocked_reason)      taskUpdates.blocked_reason = blocked_reason
  if (body.approval_category) {
    taskUpdates.approval_category = body.approval_category as ApprovalCategory
  }

  await updateBosTask(task_id, taskUpdates)

  // ── 6. Close agent run ────────────────────────────────────────────────────
  if (run_id) {
    await closeBosRun(run_id, {
      status:         status === 'done' ? 'completed' : status,
      result_summary: outcome ?? `Task ${status}`,
      handoff_task_ids: [],
    })
  }

  // ── 7. Update bos_state timestamps ───────────────────────────────────────
  const stateUpdate: { last_ceo_run_at?: string } = {}
  if (task.owner === 'ceo') stateUpdate.last_ceo_run_at = new Date().toISOString()
  if (Object.keys(stateUpdate).length > 0) await updateBosState(stateUpdate)

  // ── 8. Dependency graph evaluation (only when task completed successfully) ─
  let unblockedTasks: string[] = []
  if (status === 'done') {
    unblockedTasks = await evaluateDependencies(task_id)
    if (unblockedTasks.length > 0) {
      console.log(`[bos/callback] unblocked tasks: ${unblockedTasks.join(', ')}`)
    }
  }

  // ── 9. Create handoff tasks ────────────────────────────────────────────────
  const createdTaskIds: string[] = []
  if (new_tasks && new_tasks.length > 0) {
    for (const t of new_tasks) {
      if (!t.title || !t.owner || !t.priority) continue
      const id = await createBosTask({
        title:               t.title,
        owner:               t.owner,
        priority:            t.priority,
        task_type:           t.task_type  ?? 'operational',
        description:         t.description,
        acceptance_criteria: t.acceptance_criteria,
        depends_on:          t.depends_on ?? [],
        approval_category:   t.approval_category ?? 'none',
        notes:               t.notes,
        created_by:          task.owner,
      })
      if (id) {
        createdTaskIds.push(id)
        console.log(`[bos/callback] created handoff task ${id}: ${t.title}`)
      }
    }
  }

  console.log(`[bos/callback] ✓ task=${task_id} → ${status} | unblocked=${unblockedTasks.length} | new=${createdTaskIds.length}`)
  return NextResponse.json({
    ok: true,
    task_id,
    status,
    unblocked_tasks: unblockedTasks,
    created_tasks:   createdTaskIds,
  })
}
