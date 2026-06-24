/**
 * POST /api/admin/consultation/dm-mode
 *
 * Upserts a consultation_leads row in Supabase and sets dm_mode.
 * Protected by Authorization: Bearer ADMIN_SECRET.
 * Supabase service key is server-only — never sent to client.
 *
 * Body: {
 *   instagramHandle  string   raw value from Notion (will be normalized)
 *   dmMode           string   AI | Hybrid | Human
 *   pageId           string   Notion page ID
 *   name?            string
 *   email?           string
 *   phone?           string
 *   location?        string
 *   status?          string   current Notion status
 * }
 */

import { NextRequest, NextResponse }          from 'next/server'
import { upsertDmMode, normalizeHandle, supabaseConfigured } from '@/lib/supabase'

const VALID_MODES = new Set(['AI', 'Hybrid', 'Human'])

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase is not configured on this server.' },
      { status: 503 }
    )
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { instagramHandle, dmMode, pageId, name, email, phone, location, status } = body

  if (!instagramHandle?.trim()) {
    return NextResponse.json({ error: 'instagramHandle is required' }, { status: 422 })
  }

  if (!VALID_MODES.has(dmMode)) {
    return NextResponse.json(
      { error: `Invalid dmMode. Allowed: ${[...VALID_MODES].join(', ')}` },
      { status: 422 }
    )
  }

  const handle = normalizeHandle(instagramHandle)

  try {
    await upsertDmMode({
      instagramHandle:     handle,
      dmMode,
      notionPageId:        pageId       || undefined,
      name:                name         || undefined,
      email:               email        || undefined,
      phone:               phone        || undefined,
      location:            location     || undefined,
      consultationStatus:  status       || undefined,
    })
  } catch (err) {
    console.error('[dm-mode] Supabase upsert failed:', err)
    return NextResponse.json({ error: 'Failed to update dm_mode in Supabase' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, dmMode })
}
