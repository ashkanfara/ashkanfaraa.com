/**
 * POST /api/consultation
 *
 * Persian consultation application handler — Phase 1 (application save).
 * Saves the application to Notion immediately so the lead is captured even
 * if the user abandons at the payment step.
 *
 * Returns { ok, notionPageId } so the client can pass the page ID to the
 * payment-confirm route, which updates the same record with proof + CONS code.
 *
 * Required env var:
 *   NOTION_TOKEN
 *   NOTION_FA_CONSULTATION_DB_ID
 *
 * Fields saved:
 *   Full Name, Email, Instagram, Phone, Location,
 *   Decision (subject), Message, Source=FA, Status=Payment Pending
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
  return [{ text: { content: text || '' } }]
}

export interface ConsultationSubmission {
  name:      string
  instagram: string
  phone:     string
  location:  string
  email:     string
  subject:   string
  message:   string
}

export async function POST(req: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────
  let body: Partial<ConsultationSubmission>
  try {
    body = await req.json()
  } catch {
    console.error('[FA consultation] Invalid JSON body')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, email, location, subject, message } = body

  // ── Validate required fields ────────────────────────────────
  if (!name?.trim() || !email?.trim() || !location?.trim() || !subject?.trim() || !message?.trim()) {
    console.warn('[FA consultation] Missing required fields:', {
      name: !!name, email: !!email, location: !!location, subject: !!subject, message: !!message,
    })
    return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
  }

  const submission: ConsultationSubmission = {
    name:      body.name!.trim(),
    instagram: body.instagram?.trim() ?? '',
    phone:     body.phone?.trim()     ?? '',
    location:  body.location!.trim(),
    email:     body.email!.trim(),
    subject:   body.subject!.trim(),
    message:   body.message!.trim(),
  }

  console.log('[FA consultation] New submission received:', {
    name:      submission.name,
    email:     submission.email,
    instagram: submission.instagram || '—',
    location:  submission.location,
    subject:   submission.subject,
  })

  // ── Save to Notion ──────────────────────────────────────────
  const dbId = process.env.NOTION_FA_CONSULTATION_DB_ID
  const token = process.env.NOTION_TOKEN

  if (!token) {
    console.error('[FA consultation] MISSING ENV VAR: NOTION_TOKEN is not set in Vercel. Submission lost.')
    console.error('[FA consultation] Submission data (not saved):', JSON.stringify(submission, null, 2))
    return NextResponse.json({ ok: true }, { status: 200 })
  }
  if (!dbId) {
    console.error('[FA consultation] MISSING ENV VAR: NOTION_FA_CONSULTATION_DB_ID is not set in Vercel. Submission lost.')
    console.error('[FA consultation] Submission data (not saved):', JSON.stringify(submission, null, 2))
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  try {
    const res = await fetch(`${NOTION_API}/pages`, {
      method:  'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties: {
          'Full Name': { title: rt(submission.name) },
          'Email':     { email: submission.email },
          'Instagram': { rich_text: rt(submission.instagram) },
          'Phone':     { rich_text: rt(submission.phone) },
          'Location':  { rich_text: rt(submission.location) },
          'Decision':  { rich_text: rt(submission.subject) },
          'Message':   { rich_text: rt(submission.message) },
          'Source':    { select: { name: 'FA' } },
          'Status':    { select: { name: 'Payment Pending' } },
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[FA consultation] Notion API error:', res.status, errText)
      console.error('[FA consultation] Submission data (not saved to Notion):', JSON.stringify(submission, null, 2))
      // Return ok without notionPageId — client falls back to manual flow
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const page = await res.json()
    console.log('[FA consultation] ✓ Saved to Notion. Page ID:', page.id, '| Name:', submission.name, '| Email:', submission.email)
    return NextResponse.json({ ok: true, notionPageId: page.id }, { status: 200 })

  } catch (err) {
    console.error('[FA consultation] Unexpected error saving to Notion:', err)
    console.error('[FA consultation] Submission data (not saved):', JSON.stringify(submission, null, 2))
    // Return ok — do not fail the user experience over a backend error
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
