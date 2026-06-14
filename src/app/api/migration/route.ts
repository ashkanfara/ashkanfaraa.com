/**
 * POST /api/migration
 *
 * Migration lead qualification handler.
 * Stores submissions in Notion: "Migration Leads" database.
 *
 * Required env var:
 *   NOTION_TOKEN
 *   NOTION_MIGRATION_DB_ID
 */

import { NextRequest, NextResponse } from 'next/server'

const NOTION_API     = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function notionHeaders() {
  return {
    Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
    'Content-Type':   'application/json',
    'Notion-Version': NOTION_VERSION,
  }
}

function rt(text: string) {
  return [{ text: { content: (text || '').slice(0, 2000) } }]
}

function generateLeadId(): string {
  return 'AF-' + Math.random().toString(36).slice(2, 7).toUpperCase()
}

export async function POST(req: NextRequest) {
  console.log('[migration] Route hit')

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    console.error('[migration] Invalid JSON body')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // ── Honeypot check ──────────────────────────────────────────
  if (body.website) {
    console.warn('[migration] Honeypot triggered — bot submission discarded')
    return NextResponse.json({ ok: true, leadId: 'AF-00000' })
  }

  // ── Required field validation ───────────────────────────────
  const required: Record<string, string> = {
    name:        'Full name is required',
    email:       'Email is required',
    mobile:      'Mobile number is required',
    country:     'Current country is required',
    destination: 'Destination is required',
    pathway:     'Pathway is required',
    budget:      'Budget is required',
    consent:     'Consent is required',
  }

  for (const [field, message] of Object.entries(required)) {
    const val = body[field]
    if (!val || val.trim() === '' || val === 'false') {
      console.warn('[migration] Missing required field:', field)
      return NextResponse.json({ error: message }, { status: 422 })
    }
  }

  // ── Basic email format check ────────────────────────────────
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 422 })
  }

  // ── Env check ───────────────────────────────────────────────
  const token = process.env.NOTION_TOKEN
  const dbId  = process.env.NOTION_MIGRATION_DB_ID

  console.log('[migration] Env check — NOTION_TOKEN:', !!token, '| NOTION_MIGRATION_DB_ID:', !!dbId)

  if (!token || !dbId) {
    console.error('[migration] MISSING ENV VAR:', !token ? 'NOTION_TOKEN' : 'NOTION_MIGRATION_DB_ID')
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
  }

  const leadId = generateLeadId()

  console.log('[migration] Saving lead:', leadId, '|', body.name, '|', body.email, '| dest:', body.destination, '| budget:', body.budget)

  // ── Write to Notion ─────────────────────────────────────────
  try {
    const res = await fetch(`${NOTION_API}/pages`, {
      method:  'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties: {
          'Lead ID':         { title: rt(leadId) },
          'Full Name':       { rich_text: rt(body.name) },
          'Email':           { email: body.email.trim() },
          'Mobile':          { rich_text: rt(body.mobile) },
          'WhatsApp':        { rich_text: rt(body.whatsapp  || '') },
          'Telegram':        { rich_text: rt(body.telegram  || '') },
          'Current Country': { rich_text: rt(body.country) },
          'Destination':     { select: { name: body.destination } },
          'Pathway':         { select: { name: body.pathway } },
          'Age Range':       body.ageRange   ? { select: { name: body.ageRange } }   : undefined,
          'English Level':   body.english    ? { select: { name: body.english } }    : undefined,
          'Education':       body.education  ? { select: { name: body.education } }  : undefined,
          'Occupation':      { rich_text: rt(body.occupation || '') },
          'Budget':          { select: { name: body.budget } },
          'Why Migrate':     { rich_text: rt(body.whyMigrate || '') },
          'Notes':           { rich_text: rt(body.notes || '') },
          'Language':        { select: { name: body.language || 'FA' } },
          'Source':          { rich_text: rt(body.source      || '') },
          'UTM Source':      { rich_text: rt(body.utmSource   || '') },
          'UTM Medium':      { rich_text: rt(body.utmMedium   || '') },
          'UTM Campaign':    { rich_text: rt(body.utmCampaign || '') },
          'Referrer':        { rich_text: rt(body.referrer    || '') },
          'Consent':         { checkbox: body.consent === 'true' },
          'Status':          { select: { name: 'New' } },
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[migration] Notion API error:', res.status, errText)
      return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 })
    }

    const page = await res.json()
    console.log('[migration] ✓ Lead saved. Notion page ID:', page.id, '| Lead ID:', leadId)

    return NextResponse.json({ ok: true, leadId })

  } catch (err) {
    console.error('[migration] Unexpected error:', err)
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 })
  }
}
