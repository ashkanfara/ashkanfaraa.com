/**
 * GET /api/cron/reset-stale-drafts
 *
 * Vercel Cron Job — runs every 5 minutes.
 * Resets any DRAFT_GENERATING rows older than 30 minutes to DRAFT_FAILED.
 *
 * This is a durable safeguard independent of n8n's scheduler.
 * Even if n8n stops scheduling, stuck drafts will eventually recover.
 *
 * Security: Vercel injects Authorization: Bearer <CRON_SECRET> automatically.
 * Only callable from Vercel's cron infrastructure.
 */

import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_BASE    = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_HEADERS = () => ({
  apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
  'Content-Type': 'application/json',
})

const STALE_THRESHOLD_MINUTES = 30

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Vercel automatically validates CRON_SECRET — reject if missing
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })
  }

  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString()

  // Find stale DRAFT_GENERATING rows
  const findRes = await fetch(
    `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer` +
    `?failed_reason=eq.DRAFT_GENERATING&response_sent=eq.false` +
    `&processing_started_at=lt.${encodeURIComponent(cutoff)}` +
    `&select=id,sender_id,generation_id,processing_started_at&limit=50`,
    { headers: SUPABASE_HEADERS() }
  )

  if (!findRes.ok) {
    const body = await findRes.text()
    console.error('[reset-stale-drafts] Failed to query stale rows:', findRes.status, body)
    return NextResponse.json({ ok: false, error: 'DB query failed' }, { status: 502 })
  }

  const staleRows = await findRes.json() as { id: string; sender_id: string; generation_id: string | null; processing_started_at: string }[]

  if (staleRows.length === 0) {
    return NextResponse.json({ ok: true, reset: 0, message: 'No stale rows' })
  }

  // Reset each stale row to DRAFT_FAILED, guarded by generation_id match
  let resetCount = 0
  const errors: string[] = []

  for (const row of staleRows) {
    const where = row.generation_id
      ? `?id=eq.${encodeURIComponent(row.id)}&generation_id=eq.${encodeURIComponent(row.generation_id)}&failed_reason=eq.DRAFT_GENERATING`
      : `?id=eq.${encodeURIComponent(row.id)}&failed_reason=eq.DRAFT_GENERATING`

    const patchRes = await fetch(
      `${SUPABASE_BASE()}/rest/v1/instagram_dm_buffer${where}`,
      {
        method:  'PATCH',
        headers: { ...SUPABASE_HEADERS(), Prefer: 'return=representation' },
        body:    JSON.stringify({
          failed_reason: 'DRAFT_FAILED',
          processing:    false,
          // generation_id and processing_started_at preserved for audit trail
        }),
      }
    )

    if (patchRes.ok) {
      const patched = await patchRes.json() as unknown[]
      if (patched.length > 0) {
        resetCount++
        console.log(`[reset-stale-drafts] Reset stale row ${row.id.slice(0, 8)} (gen=${row.generation_id?.slice(0, 8)}, started=${row.processing_started_at})`)
      }
    } else {
      errors.push(`${row.id.slice(0, 8)}: ${patchRes.status}`)
    }
  }

  console.log(`[reset-stale-drafts] Done — reset=${resetCount}/${staleRows.length} stale rows`)
  return NextResponse.json({
    ok:      errors.length === 0,
    reset:   resetCount,
    found:   staleRows.length,
    errors:  errors.length > 0 ? errors : undefined,
  })
}
