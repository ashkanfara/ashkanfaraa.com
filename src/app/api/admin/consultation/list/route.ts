/**
 * GET /api/admin/consultation/list
 *
 * Returns all five dashboard sections plus dm_mode per record from Supabase.
 * Supabase enrichment degrades gracefully if env vars are missing.
 * Protected by Authorization: Bearer ADMIN_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getNewApplications,
  getUnderReviewApplications,
  getApprovedApplications,
  getClaimedApplications,
  getPaidApplications,
  type ConsultationRecord,
} from '@/lib/notion-fa-consultation'
import { getDmModes, normalizeHandle } from '@/lib/supabase'

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [newApps, underReview, approved, claimed, paid] = await Promise.all([
      getNewApplications(),
      getUnderReviewApplications(),
      getApprovedApplications(),
      getClaimedApplications(),
      getPaidApplications(),
    ])

    const all = [...newApps, ...underReview, ...approved, ...claimed, ...paid]

    // Collect unique normalized instagram handles for a single Supabase batch query.
    const handles = [...new Set(
      all.map(r => r.instagram).filter(Boolean).map(normalizeHandle)
    )]

    // Gracefully skip if Supabase is not configured or unreachable.
    const dmModes = await getDmModes(handles)

    function enrich(records: ConsultationRecord[]) {
      return records.map(r => ({
        ...r,
        dmMode: r.instagram ? (dmModes.get(normalizeHandle(r.instagram)) ?? null) : null,
      }))
    }

    return NextResponse.json({
      new:         enrich(newApps),
      underReview: enrich(underReview),
      approved:    enrich(approved),
      claimed:     enrich(claimed),
      paid:        enrich(paid),
    })
  } catch (err) {
    console.error('[admin/list]', err)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }
}
