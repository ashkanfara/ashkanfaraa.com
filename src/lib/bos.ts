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
