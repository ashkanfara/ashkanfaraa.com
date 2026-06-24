/**
 * Notion helpers for the FA Consultation database.
 * All functions are server-side only.
 *
 * Required env vars:
 *   NOTION_TOKEN
 *   NOTION_FA_CONSULTATION_DB_ID
 */

const NOTION_API     = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function dbId(): string {
  const id = process.env.NOTION_FA_CONSULTATION_DB_ID
  if (!id) throw new Error('NOTION_FA_CONSULTATION_DB_ID is not set')
  return id
}

function headers(): Record<string, string> {
  const token = process.env.NOTION_TOKEN
  if (!token) throw new Error('NOTION_TOKEN is not set')
  return {
    Authorization:    `Bearer ${token}`,
    'Content-Type':   'application/json',
    'Notion-Version': NOTION_VERSION,
  }
}

function rt(text: string) {
  return [{ text: { content: (text ?? '').slice(0, 2000) } }]
}

// ── Type ─────────────────────────────────────────────────────
export interface ConsultationRecord {
  pageId:           string
  name:             string
  email:            string
  instagram:        string
  phone:            string
  location:         string
  subject:          string
  message:          string
  submittedAt:      string
  status:           string
  paymentToken:     string
  tokenExpiry:      string | null
  approvedPrice:    number | null
  approvedCurrency: string
  paymentMethod:    string
  paymentStatus:    string
  paymentClaim:     string
  consCode:         string
}

// ── Parsers ───────────────────────────────────────────────────
type NotionProp = Record<string, unknown>

function titleVal(p: NotionProp | undefined): string {
  if (!p) return ''
  return ((p['title'] as { plain_text: string }[]) ?? [])[0]?.plain_text ?? ''
}

function text(p: NotionProp | undefined): string {
  if (!p) return ''
  return ((p['rich_text'] as { plain_text: string }[]) ?? [])[0]?.plain_text ?? ''
}

function emailVal(p: NotionProp | undefined): string {
  if (!p) return ''
  return (p['email'] as string) ?? ''
}

function selectVal(p: NotionProp | undefined): string {
  if (!p) return ''
  return (p['select'] as { name: string } | null)?.name ?? ''
}

function num(p: NotionProp | undefined): number | null {
  if (!p) return null
  const n = p['number']
  return typeof n === 'number' ? n : null
}

function date(p: NotionProp | undefined): string | null {
  if (!p) return null
  const d = p['date'] as { start: string } | null
  return d?.start ?? null
}

function parsePage(page: Record<string, unknown>): ConsultationRecord {
  const props = page['properties'] as Record<string, NotionProp>
  return {
    pageId:           page['id'] as string,
    name:             titleVal(props['Full Name']),
    email:            emailVal(props['Email']),
    instagram:        text(props['Instagram']),
    phone:            text(props['Phone']),
    location:         text(props['Location']),
    subject:          text(props['Decision']),
    message:          text(props['Message']),
    submittedAt:      page['created_time'] as string,
    status:           selectVal(props['Status']),
    paymentToken:     text(props['Payment Token']),
    tokenExpiry:      date(props['Token Expiry']),
    approvedPrice:    num(props['Approved Price']),
    approvedCurrency: selectVal(props['Approved Currency']),
    paymentMethod:    selectVal(props['Payment Method']),
    paymentStatus:    selectVal(props['Payment Status']),
    paymentClaim:     text(props['Payment Claim']),
    consCode:         text(props['CONS Code']),
  }
}

// ── Queries ───────────────────────────────────────────────────
async function query(
  filter: unknown,
  sorts?: { timestamp?: string; property?: string; direction: string }[]
): Promise<ConsultationRecord[]> {
  const body: Record<string, unknown> = { filter, page_size: 50 }
  if (sorts) body.sorts = sorts
  const res = await fetch(`${NOTION_API}/databases/${dbId()}/query`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(body),
    cache:   'no-store',
  })
  if (!res.ok) throw new Error(`Notion query failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return (data.results as Record<string, unknown>[]).map(parsePage)
}

const SORT_NEWEST = [{ timestamp: 'created_time', direction: 'descending' }]

export async function getNewApplications(): Promise<ConsultationRecord[]> {
  return query({ property: 'Status', select: { equals: 'New' } }, SORT_NEWEST)
}

export async function getUnderReviewApplications(): Promise<ConsultationRecord[]> {
  return query({ property: 'Status', select: { equals: 'Under Review' } }, SORT_NEWEST)
}

export async function getApprovedApplications(): Promise<ConsultationRecord[]> {
  // Status=Approved + PaymentStatus=Pending (link sent, not yet claimed)
  return query({
    and: [
      { property: 'Status',         select: { equals: 'Approved' } },
      { property: 'Payment Status', select: { equals: 'Pending'  } },
    ],
  })
}

export async function getClaimedApplications(): Promise<ConsultationRecord[]> {
  return query({ property: 'Payment Status', select: { equals: 'Claimed' } })
}

export async function getPaidApplications(): Promise<ConsultationRecord[]> {
  return query({ property: 'Status', select: { equals: 'Paid' } }, SORT_NEWEST)
}

export async function getApplicationByToken(token: string): Promise<ConsultationRecord | null> {
  const results = await query({ property: 'Payment Token', rich_text: { equals: token } })
  return results[0] ?? null
}

// ── Mutations ──────────────────────────────────────────────────
export async function updateStatus(pageId: string, status: string): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method:  'PATCH',
    headers: headers(),
    body:    JSON.stringify({ properties: { 'Status': { select: { name: status } } } }),
  })
  if (!res.ok) throw new Error(`Notion status update failed: ${res.status} ${await res.text()}`)
}

export async function approveApplication(
  pageId: string,
  fields: {
    paymentToken:     string
    tokenExpiry:      string
    approvedPrice:    number
    approvedCurrency: string
    paymentMethod:    string
    region:           string
  }
): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method:  'PATCH',
    headers: headers(),
    body: JSON.stringify({
      properties: {
        'Status':            { select: { name: 'Approved' } },
        'Payment Token':     { rich_text: rt(fields.paymentToken) },
        'Token Expiry':      { date: { start: fields.tokenExpiry } },
        'Approved Price':    { number: fields.approvedPrice },
        'Approved Currency': { select: { name: fields.approvedCurrency } },
        'Payment Method':    { select: { name: fields.paymentMethod } },
        'Payment Status':    { select: { name: 'Pending' } },
        'Region':            { select: { name: fields.region } },
      },
    }),
  })
  if (!res.ok) throw new Error(`Notion approve failed: ${res.status} ${await res.text()}`)
}

export async function recordPaymentClaim(pageId: string, claimText: string): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method:  'PATCH',
    headers: headers(),
    body: JSON.stringify({
      properties: {
        'Payment Status': { select: { name: 'Claimed' } },
        'Payment Claim':  { rich_text: rt(claimText) },
      },
    }),
  })
  if (!res.ok) throw new Error(`Notion claim failed: ${res.status} ${await res.text()}`)
}

export async function confirmPayment(pageId: string, consCode: string): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method:  'PATCH',
    headers: headers(),
    body: JSON.stringify({
      properties: {
        'CONS Code':      { rich_text: rt(consCode) },
        'Payment Status': { select: { name: 'Confirmed' } },
        'Status':         { select: { name: 'Paid' } },
      },
    }),
  })
  if (!res.ok) throw new Error(`Notion confirm failed: ${res.status} ${await res.text()}`)
}
