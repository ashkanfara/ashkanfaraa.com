import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────
// TODO: Connect your storage here.
//
// Options:
//   Google Sheets  → use googleapis or @googleapis/sheets
//   Airtable       → use airtable npm package
//   Notion DB      → use @notionhq/client
//   Email          → use Resend (resend.com) or nodemailer
//
// Required env vars go in .env.local (never commit them).
// Example for Google Sheets:
//   GOOGLE_SHEETS_ID=your_sheet_id
//   GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
// ─────────────────────────────────────────────────────────

export interface ConsultationSubmission {
  name: string
  instagram: string
  email: string
  subject: string
  message: string
  submittedAt: string
}

export async function POST(req: NextRequest) {
  let body: Partial<ConsultationSubmission>

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Basic validation
  const { name, email, subject, message } = body
  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
  }

  const submission: ConsultationSubmission = {
    name:        body.name!.trim(),
    instagram:   body.instagram?.trim() ?? '',
    email:       body.email!.trim(),
    subject:     body.subject!.trim(),
    message:     body.message!.trim(),
    submittedAt: new Date().toISOString(),
  }

  // ── Storage integration point ─────────────────────────
  // Replace this block with your actual storage call.
  // e.g. await appendToGoogleSheet(submission)
  //      await createAirtableRecord(submission)
  //      await sendConfirmationEmail(submission)
  console.log('[consultation] new submission:', submission)
  // ─────────────────────────────────────────────────────

  return NextResponse.json({ ok: true }, { status: 200 })
}
