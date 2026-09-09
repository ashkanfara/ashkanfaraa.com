import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getBosTasks, getBosObjectives, type TaskStatus, type TaskOwner } from '@/lib/bos'

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
    const { searchParams } = req.nextUrl
    const statusParam = searchParams.get('status')
    const ownerParam  = searchParams.get('owner')

    const [tasks, objectives] = await Promise.all([
      getBosTasks({
        status: statusParam ? (statusParam.split(',') as TaskStatus[]) : undefined,
        owner:  ownerParam ? (ownerParam as TaskOwner) : undefined,
      }),
      getBosObjectives(),
    ])
    return NextResponse.json({ tasks, objectives })
  } catch (err) {
    console.error('[bos/tasks] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
