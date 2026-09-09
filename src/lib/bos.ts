/**
 * Business Operating System — Supabase helpers.
 * Server-side only. Never import from client components.
 *
 * Design notes:
 *   - bos_state never stores counts. All counts are computed directly from
 *     bos_tasks queries so they cannot drift after retries or duplicate callbacks.
 *   - Technical runtime abstraction: bos_tasks is the sole source of context
 *     for any Technical runtime (interactive or future autonomous).
 */

function base(): string {
  const url = process.env.SUPABASE_URL
  if (!url) throw new Error('SUPABASE_URL is not set')
  return url.replace(/\/$/, '')
}

function serviceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return key
}

function headers(): Record<string, string> {
  const key = serviceKey()
  return {
    apikey:         key,
    Authorization:  `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'awaiting_human' | 'done' | 'cancelled'
export type TaskOwner  = 'ceo' | 'sales' | 'marketing' | 'content' | 'technical'
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type ApprovalCategory =
  | 'none' | 'production_deploy' | 'external_communication' | 'instagram_send'
  | 'pricing_offer' | 'credential' | 'destructive_data' | 'financial'

export interface BosTask {
  id:                  string
  created_at:          string
  updated_at:          string
  claimed_at:          string | null
  title:               string
  description:         string | null
  task_type:           string
  priority:            TaskPriority
  objective_id:        string | null
  status:              TaskStatus
  owner:               TaskOwner
  created_by:          string | null
  depends_on:          string[]
  acceptance_criteria: string | null
  evidence:            object[]
  outcome:             string | null
  approval_category:   ApprovalCategory
  approval_note:       string | null
  human_approved_at:   string | null
  retry_count:         number
  blocked_reason:      string | null
  related_buffer_ids:  string[]
  related_sender_ids:  string[]
  notes:               string | null
}

export interface BosObjective {
  id:          string
  created_at:  string
  updated_at:  string
  title:       string
  description: string | null
  status:      string
  priority:    TaskPriority
  owner:       string
  notes:       string | null
}

export interface BosAgentRun {
  id:               string
  created_at:       string
  completed_at:     string | null
  task_id:          string
  manager:          TaskOwner
  status:           string
  trigger_type:     string
  input_summary:    string | null
  result_summary:   string | null
  actions_taken:    object[]
  handoff_task_ids: string[]
  error_detail:     string | null
  model_runtime:    string | null
}

export interface BosState {
  last_dispatch_at:   string | null
  last_ceo_run_at:    string | null
  system_status:      string
  // Computed counts — never stored in bos_state, always computed from bos_tasks.
  technical_task_count:    number
  human_approval_count:    number
  open_task_count:         number
  in_progress_task_count:  number
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Return all tasks, newest first, with optional filters.
 */
export async function getBosTasks(opts?: {
  status?: TaskStatus | TaskStatus[]
  owner?: TaskOwner
  priority?: TaskPriority
  limit?: number
}): Promise<BosTask[]> {
  const params = new URLSearchParams()
  params.set('order', 'priority.asc,created_at.asc')
  params.set('limit', String(opts?.limit ?? 200))
  params.set('select', '*')

  if (opts?.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status]
    params.set('status', `in.(${statuses.join(',')})`)
  }
  if (opts?.owner)    params.set('owner',    `eq.${opts.owner}`)
  if (opts?.priority) params.set('priority', `eq.${opts.priority}`)

  const res = await fetch(`${base()}/rest/v1/bos_tasks?${params}`, {
    headers: headers(), cache: 'no-store',
  })
  if (!res.ok) {
    console.error('[bos/getBosTasks] failed:', res.status, await res.text())
    return []
  }
  return res.json() as Promise<BosTask[]>
}

/**
 * Return all objectives.
 */
export async function getBosObjectives(): Promise<BosObjective[]> {
  const res = await fetch(
    `${base()}/rest/v1/bos_objectives?order=priority.asc,created_at.asc&select=*`,
    { headers: headers(), cache: 'no-store' }
  )
  if (!res.ok) return []
  return res.json() as Promise<BosObjective[]>
}

/**
 * Return recent agent runs (newest first).
 */
export async function getBosRuns(opts?: { taskId?: string; limit?: number }): Promise<BosAgentRun[]> {
  const params = new URLSearchParams()
  params.set('order', 'created_at.desc')
  params.set('limit', String(opts?.limit ?? 50))
  params.set('select', '*')
  if (opts?.taskId) params.set('task_id', `eq.${opts.taskId}`)

  const res = await fetch(`${base()}/rest/v1/bos_agent_runs?${params}`, {
    headers: headers(), cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json() as Promise<BosAgentRun[]>
}

/**
 * Compute BosState: reads bos_state for timestamps, then computes all counts
 * directly from bos_tasks with indexed queries. Counts are NEVER read from stored
 * columns — they are always fresh to prevent drift.
 */
export async function getBosState(): Promise<BosState> {
  const [stateRes, countsRes] = await Promise.all([
    fetch(`${base()}/rest/v1/bos_state?singleton=eq.true&select=*&limit=1`, {
      headers: headers(), cache: 'no-store',
    }),
    // One query to get all the counts we need using a select with filter variations
    // We fetch all non-terminal tasks and count in memory (table is small, <1000 rows expected).
    fetch(
      `${base()}/rest/v1/bos_tasks?status=not.in.(done,cancelled)&select=status,owner`,
      { headers: headers(), cache: 'no-store' }
    ),
  ])

  let lastDispatchAt: string | null = null
  let lastCeoRunAt: string | null = null
  let systemStatus = 'ok'

  if (stateRes.ok) {
    const rows = await stateRes.json() as Array<{ last_dispatch_at: string | null; last_ceo_run_at: string | null; system_status: string }>
    if (rows.length > 0) {
      lastDispatchAt = rows[0].last_dispatch_at
      lastCeoRunAt   = rows[0].last_ceo_run_at
      systemStatus   = rows[0].system_status
    }
  }

  let technicalTaskCount   = 0
  let humanApprovalCount   = 0
  let openTaskCount        = 0
  let inProgressTaskCount  = 0

  if (countsRes.ok) {
    const tasks = await countsRes.json() as Array<{ status: string; owner: string }>
    for (const t of tasks) {
      if (t.status === 'open')         openTaskCount++
      if (t.status === 'in_progress')  inProgressTaskCount++
      if (t.status === 'awaiting_human') humanApprovalCount++
      if (t.owner === 'technical' && t.status === 'open') technicalTaskCount++
    }
  }

  return {
    last_dispatch_at:      lastDispatchAt,
    last_ceo_run_at:       lastCeoRunAt,
    system_status:         systemStatus,
    technical_task_count:  technicalTaskCount,
    human_approval_count:  humanApprovalCount,
    open_task_count:       openTaskCount,
    in_progress_task_count: inProgressTaskCount,
  }
}

/**
 * Update bos_state timestamps (called by BOS Callback n8n webhook handler).
 * Does NOT update any counts — counts are always computed from bos_tasks.
 */
export async function updateBosState(updates: {
  last_dispatch_at?: string
  last_ceo_run_at?: string
  system_status?: string
}): Promise<void> {
  const body: Record<string, string> = {}
  if (updates.last_dispatch_at) body.last_dispatch_at = updates.last_dispatch_at
  if (updates.last_ceo_run_at)  body.last_ceo_run_at  = updates.last_ceo_run_at
  if (updates.system_status)    body.system_status     = updates.system_status

  if (Object.keys(body).length === 0) return

  const res = await fetch(`${base()}/rest/v1/bos_state?singleton=eq.true`, {
    method:  'PATCH',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    console.error('[bos/updateBosState] failed:', res.status, await res.text())
  }
}

// ── Phase 2: Dispatcher & Callback helpers ─────────────────────────────────

/**
 * Fetch a single task by ID.
 */
export async function getBosTask(taskId: string): Promise<BosTask | null> {
  const res = await fetch(
    `${base()}/rest/v1/bos_tasks?id=eq.${encodeURIComponent(taskId)}&select=*&limit=1`,
    { headers: headers(), cache: 'no-store' }
  )
  if (!res.ok) return null
  const rows = await res.json() as BosTask[]
  return rows[0] ?? null
}

/**
 * Atomically claim a task: PATCH WHERE status=eq.open → in_progress.
 * Returns true if claim succeeded (rows_affected=1), false if already claimed.
 */
export async function claimBosTask(taskId: string): Promise<boolean> {
  const res = await fetch(
    `${base()}/rest/v1/bos_tasks?id=eq.${encodeURIComponent(taskId)}&status=eq.open`,
    {
      method:  'PATCH',
      headers: { ...headers(), Prefer: 'count=exact,return=minimal' },
      body:    JSON.stringify({ status: 'in_progress', claimed_at: new Date().toISOString() }),
    }
  )
  if (!res.ok) return false
  // Prefer: count=exact returns Content-Range: 0-0/1 (claimed) or */0 (not found)
  const range = res.headers.get('content-range') ?? ''
  return !range.endsWith('/0')
}

/**
 * Create a bos_agent_runs row and return its ID.
 */
export async function createBosRun(opts: {
  task_id:       string
  manager:       TaskOwner
  trigger_type:  string
  input_summary: string
  model_runtime: string
}): Promise<string | null> {
  const res = await fetch(`${base()}/rest/v1/bos_agent_runs`, {
    method:  'POST',
    headers: { ...headers(), Prefer: 'return=representation' },
    body:    JSON.stringify({
      task_id:       opts.task_id,
      manager:       opts.manager,
      status:        'running',
      trigger_type:  opts.trigger_type,
      input_summary: opts.input_summary,
      model_runtime: opts.model_runtime,
    }),
  })
  if (!res.ok) {
    console.error('[bos/createBosRun] failed:', res.status, await res.text())
    return null
  }
  const rows = await res.json() as Array<{ id: string }>
  return rows[0]?.id ?? null
}

/**
 * Append an evidence item to a task's evidence array (JSONB append via RPC workaround).
 * Uses a GET+PATCH cycle: read current evidence, append item, write back.
 * Safe because the dispatcher claims the task first (only one writer at a time).
 */
export async function appendBosEvidence(
  taskId: string,
  item:   { timestamp: string; type: string; description: string; value?: string }
): Promise<void> {
  const task = await getBosTask(taskId)
  if (!task) return
  const existing = Array.isArray(task.evidence) ? task.evidence : []
  await fetch(
    `${base()}/rest/v1/bos_tasks?id=eq.${encodeURIComponent(taskId)}`,
    {
      method:  'PATCH',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body:    JSON.stringify({ evidence: [...existing, item] }),
    }
  )
}

/**
 * Update a task's status, outcome, approval fields, blocked reason, or retry_count.
 */
export async function updateBosTask(
  taskId:  string,
  updates: Partial<Pick<BosTask,
    'status' | 'outcome' | 'evidence' | 'approval_note' | 'approval_category' |
    'human_approved_at' | 'blocked_reason' | 'retry_count'
  >>
): Promise<void> {
  await fetch(
    `${base()}/rest/v1/bos_tasks?id=eq.${encodeURIComponent(taskId)}`,
    {
      method:  'PATCH',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body:    JSON.stringify(updates),
    }
  )
}

/**
 * Close a bos_agent_run row with final status/result.
 */
export async function closeBosRun(runId: string, opts: {
  status:         string
  result_summary: string
  error_detail?:  string
  handoff_task_ids?: string[]
}): Promise<void> {
  await fetch(
    `${base()}/rest/v1/bos_agent_runs?id=eq.${encodeURIComponent(runId)}`,
    {
      method:  'PATCH',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body:    JSON.stringify({
        status:           opts.status,
        completed_at:     new Date().toISOString(),
        result_summary:   opts.result_summary,
        error_detail:     opts.error_detail ?? null,
        handoff_task_ids: opts.handoff_task_ids ?? [],
      }),
    }
  )
}

/**
 * Create a new bos_task (used by Routines to hand off work).
 */
export async function createBosTask(task: Partial<BosTask> & {
  title: string; owner: TaskOwner; priority: TaskPriority
}): Promise<string | null> {
  const res = await fetch(`${base()}/rest/v1/bos_tasks`, {
    method:  'POST',
    headers: { ...headers(), Prefer: 'return=representation' },
    body:    JSON.stringify({
      ...task,
      status:     task.status     ?? 'open',
      depends_on: task.depends_on ?? [],
      evidence:   task.evidence   ?? [],
    }),
  })
  if (!res.ok) {
    console.error('[bos/createBosTask] failed:', res.status, await res.text())
    return null
  }
  const rows = await res.json() as Array<{ id: string }>
  return rows[0]?.id ?? null
}

/**
 * After a task completes, find all tasks that depend_on it and check if all
 * their dependencies are now done. Unblock any that are fully satisfied.
 * Returns the IDs of tasks that were unblocked.
 */
export async function evaluateDependencies(completedTaskId: string): Promise<string[]> {
  // Fetch all non-terminal tasks that declare any dependency
  const res = await fetch(
    `${base()}/rest/v1/bos_tasks?status=in.(blocked,open)&depends_on=not.eq.%7B%7D&select=id,depends_on,status`,
    { headers: headers(), cache: 'no-store' }
  )
  if (!res.ok) return []
  const candidates = await res.json() as Array<{ id: string; depends_on: string[]; status: string }>

  // Filter to tasks that actually depend on the completed task
  const dependents = candidates.filter(t => t.depends_on.includes(completedTaskId))
  if (dependents.length === 0) return []

  // For each dependent, check if ALL its deps are done
  const unblocked: string[] = []
  for (const dep of dependents) {
    const allDepIds = dep.depends_on
    const doneRes = await fetch(
      `${base()}/rest/v1/bos_tasks?id=in.(${allDepIds.map(encodeURIComponent).join(',')})&status=eq.done&select=id`,
      { headers: headers(), cache: 'no-store' }
    )
    if (!doneRes.ok) continue
    const doneIds = (await doneRes.json() as Array<{ id: string }>).map(r => r.id)
    const allDone = allDepIds.every(id => doneIds.includes(id))

    if (allDone) {
      await updateBosTask(dep.id, { status: 'open', blocked_reason: null } as Parameters<typeof updateBosTask>[1])
      unblocked.push(dep.id)
    }
  }
  return unblocked
}
