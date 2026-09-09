import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getBosState } from '@/lib/bos'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''

async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies()
  return jar.get('admin_auth')?.value === ADMIN_PASSWORD
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const state = await getBosState()
    return NextResponse.json(state)
  } catch (err) {
    console.error('[bos/state] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
