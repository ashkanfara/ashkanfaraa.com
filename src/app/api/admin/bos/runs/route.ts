import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getBosRuns } from '@/lib/bos'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''

async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies()
  return jar.get('admin_auth')?.value === ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const taskId = req.nextUrl.searchParams.get('task_id') ?? undefined
    const runs = await getBosRuns({ taskId, limit: 100 })
    return NextResponse.json({ runs })
  } catch (err) {
    console.error('[bos/runs] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
