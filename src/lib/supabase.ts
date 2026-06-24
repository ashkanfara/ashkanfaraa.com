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
