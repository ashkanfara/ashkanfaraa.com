/**
 * POST /api/admin/bos/approve
 *
 * Human approval gate for BOS tasks in awaiting_human status.
 * Sets human_approved_at + transitions status → done.
 * Then evaluates the dependency graph to unblock waiting tasks.
 *
 * Body: { task_id: string; note?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminSession'
import { getBosTask, updateBosTask, evaluateDependencies } from '@/lib/bos'

export async function POST(req: NextRequest) {
  if (!requireAdminSession(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: { task_id?: string; note?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const taskId = typeof body.task_id === 'string' ? body.task_id.trim() : ''
  if (!taskId) return NextResponse.json({ ok: false, error: 'task_id required' }, { status: 422 })

  const task = await getBosTask(taskId)
  if (!task) return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 })

  if (task.status !== 'awaiting_human') {
    return NextResponse.json({ ok: false, error: `Task is not awaiting_human (status=${task.status})` }, { status: 409 })
  }

  const now = new Date().toISOString()
  await updateBosTask(taskId, {
    status:            'done',
    human_approved_at: now,
    ...(body.note ? { approval_note: body.note } : {}),
  })

  const unblocked = await evaluateDependencies(taskId)

  console.log(`[bos/approve] ✓ approved task=${taskId} | unblocked=${unblocked.length}`)
  return NextResponse.json({ ok: true, task_id: taskId, unblocked_tasks: unblocked })
}
