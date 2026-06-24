/**
 * POST /api/admin/consultation/confirm
 *
 * Admin confirms a manual payment (IR or AU).
 * Generates the CONS code and marks the record as Paid.
 *
 * Protected by Authorization: Bearer ADMIN_SECRET
 *
 * Body: { pageId, method }
 *   method: 'manual_ir' | 'manual_au'
 */

import { NextRequest, NextResponse } from 'next/server'
import { confirmPayment }            from '@/lib/notion-fa-consultation'

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function generateConsCode(method: string): string {
  const region = method === 'manual_ir' ? 'IR' : 'AU'
  const suffix = String(Math.floor(10000 + Math.random() * 90000))
  return `CONS-${region}-${suffix}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { pageId, method } = body as { pageId: string; method: string }

  if (!pageId || !method) {
    return NextResponse.json({ error: 'Missing pageId or method' }, { status: 422 })
  }

  if (!['manual_ir', 'manual_au'].includes(method)) {
    return NextResponse.json({ error: 'Invalid method — only manual payments need admin confirmation' }, { status: 422 })
  }

  const consCode = generateConsCode(method)

  try {
    await confirmPayment(pageId, consCode)
  } catch (err) {
    console.error('[admin/confirm] Notion write failed:', err)
    return NextResponse.json({ error: 'Failed to update Notion record' }, { status: 500 })
  }

  return NextResponse.json({ consCode })
}
