/**
 * GET /api/admin/consultation/list
 *
 * Returns New applications and Claimed applications for the admin dashboard.
 * Protected by Authorization: Bearer ADMIN_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { getNewApplications, getClaimedApplications } from '@/lib/notion-fa-consultation'

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [newApps, claimedApps] = await Promise.all([
      getNewApplications(),
      getClaimedApplications(),
    ])
    return NextResponse.json({ new: newApps, claimed: claimedApps })
  } catch (err) {
    console.error('[admin/list]', err)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }
}
