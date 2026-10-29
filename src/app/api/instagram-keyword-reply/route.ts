import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { handleKeywordEvent, keywordCapabilities } from '@/lib/dm-keyword-fastpath'
import type { KeywordEvent } from '@/lib/dm-keyword-contract'

// Existing n8n Supabase service-role bearer credential; no new key or env variable.
function authorized(request: NextRequest) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  const header = request.headers.get('authorization') || ''
  if (!secret || !header.startsWith('Bearer ')) return false
  const provided = Buffer.from(header.slice(7)); const expected = Buffer.from(secret)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let event: KeywordEvent
  try { event = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!event || typeof event !== 'object') return NextResponse.json({ error: 'Invalid event' }, { status: 422 })
  const result = await handleKeywordEvent(event)
  return NextResponse.json(result, { status: 'retryable' in result && result.retryable ? 503 : 200 })
}

/** Authenticated read-only capability check: own account and conversation metadata only. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return NextResponse.json(await keywordCapabilities()) }
  catch (error) {
    const category = error instanceof Error && /^instagram_(?:http_\d+_code_\d+_subcode_\d+|[a-z_]+)$/.test(error.message)
      ? error.message : 'instagram_read_capability_unavailable'
    return NextResponse.json({ configured: false, reason: category }, { status: 503 })
  }
}
