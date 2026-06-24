/**
 * POST /api/consultation/pay/initiate
 *
 * Creates a PayPal order for a token-gated consultation payment.
 * Returns { approvalUrl } — client redirects the user there.
 *
 * Body: { token }  — the UUID from the private payment link
 *
 * Validates:
 *   - Token exists and is not expired
 *   - PaymentStatus is Pending (not already claimed/confirmed)
 *   - PaymentMethod is 'paypal'
 */

import { NextRequest, NextResponse }   from 'next/server'
import { getApplicationByToken }       from '@/lib/notion-fa-consultation'
import { createPayPalOrder }           from '@/lib/paypal'

const BASE_URL = () =>
  (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ashkanfaraa.com').replace(/\/$/, '')

export async function POST(req: NextRequest) {
  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { token } = body
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 422 })
  }

  let record
  try {
    record = await getApplicationByToken(token)
  } catch (err) {
    console.error('[pay/initiate] Notion lookup failed:', err)
    return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 })
  }

  if (!record) {
    return NextResponse.json({ error: 'Invalid payment link' }, { status: 404 })
  }

  if (record.tokenExpiry && new Date(record.tokenExpiry) < new Date()) {
    return NextResponse.json({ error: 'This payment link has expired' }, { status: 410 })
  }

  if (record.paymentStatus === 'Confirmed') {
    return NextResponse.json({ error: 'Payment already completed' }, { status: 409 })
  }

  if (record.paymentMethod !== 'paypal') {
    return NextResponse.json({ error: 'Payment method mismatch' }, { status: 422 })
  }

  if (!record.approvedPrice || !record.approvedCurrency) {
    return NextResponse.json({ error: 'Approved price not set' }, { status: 422 })
  }

  try {
    const approvalUrl = await createPayPalOrder({
      amount:      record.approvedPrice.toFixed(2),
      currency:    record.approvedCurrency,
      description: 'جلسه مشاوره — اشکان فارا',
      customId:    record.pageId,
      returnUrl:   `${BASE_URL()}/consultation/pay/success?consultationToken=${token}`,
      cancelUrl:   `${BASE_URL()}/consultation/pay?token=${token}`,
    })
    return NextResponse.json({ approvalUrl })
  } catch (err) {
    console.error('[pay/initiate] PayPal order creation failed:', err)
    return NextResponse.json({ error: 'PayPal order creation failed' }, { status: 500 })
  }
}
