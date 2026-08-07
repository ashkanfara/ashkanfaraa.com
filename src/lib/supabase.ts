/**
 * Supabase REST API helpers — server-side only.
 * Never import from client components.
 *
 * Required env vars:
 *   SUPABASE_URL             e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY
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
    apikey:          key,
    Authorization:   `Bearer ${key}`,
    'Content-Type':  'application/json',
  }
}

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase()
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// ── Queries ───────────────────────────────────────────────────

export interface LeadData {
  dmMode:   string | null
  senderId: string | null
}

/**
 * Fetch dm_mode and sender_id for a list of instagram handles in one query.
 * Returns a Map<normalizedHandle, LeadData>.
 * Returns an empty Map if Supabase is not configured or query fails.
 */
export async function getLeadsData(handles: string[]): Promise<Map<string, LeadData>> {
  const map = new Map<string, LeadData>()
  if (!supabaseConfigured() || handles.length === 0) return map

  const list = handles.map(h => `"${h}"`).join(',')
  try {
    const res = await fetch(
      `${base()}/rest/v1/consultation_leads?instagram_handle=in.(${list})&select=instagram_handle,dm_mode,sender_id`,
      { headers: headers(), cache: 'no-store' }
    )
    if (!res.ok) {
      console.error('[supabase/getLeadsData] query failed:', res.status, await res.text())
      return map
    }
    const rows = await res.json() as { instagram_handle: string; dm_mode: string | null; sender_id: string | null }[]
    for (const row of rows) {
      map.set(row.instagram_handle, { dmMode: row.dm_mode, senderId: row.sender_id })
    }
  } catch (err) {
    console.error('[supabase/getLeadsData] fetch error:', err)
  }
  return map
}

// ── Mutations ──────────────────────────────────────────────────

export interface UpsertDmModeFields {
  instagramHandle:     string   // already normalized
  dmMode:              string   // AI | Hybrid | Human
  notionPageId?:       string
  name?:               string
  email?:              string
  phone?:              string
  location?:           string
  consultationStatus?: string
}

/**
 * Upsert a consultation_leads row by instagram_handle.
 * On conflict: updates dm_mode + updated_at only.
 * On insert:   writes all provided fields.
 */
