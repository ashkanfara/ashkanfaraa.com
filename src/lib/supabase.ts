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
  paymentMessage:         string | null
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
      leadQuality:            r.lead_quality              ?? null,
      bestOffer:              r.best_offer                ?? null,
      assessmentReason:       r.assessment_reason         ?? null,
      suggestedAction:        r.suggested_action          ?? null,
      responseType:           r.response_type             ?? null,
      pastedClaudeOutput:     r.pasted_claude_output      ?? null,
      selectedFinalResponse:  r.selected_final_response   ?? null,
      replyInput:             r.reply_input               ?? null,
      replyIntent:            r.reply_intent              ?? null,
      pastedNextClaudeOutput: r.pasted_next_claude_output ?? null,
      nextResponse:           r.next_response             ?? null,
      internalNotes:          r.internal_notes            ?? null,
      paymentMessage:         r.payment_message           ?? null,
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
  if ('paymentMessage' in fields)         body.payment_message          = fields.paymentMessage         ?? null

  const res = await fetch(`${base()}/rest/v1/consultation_admin_data?on_conflict=notion_page_id`, {
    method:  'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`saveAdminData failed: ${res.status} ${await res.text()}`)
  }
}

// ── DM Inbox (instagram_dm_buffer) ───────────────────────────

export interface ConvHistoryRow {
  id:             string
  createdAt:      string
  messageText:    string | null
  messageType:    string
  isStoryReply:   boolean
  storyId:        string | null
  // sentText is set only when the reply was actually sent (response_sent=true).
  // Derived server-side: final_response_text ?? response_text when response_sent=true.
  // Never populated for PENDING_REVIEW / REJECTED / IGNORED / SUPERSEDED rows.
  sentText:       string | null
  responseSent:   boolean
  responseSentAt: string | null
  failedReason:   string | null
}

export interface StoryContext {
  mediaType:     string | null   // 'IMAGE' | 'VIDEO' | null
  mediaUrl:      string | null   // from story_context table (may be a short-lived Meta CDN URL)
  caption:       string | null
  aiDescription: string | null
  ocrText:       string | null
}

export interface SenderIdentity {
  displayName:       string | null   // from IG API: "name" field
  username:          string | null   // from IG API or stored
  profilePictureUrl: string | null   // public CDN URL — safe to pass to browser
}

export interface DmBufferRow {
  id:              string
  senderId:        string
  messageText:     string | null
  messageType:     string
  createdAt:       string
  isStoryReply:    boolean
  isStoryMention:  boolean
  storyId:         string | null
  storyUrl:        string | null
  responseText:    string | null   // original AI draft — immutable
  failedReason:    string | null
  responseSent:    boolean
  responseSentAt:  string | null
  finalResponseText: string | null
  // joined from instagram_users + optional IG API enrichment
  username:          string | null
  displayName:       string | null
  profilePictureUrl: string | null   // public profile pic URL; null if not yet enriched
  messageCount:      number | null
  notes:             string | null
  // joined from conversation_state
  conversationOwner:     string | null
  humanTakeoverReason:   string | null
  humanTakeoverUntil:    string | null
  // joined from story_context (only populated when isStoryReply=true and story_id matches a row)
  storyContext:    StoryContext | null
}

/**
 * DM send state machine
 * ─────────────────────
 * PENDING_REVIEW          — awaiting human review
 *   → (atomic claim)      → SENDING
 *
 * SENDING                 — claimed; Instagram call in progress
 *   → (IG 4xx definitive) → SEND_FAILED          (admin can retry — IG never sent)
 *   → (IG success + DB ok)→ SENT
 *   → (IG success+DB fail)→ SEND_STATUS_UNKNOWN   (NON-RESENDABLE; manual reconciliation)
 *   → (timeout/unknown)   → SEND_STATUS_UNKNOWN   (NON-RESENDABLE)
 *   → (window expired)    → EXPIRED
 *   → (blocked)           → REJECTED
 *
 * SEND_FAILED             — safe to retry (IG definitively rejected before sending)
 * SEND_STATUS_UNKNOWN     — NOT safe to retry; admin must check IG outbox manually
 * IG_SEND_ERROR           — legacy name for SEND_FAILED; treated identically
 *
 * SENT / REJECTED / EXPIRED / BLOCKED_SENDER — terminal, no further sends
 *
 * Required schema migration (run once in Supabase SQL editor):
 *   ALTER TABLE instagram_dm_buffer
 *     ADD COLUMN IF NOT EXISTS ig_message_id      TEXT,
 *     ADD COLUMN IF NOT EXISTS sending_started_at TIMESTAMPTZ;
 *
 * Until that migration runs:
 *   - ig_message_id will not be stored (ig_message_id column absent → omitted from PATCH)
 *   - sending_started_at will not be stored (ditto)
 */

