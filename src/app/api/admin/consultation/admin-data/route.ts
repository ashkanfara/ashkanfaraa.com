/**
 * GET  /api/admin/consultation/admin-data?pageId=xxx
 * POST /api/admin/consultation/admin-data
 *
 * Reads and writes consultation_admin_data rows (AI closing assistant state).
 * No Anthropic API involved — pure storage for manually-crafted responses.
 * Protected by Authorization: Bearer ADMIN_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminData, saveAdminData } from '@/lib/supabase'

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const KNOWN_FIELDS = [
  'leadQuality', 'bestOffer', 'assessmentReason', 'suggestedAction',
  'responseType', 'pastedClaudeOutput', 'selectedFinalResponse',
  'replyInput', 'replyIntent', 'pastedNextClaudeOutput', 'nextResponse',
  'internalNotes',
] as const

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
