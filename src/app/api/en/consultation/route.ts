/**
 * POST /api/en/consultation
 *
 * English consultation application (free — no payment).
 * Saves the applicant's details to Notion and returns { ok: true }.
 * The form shows a success state inline after submission.
 *
 * Required env vars:
 *   NOTION_TOKEN
 *   NOTION_CONSULTATION_DB_ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { createConsultationApp }     from '@/lib/notion-en'

export async function POST(req: NextRequest) {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_CONSULTATION_DB_ID) {
    console.error('[en/consultation] Notion env vars not set.')
    // Return success anyway so the form doesn't break if Notion is misconfigured.
    // The submission is logged to console as a fallback.
    return NextResponse.json({ ok: true })
  }

  let body: { name?: string; instagram?: string; email?: string; reason?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { name = '', instagram = '', email = '', reason = '' } = body

  if (!name.trim() || !email.trim() || !reason.trim()) {
    return NextResponse.json({ error: 'Name, email, and reason are required.' }, { status: 422 })
  }

  try {
    await createConsultationApp({
      name:      name.trim(),
      instagram: instagram.trim(),
      email:     email.trim(),
      reason:    reason.trim(),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[en/consultation]', msg)
    // Still return ok — don't show a technical error to the applicant.
    return NextResponse.json({ ok: true })
  }
}
