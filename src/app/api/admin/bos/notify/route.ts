/**
 * POST /api/admin/bos/notify
 *
 * Called by the BOS Callback n8n workflow after a Routine completes.
 * Updates bos_state timestamps only — never stores counts (counts are always
 * computed from bos_tasks queries to prevent drift).
 *
 * Authentication: BOS_CALLBACK_SECRET header (separate from admin session).
 * This endpoint is called by n8n, not by the browser.
 */
import { NextRequest, NextResponse } from 'next/server'
import { updateBosState } from '@/lib/bos'

export async function POST(req: NextRequest) {
  const secret = process.env.BOS_CALLBACK_SECRET
  if (!secret) {
    console.error('[bos/notify] BOS_CALLBACK_SECRET not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  const auth = req.headers.get('x-bos-secret')
  if (auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, string> = {}
  try {
    body = await req.json() as Record<string, string>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: { last_dispatch_at?: string; last_ceo_run_at?: string; system_status?: string } = {}
  if (body.event === 'dispatch')      updates.last_dispatch_at = new Date().toISOString()
  if (body.event === 'ceo_complete')  updates.last_ceo_run_at  = new Date().toISOString()
  if (body.system_status)             updates.system_status     = body.system_status

  await updateBosState(updates)
  return NextResponse.json({ ok: true })
}
