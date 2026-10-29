import { createHash } from 'crypto'
import { classifyDmKeyword, containsKeywordLink, KEYWORD_REPLIES, type KeywordEvent, type KeywordRoute } from './dm-keyword-contract'
import { sendViaEngine } from './dm-send-engine'
import { saveDmFeedback } from './supabase'

const GRAPH = 'https://graph.instagram.com/v25.0'
const DAY = 24 * 60 * 60 * 1000
const SOURCE = 'KEYWORD_FASTPATH_v1'
type Row = Record<string, unknown>

class KeywordGuardError extends Error {
  constructor(readonly category: string) { super(category) }
}

function databaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || !process.env.SUPABASE_URL) throw new KeywordGuardError('database_not_configured')
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'count=exact' }
}

async function database(path: string, init: RequestInit = {}, page?: { total?: number }): Promise<Row[]> {
  const headers = new Headers(databaseHeaders())
  new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  const response = await fetch(`${process.env.SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new KeywordGuardError('database_read_or_claim_failed')
  if (page) {
    const total = response.headers.get('content-range')?.split('/')[1]
    if (total && total !== '*' && Number.isFinite(Number(total))) page.total = Number(total)
  }
  if (response.status === 204) return []
  const rows = await response.json()
  if (!Array.isArray(rows)) throw new KeywordGuardError('invalid_database_response')
  return rows
}

async function graph(path: string): Promise<Row> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) throw new KeywordGuardError('instagram_not_configured')
  const response = await fetch(`${GRAPH}/${path}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000),
  })
  const value = await response.json()
  if (!response.ok) {
    const error = value?.error || {}
    // Only numeric protocol evidence; never echo Graph messages or request URLs.
    throw new KeywordGuardError(`instagram_http_${response.status}_code_${Number(error.code) || 0}_subcode_${Number(error.error_subcode) || 0}`)
  }
  if (!value || typeof value !== 'object' || value.error) throw new KeywordGuardError('invalid_instagram_history')
  return value
}

async function accountIdentity() {
  const profile = await graph('me?fields=id,user_id')
  const ids = new Set([profile.id, profile.user_id].filter(v => typeof v === 'string' && /^\d+$/.test(v)))
  if (!ids.size) throw new KeywordGuardError('instagram_identity_unavailable')
  return { ids, id: String(profile.user_id || profile.id) }
}