export async function upsertDmMode(fields: UpsertDmModeFields): Promise<void> {
  const now = new Date().toISOString()

  const body: Record<string, string> = {
    instagram_handle: fields.instagramHandle,
    dm_mode:          fields.dmMode,
    updated_at:       now,
  }

  if (fields.notionPageId)       body.notion_page_id        = fields.notionPageId
  if (fields.name)               body.name                  = fields.name
  if (fields.email)              body.email                 = fields.email
  if (fields.phone)              body.phone                 = fields.phone
  if (fields.location)           body.location              = fields.location
  if (fields.consultationStatus) body.consultation_status   = fields.consultationStatus

  const res = await fetch(`${base()}/rest/v1/consultation_leads?on_conflict=instagram_handle`, {
    method:  'POST',
    headers: {
      ...headers(),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase upsert failed: ${res.status} ${text}`)
  }
}

// ── Blocklist ──────────────────────────────────────────────────

/**
 * Fetch blocked state for a list of sender_ids in one query.
 * Returns a Set<sender_id> of blocked IDs.
 * Returns empty Set if Supabase is not configured or query fails.
 */
export async function getBlockedSenderIds(senderIds: string[]): Promise<Set<string>> {
  const set = new Set<string>()
  if (!supabaseConfigured() || senderIds.length === 0) return set

  const list = senderIds.map(id => `"${id}"`).join(',')
  try {
    const res = await fetch(
      `${base()}/rest/v1/dm_blocklist?sender_id=in.(${list})&select=sender_id`,
      { headers: headers(), cache: 'no-store' }
    )
    if (!res.ok) {
      console.error('[supabase/getBlockedSenderIds] query failed:', res.status, await res.text())
      return set
    }
    const rows = await res.json() as { sender_id: string }[]
    for (const row of rows) set.add(row.sender_id)
  } catch (err) {
    console.error('[supabase/getBlockedSenderIds] fetch error:', err)
  }
  return set
}

/**
 * Add sender to dm_blocklist. Idempotent — ON CONFLICT DO NOTHING.
 * sender_id is the primary key so no duplicates are possible.
 */
export async function blockSender(senderId: string, name: string): Promise<void> {
  const res = await fetch(`${base()}/rest/v1/dm_blocklist?on_conflict=sender_id`, {
    method:  'POST',
    headers: {
      ...headers(),
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify({ sender_id: senderId, name }),
  })
  if (!res.ok) {
    throw new Error(`blockSender failed: ${res.status} ${await res.text()}`)
  }
}

/**
 * Remove sender from dm_blocklist by sender_id.
 */
export async function unblockSender(senderId: string): Promise<void> {
  const res = await fetch(
    `${base()}/rest/v1/dm_blocklist?sender_id=eq.${encodeURIComponent(senderId)}`,
    { method: 'DELETE', headers: headers() }
  )
  if (!res.ok) {
    throw new Error(`unblockSender failed: ${res.status} ${await res.text()}`)
  }
}

export interface BlockedSender {
  senderId: string
  name:     string | null
}

/**
 * List all rows in dm_blocklist.
 * Only selects sender_id + name — other columns (e.g. created_at) are not
 * assumed to exist.
 * Returns an empty array if Supabase is not configured or the query fails.
 */
export async function listBlockedSenders(): Promise<BlockedSender[]> {
  if (!supabaseConfigured()) return []

  try {
    const res = await fetch(
      `${base()}/rest/v1/dm_blocklist?select=sender_id,name&order=sender_id.asc`,
      { headers: headers(), cache: 'no-store' }
    )
    if (!res.ok) {
      console.error('[supabase/listBlockedSenders] query failed:', res.status, await res.text())
      return []
    }
    const rows = await res.json() as { sender_id: string; name: string | null }[]
    return rows.map(row => ({ senderId: row.sender_id, name: row.name }))
  } catch (err) {
    console.error('[supabase/listBlockedSenders] fetch error:', err)
    return []
  }
}

// ── DM Access Rules ─────────────────────────────────────────────
// Unified rules table: one row per Instagram handle, covering people who
// have never DM'd yet (sender_id null — "Username rule") as well as known
// senders ("Known user"). Falls back safely to [] / no-op if the
// dm_access_rules table hasn't been created yet (migration pending).

export type AccessStatus = 'ai_allowed' | 'human_only' | 'blocked'

export interface AccessRule {
  handle:    string
  senderId:  string | null
  status:    AccessStatus
  source:    'username' | 'sender_id'
  notes:     string | null
  createdAt: string | null
  updatedAt: string | null
}

/**
 * List all dm_access_rules rows. Returns [] if the table doesn't exist yet
 * or Supabase is not configured — never throws.
 */
export async function listAccessRules(): Promise<AccessRule[]> {
  if (!supabaseConfigured()) return []

  try {
    const res = await fetch(
      `${base()}/rest/v1/dm_access_rules?select=instagram_handle,sender_id,status,source,notes,created_at,updated_at&order=updated_at.desc`,
      { headers: headers(), cache: 'no-store' }
    )
    if (!res.ok) {
      console.error('[supabase/listAccessRules] query failed (table may not exist yet):', res.status, await res.text())
      return []
    }
    const rows = await res.json() as {
      instagram_handle: string
      sender_id:         string | null
      status:            AccessStatus
      source:            'username' | 'sender_id'
      notes:             string | null
      created_at:        string | null
      updated_at:        string | null
    }[]
    return rows.map(row => ({
      handle:    row.instagram_handle,
      senderId:  row.sender_id,
      status:    row.status,
      source:    row.source,
      notes:     row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  } catch (err) {
    console.error('[supabase/listAccessRules] fetch error:', err)
    return []
  }
}

export interface UpsertAccessRuleFields {
  handle:    string   // already normalized
  senderId?: string | null
  status:    AccessStatus
  notes?:    string
}

/**
 * Upsert a dm_access_rules row by instagram_handle.
 * senderId is only included in the write when known, so an existing
 * sender_id already on record is never clobbered back to null.
 * Throws if the table doesn't exist — callers should surface that as a
 * clear "run the migration first" error rather than silently failing.
 */
export async function upsertAccessRule(fields: UpsertAccessRuleFields): Promise<void> {
  const body: Record<string, string> = {
    instagram_handle: fields.handle,
    status:           fields.status,
    source:           fields.senderId ? 'sender_id' : 'username',
    updated_at:       new Date().toISOString(),
  }
  if (fields.senderId)          body.sender_id = fields.senderId
  if (fields.notes !== undefined) body.notes   = fields.notes

  const res = await fetch(`${base()}/rest/v1/dm_access_rules?on_conflict=instagram_handle`, {
    method:  'POST',
    headers: {
      ...headers(),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`upsertAccessRule failed: ${res.status} ${await res.text()}`)
  }
}

/**
 * Remove a dm_access_rules row by instagram_handle.
 * Returns the deleted row's sender_id (if any) so callers can also clean up
 * the dm_blocklist mirror, or null if no row existed.
 * Throws if the table doesn't exist.
 */
export async function removeAccessRule(handle: string): Promise<{ senderId: string | null } | null> {
  const res = await fetch(
    `${base()}/rest/v1/dm_access_rules?instagram_handle=eq.${encodeURIComponent(handle)}&select=sender_id`,
    {
      method:  'DELETE',
      headers: { ...headers(), Prefer: 'return=representation' },
    }
  )
  if (!res.ok) {
    throw new Error(`removeAccessRule failed: ${res.status} ${await res.text()}`)
  }
  const rows = await res.json() as { sender_id: string | null }[]
  return rows[0] ? { senderId: rows[0].sender_id } : null
}

// ── instagram_users lookup ─────────────────────────────────────

/**
 * Look up sender_id from instagram_users by username (normalized handle).
 * Returns null if not found or if Supabase is not configured.
 */
export async function lookupSenderIdByUsername(username: string): Promise<string | null> {
  const res = await fetch(
    `${base()}/rest/v1/instagram_users?username=eq.${encodeURIComponent(username)}&select=sender_id&limit=1`,
    { headers: headers(), cache: 'no-store' }
  )
  if (!res.ok) {
    console.error('[supabase/lookupSenderIdByUsername] query failed:', res.status, await res.text())
    return null
  }
  const rows = await res.json() as { sender_id: string }[]
  return rows[0]?.sender_id ?? null
}

// ── Consultation Admin Data ────────────────────────────────────

export interface ConsultationAdminData {
  leadQuality:            string | null
  bestOffer:              string | null
  assessmentReason:       string | null
  suggestedAction:        string | null
  responseType:           string | null
  pastedClaudeOutput:     string | null
  selectedFinalResponse:  string | null
  replyInput:             string | null
  replyIntent:            string | null
  pastedNextClaudeOutput: string | null
  nextResponse:           string | null
  internalNotes:          string | null
}

/**
 * Fetch admin data for a consultation lead by Notion page ID.
 * Returns null if Supabase not configured, table missing, or row not found.
 */
export async function getAdminData(pageId: string): Promise<ConsultationAdminData | null> {
  if (!supabaseConfigured()) return null
  try {
    const res = await fetch(
      `${base()}/rest/v1/consultation_admin_data?notion_page_id=eq.${encodeURIComponent(pageId)}&select=*&limit=1`,
      { headers: headers(), cache: 'no-store' }
    )
    if (!res.ok) {
      console.error('[supabase/getAdminData] query failed:', res.status, await res.text())
      return null
    }
    const rows = await res.json() as Array<Record<string, string | null>>
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      leadQuality:            r.lead_quality            ?? null,
      bestOffer:              r.best_offer              ?? null,
      assessmentReason:       r.assessment_reason       ?? null,
      suggestedAction:        r.suggested_action        ?? null,
      responseType:           r.response_type           ?? null,
      pastedClaudeOutput:     r.pasted_claude_output    ?? null,
      selectedFinalResponse:  r.selected_final_response ?? null,
      replyInput:             r.reply_input             ?? null,
      replyIntent:            r.reply_intent            ?? null,
      pastedNextClaudeOutput: r.pasted_next_claude_output ?? null,
      nextResponse:           r.next_response           ?? null,
      internalNotes:          r.internal_notes          ?? null,
    }
  } catch (err) {
    console.error('[supabase/getAdminData] fetch error:', err)
    return null
  }
}

/**
 * Upsert admin data for a consultation lead. Only provided keys are written.
 * Throws on failure; callers should catch and surface the error.
 */
export async function saveAdminData(
  pageId: string,
  fields: Partial<ConsultationAdminData>
): Promise<void> {
  const body: Record<string, string | null> = {
    notion_page_id: pageId,
    updated_at:     new Date().toISOString(),
  }
  if ('leadQuality' in fields)            body.lead_quality             = fields.leadQuality            ?? null
  if ('bestOffer' in fields)              body.best_offer               = fields.bestOffer              ?? null
  if ('assessmentReason' in fields)       body.assessment_reason        = fields.assessmentReason       ?? null
  if ('suggestedAction' in fields)        body.suggested_action         = fields.suggestedAction        ?? null
  if ('responseType' in fields)           body.response_type            = fields.responseType           ?? null
  if ('pastedClaudeOutput' in fields)     body.pasted_claude_output     = fields.pastedClaudeOutput     ?? null
  if ('selectedFinalResponse' in fields)  body.selected_final_response  = fields.selectedFinalResponse  ?? null
  if ('replyInput' in fields)             body.reply_input              = fields.replyInput             ?? null
  if ('replyIntent' in fields)            body.reply_intent             = fields.replyIntent            ?? null
  if ('pastedNextClaudeOutput' in fields) body.pasted_next_claude_output = fields.pastedNextClaudeOutput ?? null
  if ('nextResponse' in fields)           body.next_response            = fields.nextResponse           ?? null
  if ('internalNotes' in fields)          body.internal_notes           = fields.internalNotes          ?? null

  const res = await fetch(`${base()}/rest/v1/consultation_admin_data?on_conflict=notion_page_id`, {
    method:  'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`saveAdminData failed: ${res.status} ${await res.text()}`)
  }
}

/**
 * Upsert consultation_leads row for manual DM control.
 * Sets dm_mode; also sets sender_id if known.
 */
export async function upsertLeadDmMode(
  instagramHandle: string,
  dmMode:          string,
  senderId?:       string | null
): Promise<void> {
  const body: Record<string, string> = {
    instagram_handle: instagramHandle,
    dm_mode:          dmMode,
    updated_at:       new Date().toISOString(),
  }
  if (senderId) body.sender_id = senderId

  const res = await fetch(`${base()}/rest/v1/consultation_leads?on_conflict=instagram_handle`, {
    method:  'POST',
    headers: {
      ...headers(),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`upsertLeadDmMode failed: ${res.status} ${await res.text()}`)
  }
}
