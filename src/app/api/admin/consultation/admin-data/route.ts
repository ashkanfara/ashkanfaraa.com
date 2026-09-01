/**
 * GET  /api/admin/consultation/admin-data?pageId=xxx
 * POST /api/admin/consultation/admin-data
 *
 * Reads and writes consultation_admin_data rows (AI closing assistant state).
 * No Anthropic API involved — pure storage for manually-crafted responses.
 * Protected by HttpOnly session cookie (admin_session)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminData, saveAdminData } from '@/lib/supabase'
import { requireAdminSession, unauthorized, validateSameOrigin } from '@/lib/adminSession'

const KNOWN_FIELDS = [
  'leadQuality', 'bestOffer', 'assessmentReason', 'suggestedAction',
  'responseType', 'pastedClaudeOutput', 'selectedFinalResponse',
  'replyInput', 'replyIntent', 'pastedNextClaudeOutput', 'nextResponse',
  'internalNotes', 'paymentMessage',
] as const

export async function GET(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()

  const pageId = req.nextUrl.searchParams.get('pageId')
  if (!pageId) {
    return NextResponse.json({ error: 'Missing pageId' }, { status: 422 })
  }

  try {
    const data = await getAdminData(pageId)
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[admin/admin-data GET]', err)
    return NextResponse.json({ data: null })
  }
}

export async function POST(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()
  if (!validateSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const pageId = typeof body.pageId === 'string' ? body.pageId : undefined
  if (!pageId) {
    return NextResponse.json({ error: 'Missing pageId' }, { status: 422 })
  }

  const fields: Record<string, string | null> = {}
  for (const key of KNOWN_FIELDS) {
    if (key in body) {
      fields[key] = typeof body[key] === 'string' ? (body[key] as string) : null
    }
  }

  try {
    await saveAdminData(pageId, fields)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/admin-data POST]', err)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
