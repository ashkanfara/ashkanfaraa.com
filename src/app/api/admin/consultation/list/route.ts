/**
 * GET /api/admin/consultation/list
 *
 * Returns all five dashboard sections in parallel.
 * Protected by Authorization: Bearer ADMIN_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getNewApplications,
  getUnderReviewApplications,
  getApprovedApplications,
  getClaimedApplications,
  getPaidApplications,
} from '@/lib/notion-fa-consultation'

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
    return NextResponse.json({ new: newApps, underReview, approved, claimed, paid })
  } catch (err) {
    console.error('[admin/list]', err)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }
}