const IG_GRAPH = 'https://graph.instagram.com/v25.0'

/**
 * Best-effort: fetch name + profile_pic from the Instagram Graph API for a batch of sender IDs
 * that have no display_name stored yet. Stores display_name + username back to instagram_users.
 * Also stores profile_picture_url if that column exists (requires ALTER TABLE — see docs).
 *
 * Silently no-ops when INSTAGRAM_ACCESS_TOKEN is absent (local / staging environments).
 * Never throws — enrichment failure must not break the inbox.
 */
async function enrichSenderIdentities(
  senderIds: string[]
): Promise<Record<string, SenderIdentity>> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token || senderIds.length === 0) return {}

  const result: Record<string, SenderIdentity> = {}
  const BATCH = 5  // stay well under IG rate limits

  for (let i = 0; i < senderIds.length; i += BATCH) {
    const batch = senderIds.slice(i, i + BATCH)
    await Promise.all(batch.map(async (sid) => {
      try {
        const res = await fetch(
          `${IG_GRAPH}/${encodeURIComponent(sid)}?fields=name,username,profile_pic` +
          `&access_token=${encodeURIComponent(token)}`,
          { signal: AbortSignal.timeout(6000), cache: 'no-store' }
        )
        if (!res.ok) {
          console.warn(`[supabase/enrich] IG API ${res.status} for sender ${sid}`)
          return
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await res.json() as Record<string, any>

        // Log field names (not values) on first successful response for field-name verification
        if (Object.keys(result).length === 0) {
          console.log('[supabase/enrich] IG API response fields:', Object.keys(data))
        }

        const displayName:       string | null = data.name ?? null
        const username:          string | null = data.username ?? null
        // IG Messaging API uses profile_pic; some scopes return profile_picture_url — try both
        const profilePictureUrl: string | null = data.profile_pic ?? data.profile_picture_url ?? null

        result[sid] = { displayName, username, profilePictureUrl }

        // Persist what we can — try with profile_picture_url first; if column absent, retry without
        const patch: Record<string, string | null> = {}
        if (displayName) patch.display_name = displayName
        if (username)    patch.username      = username
        if (profilePictureUrl) patch.profile_picture_url = profilePictureUrl

        if (Object.keys(patch).length === 0) return

        const patchRes = await fetch(
          `${base()}/rest/v1/instagram_users?sender_id=eq.${encodeURIComponent(sid)}`,
          {
            method:  'PATCH',
            headers: { ...headers(), Prefer: 'return=minimal' },
            body:    JSON.stringify(patch),
          }
        )

        // 400 may mean profile_picture_url column doesn't exist yet — retry without it
        if (!patchRes.ok && profilePictureUrl) {
          const patchWithout = { ...patch }
          delete patchWithout.profile_picture_url
          if (Object.keys(patchWithout).length > 0) {
            await fetch(
              `${base()}/rest/v1/instagram_users?sender_id=eq.${encodeURIComponent(sid)}`,
              {
                method:  'PATCH',
                headers: { ...headers(), Prefer: 'return=minimal' },
                body:    JSON.stringify(patchWithout),
              }
            ).catch(() => { /* ignore */ })
          }
        }
      } catch (err) {
        // Best-effort only — never propagate
        console.warn(`[supabase/enrich] failed for sender ${sid}:`, err)
      }
    }))
  }

  return result
}

/**
 * Fetch rows needing admin attention: PENDING_REVIEW, SEND_FAILED, IG_SEND_ERROR,
 * SEND_STATUS_UNKNOWN, and SENDING (for visibility — no action buttons shown for SENDING).
 * Also returns recent conversation history for each sender (last ≤30 rows per sender,
 * oldest-first) in a single batch query — no N+1.
 * Returns { items: [], history: {} } on error — never throws.
 */
