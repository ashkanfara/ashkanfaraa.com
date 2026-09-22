import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminSession'
import { getOutboundSent, getOutboundFailed } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!requireAdminSession(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tab    = searchParams.get('tab') ?? 'sent'
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50', 10), 200)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0',  10), 0)

  if (tab === 'sent') {
    const rows = await getOutboundSent(limit, offset)
    return NextResponse.json({ tab: 'sent', rows })
  }

  if (tab === 'failed') {
    const rows = await getOutboundFailed(limit, offset)
    return NextResponse.json({ tab: 'failed', rows })
  }

  return NextResponse.json({ error: 'Unknown tab; use ?tab=sent or ?tab=failed' }, { status: 400 })
}
