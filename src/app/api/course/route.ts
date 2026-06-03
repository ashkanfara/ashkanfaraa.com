import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────
// TODO: Connect storage.
// Same integration point as /api/consultation.
// Options: Google Sheets, Airtable, Notion, email via Resend.
// ─────────────────────────────────────────────────────────

export interface CourseSubmission {
  name: string
  instagram: string
  telegram: string
  email: string
  location: string
  destination: string
  submittedAt: string
}

export async function POST(req: NextRequest) {
  let body: Partial<CourseSubmission>

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, email, location, destination } = body
  if (!name?.trim() || !email?.trim() || !location?.trim() || !destination?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
  }

  const submission: CourseSubmission = {
    name:        body.name!.trim(),
    instagram:   body.instagram?.trim() ?? '',
    telegram:    body.telegram?.trim()  ?? '',
    email:       body.email!.trim(),
    location:    body.location!.trim(),
    destination: body.destination!.trim(),
    submittedAt: new Date().toISOString(),
  }

  console.log('[course] new submission:', submission)

  return NextResponse.json({ ok: true }, { status: 200 })
}