export async function getDmInbox(): Promise<{
  items:   DmBufferRow[]
  history: Record<string, ConvHistoryRow[]>
}> {
  if (!supabaseConfigured()) return { items: [], history: {} }
  try {
    // Step 1: fetch inbox rows — only within the 24-hour Instagram messaging window.
    // Expired rows are excluded server-side; they remain in the DB but are not shown
    // in the operational inbox. Historical rows still surface as conversation context
    // inside getDmHistory() which has no window filter.
    // SENDING and SEND_STATUS_UNKNOWN are transient (30s timeout) and will always be
    // within the window in practice, so a single created_at cutoff covers all states.
    const windowCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const SELECT =
      `id,sender_id,message_text,message_type,created_at,is_story_reply,is_story_mention,` +
      `story_id,story_url,response_text,failed_reason,response_sent,response_sent_at,final_response_text`
    // Main query: rows with explicit actionable failed_reason values
    const mainRes = await fetch(
      `${base()}/rest/v1/instagram_dm_buffer` +
      `?failed_reason=in.(PENDING_REVIEW,SEND_FAILED,IG_SEND_ERROR,SEND_STATUS_UNKNOWN,SENDING,AI_RECOMMENDED_IGNORE,HUMAN_TEMP_SKIP,STORY_MENTION_HUMAN_HOLD)` +
      `&created_at=gt.${encodeURIComponent(windowCutoff)}` +
      `&select=${SELECT}` +
      `&order=created_at.asc`,
      { headers: headers(), cache: 'no-store' }
    )
    if (!mainRes.ok) {
      console.error('[supabase/getDmInbox] main query failed:', mainRes.status, await mainRes.text())
      return { items: [], history: {} }
    }
    // Secondary query: failed_reason=null AND processed=false — rows requeued for AI re-drafting.
    // These are shown as 'regenerating' cards so the admin never sees the card disappear mid-regeneration.
    // processed=true null rows are n8n "no reply needed" completions — excluded.
    const requeueRes = await fetch(
      `${base()}/rest/v1/instagram_dm_buffer` +
      `?failed_reason=is.null&processed=eq.false&response_sent=eq.false` +
      `&created_at=gt.${encodeURIComponent(windowCutoff)}` +
      `&select=${SELECT}` +
      `&order=created_at.asc`,
      { headers: headers(), cache: 'no-store' }
    )
    // Merge both result sets — requeue failures are non-fatal (log and continue with main only)
    const requeueRows: unknown[] = requeueRes.ok ? await requeueRes.json() : []
    if (!requeueRes.ok) {
      console.warn('[supabase/getDmInbox] requeue query failed:', requeueRes.status)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mainRows = await mainRes.json() as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = [
      ...mainRows,
      // Deduplicate: exclude requeue rows whose id already appears in main results
      ...(requeueRows as { id: string }[]).filter(r => !mainRows.some((m: { id: string }) => m.id === r.id)),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    if (rows.length === 0) return { items: [], history: {} }

    // Step 2: enrich with instagram_users + conversation_state for the collected sender_ids
    const senderIds = [...new Set(rows.map((r: { sender_id: string }) => r.sender_id))]
    const idList    = `(${senderIds.map(id => encodeURIComponent(id)).join(',')})`

    // Collect story_ids for story-reply rows (never use instagram_dm_buffer.story_url for display)
    const storyIds = [...new Set(
      rows
        .filter((r: { is_story_reply: boolean; story_id: string | null }) => r.is_story_reply && r.story_id)
        .map((r: { story_id: string }) => r.story_id)
    )]
    const storyIdList = storyIds.length > 0
      ? `(${storyIds.map(id => encodeURIComponent(id)).join(',')})`
      : null

    const [usersRes, stateRes, storyRes, histRes] = await Promise.all([
      fetch(
        `${base()}/rest/v1/instagram_users` +
        `?sender_id=in.${idList}` +
        `&select=sender_id,username,display_name,profile_picture_url,message_count,notes`,
        { headers: headers(), cache: 'no-store' }
      ),
      fetch(
        `${base()}/rest/v1/conversation_state` +
        `?sender_id=in.${idList}` +
        `&select=sender_id,conversation_owner,human_takeover_reason,human_takeover_until`,
        { headers: headers(), cache: 'no-store' }
      ),
      storyIdList
        ? fetch(
            `${base()}/rest/v1/story_context` +
            `?story_id=in.${storyIdList}` +
            `&select=story_id,media_type,media_url,caption,ai_description,ocr_text`,
            { headers: headers(), cache: 'no-store' }
          )
        : Promise.resolve(null),
      // Conversation history — single batch for all senders; no N+1
      fetch(
        `${base()}/rest/v1/instagram_dm_buffer` +
        `?sender_id=in.${idList}` +
        `&select=id,sender_id,created_at,message_text,message_type,is_story_reply,story_id,` +
        `response_text,final_response_text,response_sent,response_sent_at,failed_reason` +
        `&order=created_at.desc&limit=150`,
        { headers: headers(), cache: 'no-store' }
      ),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usersMap: Record<string, any> = {}
    if (usersRes.ok) {
      const users = await usersRes.json() as { sender_id: string }[]
      for (const u of users) usersMap[u.sender_id] = u
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateMap: Record<string, any> = {}
    if (stateRes.ok) {
      const states = await stateRes.json() as { sender_id: string }[]
      for (const s of states) stateMap[s.sender_id] = s
    }

    const storyMap: Record<string, StoryContext> = {}
    if (storyRes && storyRes.ok) {
      const stories = await storyRes.json() as {
        story_id: string; media_type: string | null; media_url: string | null
        caption: string | null; ai_description: string | null; ocr_text: string | null
      }[]
      for (const s of stories) {
        storyMap[s.story_id] = {
          mediaType:     s.media_type     ?? null,
          mediaUrl:      s.media_url      ?? null,
          caption:       s.caption        ?? null,
          aiDescription: s.ai_description ?? null,
          ocrText:       s.ocr_text       ?? null,
        }
      }
    }

    // Build conversation history map: sender_id → ConvHistoryRow[] oldest-first, ≤30 per sender
    const historyMap: Record<string, ConvHistoryRow[]> = {}
    if (histRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const histRows = await histRes.json() as any[]
      // histRows is desc-ordered (newest first). Group and take ≤30 per sender, then reverse.
      for (const r of histRows) {
        const sid: string = r.sender_id
        if (!historyMap[sid]) historyMap[sid] = []
        if (historyMap[sid].length < 30) {
          // Only show sentText when the reply was actually delivered.
          // Use || not ?? so that legacy empty-string final_response_text falls through to response_text.
          const sentText = r.response_sent
            ? (r.final_response_text || r.response_text || null)
            : null
          historyMap[sid].push({
            id:             r.id,
            createdAt:      r.created_at,
            messageText:    r.message_text   ?? null,
            messageType:    r.message_type,
            isStoryReply:   r.is_story_reply ?? false,
            storyId:        r.story_id       ?? null,
            sentText,
            responseSent:   r.response_sent  ?? false,
            responseSentAt: r.response_sent_at ?? null,
            failedReason:   r.failed_reason  ?? null,
          })
        }
      }
      // Reverse each group to oldest-first
      for (const sid of Object.keys(historyMap)) {
        historyMap[sid] = historyMap[sid].reverse()
      }
    }

    // Enrich identity if any field is still missing.
    // Staleness policy: skip if all three (display_name, username, profile_picture_url) are populated.
    // username is rarely returned by the IG Messaging API so we only require display_name + profile_picture_url
    // to consider a sender fully resolved.
    const needsEnrich = senderIds.filter(sid => {
      const u = usersMap[sid]
      const fullyResolved = u?.display_name && u?.profile_picture_url
      return !fullyResolved
    })
    const enriched = await enrichSenderIdentities(needsEnrich)

    const items: DmBufferRow[] = rows.map(r => ({
      id:              r.id,
      senderId:        r.sender_id,
      messageText:     r.message_text,
      messageType:     r.message_type,
      createdAt:       r.created_at,
      isStoryReply:    r.is_story_reply   ?? false,
      isStoryMention:  r.is_story_mention ?? false,
      storyId:         r.story_id         ?? null,
      storyUrl:        r.story_url        ?? null,
      responseText:    r.response_text    ?? null,
      failedReason:    r.failed_reason    ?? null,
      responseSent:    r.response_sent    ?? false,
      responseSentAt:  r.response_sent_at ?? null,
      finalResponseText: r.final_response_text ?? null,
      messageCount:    usersMap[r.sender_id]?.message_count ?? null,
      notes:           usersMap[r.sender_id]?.notes         ?? null,
      conversationOwner:   stateMap[r.sender_id]?.conversation_owner    ?? null,
      humanTakeoverReason: stateMap[r.sender_id]?.human_takeover_reason ?? null,
      humanTakeoverUntil:  stateMap[r.sender_id]?.human_takeover_until  ?? null,
      storyContext:        (r.is_story_reply && r.story_id && storyMap[r.story_id])
                             ? storyMap[r.story_id]
                             : null,
      // Identity: DB row takes precedence; fall back to fresh IG API enrichment for this request
      username:          usersMap[r.sender_id]?.username      ?? enriched[r.sender_id]?.username          ?? null,
      displayName:       usersMap[r.sender_id]?.display_name  ?? enriched[r.sender_id]?.displayName       ?? null,
      profilePictureUrl: usersMap[r.sender_id]?.profile_picture_url
                           ?? enriched[r.sender_id]?.profilePictureUrl
                           ?? null,
    }))
    return { items, history: historyMap }
  } catch (err) {
    console.error('[supabase/getDmInbox] fetch error:', err)
    return { items: [], history: {} }
  }
}

/**
 * Atomically claim a PENDING_REVIEW or AI_RECOMMENDED_IGNORE row for sending.
 *
 * The claim PATCH also persists final_response_text immediately so that
 * if the server dies between claim and markDmSent, the intended text is
 * recorded and the item transitions to SEND_STATUS_UNKNOWN (not silently lost).
 *
 * Returns { senderId, createdAt, responseText } or null if already handled.
 * Uses conditional PATCH: only updates if failed_reason is PENDING_REVIEW or AI_RECOMMENDED_IGNORE.
 * AI_RECOMMENDED_IGNORE items can be sent via "Write Reply" in the admin UI.
 *
 */
export async function claimDmForSend(id: string, finalText: string): Promise<{
  senderId: string; createdAt: string; responseText: string | null
} | null> {
  const patchBody: Record<string, string | null> = {
    failed_reason:       'SENDING',
    final_response_text: finalText,
    sending_started_at:  new Date().toISOString(),
  }
  const res = await fetch(
    `${base()}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(id)}&failed_reason=in.(PENDING_REVIEW,AI_RECOMMENDED_IGNORE)` +
    `&select=sender_id,created_at,response_text`,
    {
      method:  'PATCH',
      headers: { ...headers(), Prefer: 'return=representation' },
      body:    JSON.stringify(patchBody),
    }
  )
  if (!res.ok) {
    console.error('[supabase/claimDmForSend] PATCH failed:', res.status, await res.text())
    return null
  }
  const rows = await res.json() as { sender_id: string; created_at: string; response_text: string | null }[]
  if (rows.length === 0) return null
  return { senderId: rows[0].sender_id, createdAt: rows[0].created_at, responseText: rows[0].response_text }
}

/**
 * Mark a row SENT after confirmed Instagram success.
 * Preserves response_text (original AI draft) — only writes final_response_text.
 *
 * Returns true on DB success, false on failure.
 * If this returns false after Instagram already sent the message, the caller
 * must transition to SEND_STATUS_UNKNOWN — NOT resend.
 */
export async function markDmSent(id: string, finalText: string, messageId: string | null): Promise<boolean> {
  const res = await fetch(
    `${base()}/rest/v1/instagram_dm_buffer?id=eq.${encodeURIComponent(id)}`,
    {
      method:  'PATCH',
      headers: headers(),
      body:    JSON.stringify({
        failed_reason:       'SENT',
        response_sent:       true,
        response_sent_at:    new Date().toISOString(),
        final_response_text: finalText,
        ig_message_id:       messageId ?? null,
      }),
    }
  )
  if (!res.ok) {
    console.error('[supabase/markDmSent] PATCH failed:', res.status, await res.text())
    return false
  }
  return true
}

/**
 * Mark a row SEND_FAILED: Instagram definitively rejected the request (4xx error
 * returned before acceptance). The message was NOT sent. The admin can retry safely.
 */
export async function markDmSendFailed(id: string): Promise<void> {
  await fetch(
    `${base()}/rest/v1/instagram_dm_buffer?id=eq.${encodeURIComponent(id)}`,
    { method: 'PATCH', headers: headers(), body: JSON.stringify({ failed_reason: 'SEND_FAILED', processing: false }) }
  )
}

/**
 * Mark a row SEND_STATUS_UNKNOWN: Instagram call outcome is uncertain.
 *
 * This state means "we don't know if the message was sent."
 * Causes: IG succeeded but markDmSent DB write failed; network timeout; unexpected error.
 *
 * This state is NON-RESENDABLE. The admin must manually check their Instagram outbox
 * and resolve via Supabase before any further action. There is no automated recovery.
 */
export async function markDmStatusUnknown(id: string): Promise<void> {
  await fetch(
    `${base()}/rest/v1/instagram_dm_buffer?id=eq.${encodeURIComponent(id)}`,
    { method: 'PATCH', headers: headers(), body: JSON.stringify({ failed_reason: 'SEND_STATUS_UNKNOWN', processing: false }) }
  )
}

/**
 * Ignore an unsent review item — human decided no response is needed.
 * Allowed from: PENDING_REVIEW, SEND_FAILED, IG_SEND_ERROR, AI_RECOMMENDED_IGNORE (all definitively unsent).
 * Blocked for: SENDING (in-flight), SEND_STATUS_UNKNOWN (outcome uncertain), SENT, REJECTED.
 * Does NOT block the sender; future inbound messages remain eligible for AI drafting.
 * Returns { ignored: true } when the row was transitioned.
 * Returns { ignored: false, reason } when the row was ineligible or not found.
 */
export async function ignoreDm(id: string): Promise<{ ignored: boolean; reason?: string }> {
  const res = await fetch(
    `${base()}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&failed_reason=in.(PENDING_REVIEW,SEND_FAILED,IG_SEND_ERROR,AI_RECOMMENDED_IGNORE)` +
    `&select=id`,
    {
      method:  'PATCH',
      headers: { ...headers(), Prefer: 'return=representation' },
      body:    JSON.stringify({ failed_reason: 'IGNORED_BY_HUMAN', processed: true, processing: false }),
    }
  )
  if (!res.ok) return { ignored: false, reason: 'supabase_error' }
  const rows = await res.json() as { id: string }[]
  if (rows.length === 0) return { ignored: false, reason: 'not_eligible' }
  return { ignored: true }
}

/** Reject a PENDING_REVIEW draft. Idempotent. Used by n8n for blocked-sender flows. */
export async function rejectDm(id: string): Promise<boolean> {
  const res = await fetch(
    `${base()}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(id)}&failed_reason=eq.PENDING_REVIEW` +
    `&select=id`,
    {
      method:  'PATCH',
      headers: { ...headers(), Prefer: 'return=representation' },
      body:    JSON.stringify({ failed_reason: 'REJECTED' }),
    }
  )
  if (!res.ok) return false
  const rows = await res.json() as { id: string }[]
  return rows.length > 0
}

/**
 * Reset a SEND_FAILED item back to PENDING_REVIEW so the admin can retry.
 *
 * ONLY allowed from: SEND_FAILED, IG_SEND_ERROR (legacy name for SEND_FAILED).
 * These states mean Instagram definitively rejected — the message was NOT sent.
 *
 * NEVER allowed from: SENDING, SEND_STATUS_UNKNOWN.
 * Those states have uncertain send outcomes. Resetting them could cause duplicate sends.
 * Items in those states require manual reconciliation against the Instagram outbox.
 *
 * original response_text (AI draft) is preserved; final_response_text is cleared so the
 * admin sees the draft again and must re-approve — no automatic resend.
 */
export async function retryDmSendFailed(id: string): Promise<boolean> {
  const res = await fetch(
    `${base()}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(id)}&failed_reason=in.(SEND_FAILED,IG_SEND_ERROR)` +
    `&select=id`,
    {
      method:  'PATCH',
      headers: { ...headers(), Prefer: 'return=representation' },
      body:    JSON.stringify({
        failed_reason:       'PENDING_REVIEW',
        processing:          false,
        final_response_text: null,
      }),
    }
  )
  if (!res.ok) return false
  const rows = await res.json() as { id: string }[]
  return rows.length > 0
}

/**
 * Re-queue a PENDING_REVIEW row for AI re-drafting.
 *
 * Sets failed_reason=null + processed=false so n8n's polling workflow picks it up.
 * Does NOT clear response_text — the existing draft is preserved until n8n overwrites
 * it with a fresh one. This means if n8n fails or times out, the old draft is still
 * available; the admin sees the old draft in the 'regenerating' card and can cancel.
 *
 * Only matches rows that are currently PENDING_REVIEW (atomic guard: prevents
 * double-requeue and guards against requeuing an already-sent or in-flight row).
 */
export async function requeueDm(id: string): Promise<boolean> {
  const res = await fetch(
    `${base()}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(id)}&failed_reason=eq.PENDING_REVIEW` +
    `&select=id`,
    {
      method:  'PATCH',
      headers: { ...headers(), Prefer: 'return=representation' },
      // response_text intentionally NOT cleared: old draft preserved until n8n overwrites it.
      // If n8n never picks this up (timeout), admin can cancel and the old draft is still there.
      body:    JSON.stringify({ processed: false, processing: false, failed_reason: null }),
    }
  )
  if (!res.ok) return false
  const rows = await res.json() as { id: string }[]
  return rows.length > 0
}

/**
 * Cancel a regeneration request — restore a regenerating row (failed_reason=null, processed=false)
 * back to PENDING_REVIEW without touching response_text.
 * Old draft is preserved; admin can review it and decide whether to send, edit, or ignore.
 */
export async function cancelRegenDm(id: string): Promise<boolean> {
  const res = await fetch(
    `${base()}/rest/v1/instagram_dm_buffer` +
    `?id=eq.${encodeURIComponent(id)}&failed_reason=is.null&processed=eq.false` +
    `&select=id`,
    {
      method:  'PATCH',
      headers: { ...headers(), Prefer: 'return=representation' },
      body:    JSON.stringify({ failed_reason: 'PENDING_REVIEW', processed: true, processing: false }),
    }
  )
  if (!res.ok) return false
  const rows = await res.json() as { id: string }[]
  return rows.length > 0
}

/** Set conversation_state.conversation_owner = 'human_temp' for a sender. */
export async function takeoverConversation(senderId: string, reason?: string): Promise<void> {
  await fetch(`${base()}/rest/v1/conversation_state?on_conflict=sender_id`, {
    method:  'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify({
      sender_id:             senderId,
      conversation_owner:    'human_temp',
      human_takeover_reason: reason || 'manual',
      human_takeover_until:  null,
      updated_at:            new Date().toISOString(),
    }),
  })
}

/** Set conversation_state.conversation_owner = 'ai' for a sender. */
export async function releaseToAi(senderId: string): Promise<void> {
  await fetch(`${base()}/rest/v1/conversation_state?on_conflict=sender_id`, {
    method:  'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify({
      sender_id:             senderId,
      conversation_owner:    'ai',
      human_takeover_reason: null,
      human_takeover_until:  null,
      updated_at:            new Date().toISOString(),
    }),
  })
}

/**
 * Block a sender: add to dm_blocklist + invalidate any pending draft.
 */
export async function blockDmSender(senderId: string, displayName: string, notes?: string): Promise<void> {
  // 1. Add to blocklist
  await fetch(`${base()}/rest/v1/dm_blocklist?on_conflict=sender_id`, {
    method:  'POST',
    headers: { ...headers(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body:    JSON.stringify({ sender_id: senderId, name: displayName, notes: notes || null, created_at: new Date().toISOString() }),
  })
  // 2. Invalidate pending draft
  await fetch(
    `${base()}/rest/v1/instagram_dm_buffer?sender_id=eq.${encodeURIComponent(senderId)}&failed_reason=eq.PENDING_REVIEW`,
    { method: 'PATCH', headers: headers(), body: JSON.stringify({ failed_reason: 'REJECTED' }) }
  )
  // 3. Mark unprocessed queued messages
  await fetch(
    `${base()}/rest/v1/instagram_dm_buffer?sender_id=eq.${encodeURIComponent(senderId)}&processed=eq.false`,
    { method: 'PATCH', headers: headers(), body: JSON.stringify({ failed_reason: 'BLOCKED_SENDER', processed: true }) }
  )
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
