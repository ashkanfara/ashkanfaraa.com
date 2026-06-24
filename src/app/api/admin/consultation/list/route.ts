/**
 * GET /api/admin/consultation/list
 *
 * Returns all five dashboard sections enriched with dmMode, senderId,
 * and isBlocked from Supabase. All degrade gracefully if env vars are missing.
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
import { getLeadsData, getBlockedSenderIds, normalizeHandle } from '@/lib/supabase'

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

    const handles = [...new Set(
      all.map(r => r.instagram).filter(Boolean).map(normalizeHandle)
    )]

    // One query: get dm_mode + sender_id for all handles.
    // Then use sender_ids to query dm_blocklist.
    const leadsMap = await getLeadsData(handles)

    const senderIds = [...new Set(
      [...leadsMap.values()].map(l => l.senderId).filter(Boolean) as string[]
    )]

    const blockedIds = await getBlockedSenderIds(senderIds)

    function enrich(records: ConsultationRecord[]) {
      return records.map(r => {
        const handle = r.instagram ? normalizeHandle(r.instagram) : null
        const lead   = handle ? leadsMap.get(handle) : null
        return {
          ...r,
          dmMode:   lead?.dmMode   ?? null,
          senderId: lead?.senderId ?? null,
          isBlocked: lead?.senderId ? blockedIds.has(lead.senderId) : null,
        }
      })
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
