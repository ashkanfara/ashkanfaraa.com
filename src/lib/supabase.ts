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

/**
 * Fetch dm_mode for a list of instagram handles in one query.
 * Returns a Map<normalizedHandle, dmMode>.
 * Returns an empty Map if Supabase is not configured or query fails.
 */
export async function getDmModes(handles: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!supabaseConfigured() || handles.length === 0) return map

  const list = handles.map(h => `"${h}"`).join(',')
  try {
    const res = await fetch(
      `${base()}/rest/v1/consultation_leads?instagram_handle=in.(${list})&select=instagram_handle,dm_mode`,
      { headers: headers(), cache: 'no-store' }
    )
    if (!res.ok) {
      console.error('[supabase/getDmModes] query failed:', res.status, await res.text())
      return map
    }
    const rows = await res.json() as { instagram_handle: string; dm_mode: string }[]
    for (const row of rows) map.set(row.instagram_handle, row.dm_mode)
  } catch (err) {
    console.error('[supabase/getDmModes] fetch error:', err)
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
