/**
 * GET  /api/admin/dm-inbox/contact-notes?senderId=X&igAccountId=Y
 *   Returns { ok, notes: string } — empty string if none saved yet.
 *
 * PUT  /api/admin/dm-inbox/contact-notes
 *   Body: { senderId, igAccountId?, notes }
 *   Upserts notes for the contact. Empty string is a valid save (not a delete).
 *
 * DELETE /api/admin/dm-inbox/contact-notes
 *   Body: { senderId, igAccountId? }
 *   Clears notes (sets to null / empty).
 *
 * Notes are stored in dm_contact_notes (ig_account_id, sender_id).
 * Service role only — RLS fail-closed for anon.
 * Admin session required for all verbs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession, validateSameOrigin } from '@/lib/adminSession'

const BASE    = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const HEADERS = () => ({
  apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
  'Content-Type': 'application/json',
  Prefer:         'resolution=merge-duplicates,return=minimal',
})

function unauthorized() { return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) }

export async function GET(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()

  const senderId    = req.nextUrl.searchParams.get('senderId')?.trim()
  const igAccountId = req.nextUrl.searchParams.get('igAccountId')?.trim() || 'default'
  if (!senderId) return NextResponse.json({ ok: false, error: 'senderId required' }, { status: 422 })

  const res = await fetch(
    `${BASE()}/rest/v1/dm_contact_notes` +
    `?sender_id=eq.${encodeURIComponent(senderId)}` +
    `&ig_account_id=eq.${encodeURIComponent(igAccountId)}` +
    `&select=notes&limit=1`,
    { headers: { ...HEADERS(), Prefer: '' } }
  )
  if (!res.ok) return NextResponse.json({ ok: true, notes: '' })
  const rows = await res.json() as { notes: string }[]
  return NextResponse.json({ ok: true, notes: rows[0]?.notes ?? '' })
}

export async function PUT(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()
  if (!validateSameOrigin(req)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const senderId    = typeof body.senderId    === 'string' ? body.senderId.trim()    : ''
  const igAccountId = typeof body.igAccountId === 'string' ? body.igAccountId.trim() : 'default'
  const notes       = typeof body.notes       === 'string' ? body.notes              : ''

  if (!senderId) return NextResponse.json({ ok: false, error: 'senderId required' }, { status: 422 })
  if (notes.length > 2000) return NextResponse.json({ ok: false, error: 'Notes too long (max 2000 chars)' }, { status: 422 })

  const res = await fetch(
    `${BASE()}/rest/v1/dm_contact_notes`,
    {
      method:  'POST',
      headers: HEADERS(),
      body: JSON.stringify({
        sender_id:     senderId,
        ig_account_id: igAccountId,
        notes,
        updated_at:    new Date().toISOString(),
      }),
    }
  )
  if (!res.ok) {
    const text = await res.text()
    console.error('[contact-notes PUT]', res.status, text)
    return NextResponse.json({ ok: false, error: 'Save failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()
  if (!validateSameOrigin(req)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const senderId    = typeof body.senderId    === 'string' ? body.senderId.trim()    : ''
  const igAccountId = typeof body.igAccountId === 'string' ? body.igAccountId.trim() : 'default'

  if (!senderId) return NextResponse.json({ ok: false, error: 'senderId required' }, { status: 422 })

  const res = await fetch(
    `${BASE()}/rest/v1/dm_contact_notes` +
    `?sender_id=eq.${encodeURIComponent(senderId)}` +
    `&ig_account_id=eq.${encodeURIComponent(igAccountId)}`,
    { method: 'DELETE', headers: { ...HEADERS(), Prefer: '' } }
  )
  if (!res.ok) {
    console.error('[contact-notes DELETE]', res.status)
    return NextResponse.json({ ok: false, error: 'Clear failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
