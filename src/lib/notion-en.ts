/**
 * Notion API helpers — English site only.
 * Writes to two databases: Course Purchases and Consultation Applications.
 * All functions run server-side only. Never import from client components.
 *
 * Required env vars:
 *   NOTION_TOKEN
 *   NOTION_COURSE_DB_ID
 *   NOTION_CONSULTATION_DB_ID
 */

const NOTION_API     = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function headers() {
  return {
    Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
    'Content-Type':   'application/json',
    'Notion-Version': NOTION_VERSION,
  }
}

function richText(content: string) {
  return [{ text: { content: content || '' } }]
}

// ── Course Purchases ──────────────────────────────────────────

export async function createCoursePurchase(data: {
  name:      string
  email:     string
  instagram: string
  telegram:  string
  mobile:    string
}): Promise<string> {
  const res = await fetch(`${NOTION_API}/pages`, {
    method:  'POST',
    headers: headers(),
    body: JSON.stringify({
      parent: { database_id: process.env.NOTION_COURSE_DB_ID! },
      properties: {
        Name:              { title: richText(data.name) },
        Email:             { email: data.email || null },
        Instagram:         { rich_text: richText(data.instagram) },
        Telegram:          { rich_text: richText(data.telegram) },
        Mobile:            { phone_number: data.mobile || null },
        Provider:          { select: { name: 'PayPal' } },
        'Provider Order ID': { rich_text: richText('') },
        Amount:            { rich_text: richText('99.00') },
        Currency:          { rich_text: richText('USD') },
        Status:            { select: { name: 'pending' } },
      },
    }),
  })
  if (!res.ok) throw new Error(`Notion createCoursePurchase: ${await res.text()}`)
  const page = await res.json()
  return page.id as string
}

// ── Consultation Applications ─────────────────────────────────

export async function createConsultationApp(data: {
  name:      string
  instagram: string
  email:     string
  reason:    string
}): Promise<string> {
  const res = await fetch(`${NOTION_API}/pages`, {
    method:  'POST',
    headers: headers(),
    body: JSON.stringify({
      parent: { database_id: process.env.NOTION_CONSULTATION_DB_ID! },
      properties: {
        Name:              { title: richText(data.name) },
        Email:             { email: data.email || null },
        Instagram:         { rich_text: richText(data.instagram) },
        Reason:            { rich_text: richText(data.reason) },
        'Provider Order ID': { rich_text: richText('') },
        Amount:            { rich_text: richText('450.00') },
        Currency:          { rich_text: richText('AUD') },
        Status:            { select: { name: 'pending' } },
      },
    }),
  })
  if (!res.ok) throw new Error(`Notion createConsultationApp: ${await res.text()}`)
  const page = await res.json()
  return page.id as string
}

// ── Shared: mark a page as paid ───────────────────────────────

export async function markPagePaid(pageId: string, orderId: string): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method:  'PATCH',
    headers: headers(),
    body: JSON.stringify({
      properties: {
        Status:              { select: { name: 'paid' } },
        'Provider Order ID': { rich_text: richText(orderId) },
      },
    }),
  })
  if (!res.ok) throw new Error(`Notion markPagePaid: ${await res.text()}`)
}