function reservationId(account: string, sender: string, route: KeywordRoute) {
  // One durable row per account/contact/link. UUID PK uniqueness serializes aliases,
  // separate inbound events, retries and concurrent invocations without new tables.
  const hex = createHash('sha256').update(JSON.stringify([SOURCE, account, sender, route])).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

async function accessCheck(sender: string) {
  const id = encodeURIComponent(sender)
  const [blocked, rules, state, users, leads] = await Promise.all([
    database(`dm_blocklist?sender_id=eq.${id}&select=sender_id&limit=1`),
    database(`dm_access_rules?sender_id=eq.${id}&or=(status.neq.ai_allowed,status.is.null)&select=status&limit=1`),
    database(`conversation_state?sender_id=eq.${id}&select=conversation_owner,human_takeover_until&limit=1`),
    database(`instagram_users?sender_id=eq.${id}&select=username,status,consultation_link_sent,course_link_sent&limit=1`),
    database(`consultation_leads?sender_id=eq.${id}&dm_mode=ilike.human&select=dm_mode&limit=1`),
  ])
  if (blocked.length) return { denied: 'blocked', users }
  if (rules.some(r => r.status !== 'ai_allowed')) return { denied: 'access_restricted', users }
  const owner = state[0]?.conversation_owner
  if (owner && owner !== 'ai') return { denied: 'human_takeover', users }
  if (leads.some(r => String(r.dm_mode).toLowerCase() === 'human')) return { denied: 'human_takeover', users }
  if (users.some(r => ['blocked', 'human_only', 'human'].includes(String(r.status).toLowerCase()))) return { denied: 'access_restricted', users }

  let username = typeof users[0]?.username === 'string' ? users[0].username : ''
  if (!username) {
    const profile = await graph(`${id}?fields=username`)
    username = typeof profile.username === 'string' ? profile.username : ''
  }
  if (!username) throw new KeywordGuardError('sender_identity_unavailable')
  const handle = encodeURIComponent(username.replace(/^@/, '').trim().toLowerCase())
  const [handleRules, handleLeads] = await Promise.all([
    database(`dm_access_rules?instagram_handle=eq.${handle}&or=(status.neq.ai_allowed,status.is.null)&select=status&limit=1`),
    database(`consultation_leads?instagram_handle=eq.${handle}&dm_mode=ilike.human&select=dm_mode&limit=1`),
  ])
  if (handleRules.some(r => r.status !== 'ai_allowed') || handleLeads.some(r => String(r.dm_mode).toLowerCase() === 'human')) return { denied: 'access_restricted', users }
  return { denied: null, users }
}

async function localSendGuard(sender: string, route: KeywordRoute, ownId?: string) {
  const id = encodeURIComponent(sender)
  let offset = 0
  for (let page = 0; page < 10; page++) {
    const count: { total?: number } = {}
    const rows = await database(`instagram_dm_buffer?sender_id=eq.${id}` +
      '&or=(response_sent.eq.true,processing.eq.true,failed_reason.eq.SENDING,failed_reason.eq.SEND_STATUS_UNKNOWN)' +
      '&select=id,response_sent,processing,failed_reason,final_response_text,response_text&order=created_at.desc,id.desc' +
      `&limit=200&offset=${offset}`, {}, count)
    for (const row of rows) {
      if (row.id === ownId) continue
      if (row.processing) return 'worker_inflight'
      if (['SENDING', 'SEND_STATUS_UNKNOWN'].includes(String(row.failed_reason))) return 'send_inflight_or_unknown'
      if (row.response_sent && containsKeywordLink(String(row.final_response_text || row.response_text || ''), route)) return 'link_already_sent'
    }
    offset += rows.length
    if (!rows.length || (count.total !== undefined && offset >= count.total)) return null
  }
  throw new KeywordGuardError('local_history_budget_exhausted')
}

async function verifiedConversation(event: KeywordEvent, accountIds: Set<unknown>, route: KeywordRoute) {
  const list = await graph(`me/conversations?user_id=${encodeURIComponent(event.sender_id)}&fields=id&limit=2`)
  if (!Array.isArray(list.data) || list.data.length !== 1) throw new KeywordGuardError('inbound_not_yet_verified')
  const conversationId = (list.data[0] as Row).id
  if (typeof conversationId !== 'string') throw new KeywordGuardError('invalid_instagram_history')
  let after = ''; let eventFound = false; let alreadySent = false; let newerReply = false; let newerInbound = false
  const since = Date.now() - DAY
  for (let page = 0; page < 20; page++) {
    const result = await graph(`${encodeURIComponent(conversationId)}/messages?fields=id,message,from,created_time&limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`)
    if (!Array.isArray(result.data)) throw new KeywordGuardError('invalid_instagram_history')
    for (const value of result.data) {
      const message = value as Row; const from = (message.from || {}) as Row
      const timestamp = Date.parse(String(message.created_time))
      if (!Number.isFinite(timestamp)) throw new KeywordGuardError('invalid_instagram_timestamp')
      if (String(from.id) === event.sender_id) {
        if (message.id === event.inbound_message_id && classifyDmKeyword(message.message) === route && Math.abs(timestamp - event.inbound_ts) < 5000 && timestamp > since) eventFound = true
        // Graph can round timestamps to seconds. A different message in the same
        // second is ambiguous, so do not race a possible correction/stop message.
        if (message.id !== event.inbound_message_id && timestamp >= Math.floor(event.inbound_ts / 1000) * 1000) newerInbound = true
      } else if (accountIds.has(String(from.id))) {
        if (containsKeywordLink(String(message.message || ''), route)) alreadySent = true
        if (timestamp >= Math.floor(event.inbound_ts / 1000) * 1000) newerReply = true
      }
    }
    const paging = (result.paging || {}) as Row
    if (!paging.next) return { eventFound, alreadySent, newerReply, newerInbound }
    const cursor = ((paging.cursors || {}) as Row).after
    if (typeof cursor !== 'string' || !cursor || cursor === after) throw new KeywordGuardError('instagram_pagination_incomplete')
    after = cursor
  }
  throw new KeywordGuardError('instagram_history_budget_exhausted')
}

export async function keywordCapabilities() {
  const account = await accountIdentity()
  const response = await graph('me/conversations?user_id=000000000000000&fields=id&limit=1')
  return { accountVerified: Boolean(account.id), syntheticConversationLookupSupported: Array.isArray(response.data) && response.data.length === 0 }
}

async function supersedeOlderDrafts(event: KeywordEvent, ownId: string) {
  const through = encodeURIComponent(new Date(event.inbound_ts).toISOString())
  const common = `instagram_dm_buffer?sender_id=eq.${encodeURIComponent(event.sender_id)}` +
    `&id=neq.${ownId}&response_sent=eq.false&created_at=lte.${through}`
  const body = JSON.stringify({ failed_reason: 'SUPERSEDED', processed: true, processing: false, generation_id: null })
  // Conditional writes race safely with the existing callback/admin claims. Sent,
  // sending, unknown and newer inbound rows are never overwritten. History stays.
  await Promise.all([
    database(`${common}&failed_reason=in.(PENDING_REVIEW,DRAFT_FAILED,DRAFT_GENERATING,AI_RECOMMENDED_IGNORE)`, { method: 'PATCH', body }),
    database(`${common}&failed_reason=is.null&processed=eq.false`, { method: 'PATCH', body }),
  ])
}

export async function handleKeywordEvent(event: KeywordEvent) {
  const route = classifyDmKeyword(event.text)
  if (!route) return { handled: false, reason: 'not_keyword' }
  const stop = (reason: string) => ({ handled: true, route, reason, sent: false })
  if (event.ig_account_id !== 'default' || typeof event.sender_id !== 'string' || !/^\d{5,30}$/.test(event.sender_id) || typeof event.inbound_message_id !== 'string' || !event.inbound_message_id || event.inbound_message_id.length > 512) return stop('invalid_event')
  if (!Number.isFinite(event.inbound_ts) || Date.now() - event.inbound_ts >= DAY || event.inbound_ts > Date.now() + 120000) return stop('outside_inbound_window')
  try {
    const account = await accountIdentity()
    if (!account.ids.has(event.recipient_id) || !account.ids.has(event.entry_id) || account.ids.has(event.sender_id)) return stop('account_mismatch')
    const access = await accessCheck(event.sender_id)
    if (access.denied) return stop(access.denied)
    if (access.users[0]?.[route === 'consultation' ? 'consultation_link_sent' : 'course_link_sent'] === true) return stop('link_already_sent')
    const existing = await localSendGuard(event.sender_id, route)
    if (existing) return stop(existing)
    const conversation = await verifiedConversation(event, account.ids, route)
    if (!conversation.eventFound) throw new KeywordGuardError('inbound_not_yet_verified')
    if (conversation.alreadySent) return stop('meta_link_already_sent')
    if (conversation.newerReply || conversation.newerInbound) return stop('newer_conversation_activity')

    const id = reservationId(account.id, event.sender_id, route)
    const text = KEYWORD_REPLIES[route]
    const startedAt = new Date().toISOString()
    const claimed = await database('instagram_dm_buffer?on_conflict=id&select=id', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ id, sender_id: event.sender_id, message_text: event.text, message_type: 'text',
        created_at: new Date(event.inbound_ts).toISOString(), processed: true, processing: false,
        retry_count: 0, admin_regen: false, response_sent: false, failed_reason: 'SENDING',
        response_text: text, final_response_text: text, draft_source: SOURCE, sending_started_at: startedAt }),
    })
    if (!claimed.length) return stop('duplicate_or_prior_attempt')
    await supersedeOlderDrafts(event, id)
    // Re-check contact controls immediately before the only outbound intent.
    const finalAccess = await accessCheck(event.sender_id)
    const concurrent = await localSendGuard(event.sender_id, route, id)
    const newer = await database(`instagram_dm_buffer?sender_id=eq.${encodeURIComponent(event.sender_id)}` +
      `&id=neq.${id}&created_at=gt.${encodeURIComponent(new Date(event.inbound_ts).toISOString())}&select=id&limit=1`)
    if (finalAccess.denied || concurrent || newer.length) {
      await database(`instagram_dm_buffer?id=eq.${id}&failed_reason=eq.SENDING`, {
        method: 'PATCH', body: JSON.stringify({ failed_reason: 'KEYWORD_GUARD_SUPPRESSED' }),
      })
      return stop(finalAccess.denied || concurrent || 'newer_conversation_activity')
    }
    const result = await sendViaEngine({ dmId: id, senderId: event.sender_id, finalText: text, sendingStartedAt: startedAt })
    if (result.outcome === 'sent') {
      // Canonical confirmed outgoing history, using the same helper as existing sends.
      await saveDmFeedback({ bufferId: id, senderId: event.sender_id, inboundContext: event.text,
        originalDraft: text, finalSentResponse: text, draftSource: SOURCE, wasEdited: false,
        feedbackRating: null, feedbackCategory: null, feedbackNote: null,
        igMessageId: result.igMessageId || null, igHttpStatus: result.igHttpStatus || null,
        approvalTs: startedAt, sendAttemptTs: startedAt, sendState: 'SENT', isFirstReply: false }).catch(() => {})
    }
    return { handled: true, route, sent: result.outcome === 'sent', reason: result.outcome }
  } catch (error) {
    // No raw Graph/database error, request URL, token or customer content is logged.
    const reason = error instanceof KeywordGuardError ? error.category : 'keyword_dependency_unavailable'
    return { handled: true, route, sent: false, reason, retryable: true }
  }
}
