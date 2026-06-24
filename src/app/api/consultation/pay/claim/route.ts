/**
 * POST /api/consultation/pay/claim
 *
 * Records a manual payment claim (IR or AU).
 * Sets PaymentStatus=Claimed and stores the tracking/reference text.
 * Does NOT generate a CONS code — admin must confirm manually.
 *
 * Body: { token, claimText }
 */

import { NextRequest, NextResponse }            from 'next/server'
import { getApplicationByToken, recordPaymentClaim } from '@/lib/notion-fa-consultation'

export async function POST(req: NextRequest) {
  let body: { token?: string; claimText?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { token, claimText } = body

  if (!token || !claimText?.trim()) {
    return NextResponse.json({ error: 'Missing token or claim text' }, { status: 422 })
  }

  let record
  try {
    record = await getApplicationByToken(token)
  } catch (err) {
    console.error('[pay/claim] Notion lookup failed:', err)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  if (!record) {
    return NextResponse.json({ error: 'Invalid payment link' }, { status: 404 })
  }

  if (record.tokenExpiry && new Date(record.tokenExpiry) < new Date()) {
    return NextResponse.json({ error: 'This payment link has expired' }, { status: 410 })
  }

  if (record.paymentStatus === 'Confirmed') {
    return NextResponse.json({ error: 'Payment already confirmed' }, { status: 409 })
  }

  if (record.paymentStatus === 'Claimed') {
    return NextResponse.json({ error: 'Payment claim already submitted' }, { status: 409 })
  }

  try {
    await recordPaymentClaim(record.pageId, claimText.trim())
  } catch (err) {
    console.error('[pay/claim] Notion update failed:', err)
    return NextResponse.json({ error: 'Failed to record claim' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
