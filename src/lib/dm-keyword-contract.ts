/** Exact, preapproved inbound keywords. Never match arbitrary numbers in prose. */
export type KeywordRoute = 'consultation' | 'course'

export function normalizeDmKeyword(text: string): string {
  return text.normalize('NFKC')
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660))
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[\u200c\u200d\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .trim().replace(/^[«»"'“”‘’!?؟،.,؛;:]+|[«»"'“”‘’!?؟،.,؛;:]+$/g, '')
    .replace(/\s+/g, '').toLowerCase()
}

const CONSULTATION = new Set(['101', '110', '011', 'صدویک', 'صدوده', 'یکصفریک', 'یکیکصفر', 'صفریکیک', 'صفریازده'])
const COURSE = new Set(['تلهها'])

export function classifyDmKeyword(value: unknown): KeywordRoute | null {
  if (typeof value !== 'string' || value.length > 100) return null
  const text = normalizeDmKeyword(value)
  return CONSULTATION.has(text) ? 'consultation' : COURSE.has(text) ? 'course' : null
}

export const KEYWORD_REPLIES: Record<KeywordRoute, string> = {
  // Approved Meta private reply, confirmed by the business owner's Oct 29 audit.
  consultation: 'این پاسخ خودکاره. اطلاعات جلسهٔ خصوصی تصمیم‌گیری و فرم درخواست اینجاست:\nhttps://www.ashkanfaraa.com/consultation\nپس از بررسی درخواست، در صورت تناسب، جزئیات جلسه برات ارسال می‌شه.',
  // Existing approved DM prompt wording and existing Persian course destination.
  course: 'فکر میکنم دوره تله‌های پنهان مهاجرت برات مفید باشه.\nhttps://www.ashkanfaraa.com/course',
}

export function containsKeywordLink(text: string, route: KeywordRoute): boolean {
  const path = route === 'consultation' ? 'consultation' : 'course'
  return new RegExp(`https?://(?:www\\.)?ashkanfaraa\\.com/(?:en/)?${path}(?:[/?#\\s]|$)`, 'i').test(text)
}

export interface KeywordEvent {
  sender_id: string
  recipient_id: string
  entry_id: string
  inbound_message_id: string
  inbound_ts: number
  text: string
  ig_account_id: 'default'
}

/** Shared source is emitted verbatim into n8n; the webhook body is never trusted as a send receipt. */
export function extractKeywordEvent(body: unknown): KeywordEvent | null {
  const data = body as { object?: string; entry?: { id?: unknown; messaging?: {
    sender?: { id?: unknown }; recipient?: { id?: unknown }; timestamp?: unknown;
    message?: { text?: unknown; mid?: unknown; is_echo?: boolean; attachments?: unknown[]; reply_to?: { story?: unknown } }
  }[] }[] }
  if (!data || data.object !== 'instagram') return null
  const entry = data.entry?.[0]
  const event = entry?.messaging?.[0]
  const message = event?.message
  if (!message || message.is_echo || message.attachments?.length || message.reply_to?.story || !classifyDmKeyword(message.text)) return null
  return {
    sender_id: String(event?.sender?.id || ''), recipient_id: String(event?.recipient?.id || ''),
    entry_id: String(entry?.id || ''), inbound_message_id: String(message.mid || ''),
    inbound_ts: Number(event?.timestamp), text: String(message.text), ig_account_id: 'default',
  }
}

/** Split recognized keywords out of a Meta batch; preserve the old payload when none match. */
export function partitionKeywordWebhook(body: unknown): { body: unknown; keyword_event?: KeywordEvent }[] {
  const data = body as { object?: string; entry?: { messaging?: unknown[] }[] }
  if (data?.object !== 'instagram' || !Array.isArray(data.entry)) return [{ body }]
  const keywords: { body: unknown; keyword_event: KeywordEvent }[] = []
  const remaining = data.entry.map(entry => {
    if (!Array.isArray(entry.messaging)) return entry
    const messaging = entry.messaging.filter(event => {
      const single = { ...data, entry: [{ ...entry, messaging: [event] }] }
      const keyword = extractKeywordEvent(single)
      if (!keyword) return true
      keywords.push({ body: single, keyword_event: keyword })
      return false
    })
    return { ...entry, messaging }
  })
  if (!keywords.length) return [{ body }]
  const entries = remaining.filter(entry => !Array.isArray(entry.messaging) || entry.messaging.length > 0)
  return [...keywords, ...(entries.length ? [{ body: { ...data, entry: entries } }] : [])]
}
