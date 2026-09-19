/** Daily unattended backup; authenticated inbox refresh uses the same recovery. */
import { NextRequest, NextResponse } from 'next/server'
import { recoverStaleDmDrafts } from '@/lib/dm-draft-recovery'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await recoverStaleDmDrafts()
    return NextResponse.json(result, { status: result.ok ? 200 : 502 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Draft recovery unavailable' }, { status: 503 })
  }
}
