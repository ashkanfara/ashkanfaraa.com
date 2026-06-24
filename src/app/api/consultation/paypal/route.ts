/**
 * POST /api/consultation/paypal
 *
 * Persian consultation — INT region PayPal order creation.
 * Creates a PayPal order for USD 99 and returns the approval URL.
 * The Notion page ID (from Phase 1) is stored as customId so the
 * success page can update the correct record after capture.
 *
 * Body (JSON):
 *   notionPageId  string   Notion page ID from Phase 1 (may be empty)
 *   name          string   Customer name (for logging)
 *
 * Returns: { url } — PayPal approval URL to redirect the user to.
 *
 * Required env vars:
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_BASE_URL, NOTION_TOKEN
 */

import { NextRequest, NextResponse }  from 'next/server'
import { createPayPalOrder }          from '@/lib/paypal'

const REQUIRED = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_BASE_URL']

export async function POST(req: NextRequest) {
  console.log('[FA consultation/paypal] Route hit')

  const missing = REQUIRED.filter(k => !process.env[k])
  if (missing.length) {
    console.error('[FA consultation/paypal] Missing env vars:', missing)
    return NextResponse.json({ error: 'Payment service is not configured.' }, { status: 503 })
  }

  let body: { notionPageId?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { notionPageId = '', name = '' } = body

  const BASE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.ashkanfaraa.com').replace(/\/$/, '')

  try {
    const approveUrl = await createPayPalOrder({
      amount:      '99.00',
      currency:    'USD',
      description: 'Private Strategy Session — Ashkan Faraa',
      customId:    notionPageId,   // used by success page to update Notion record
      returnUrl:   `${BASE}/consultation/success`,
      cancelUrl:   `${BASE}/consultation`,
    })

    console.log('[FA consultation/paypal] ✓ PayPal order created for:', name || '(unnamed)', '| notionPageId:', notionPageId || '(none)')
    return NextResponse.json({ url: approveUrl })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[FA consultation/paypal]', msg)
    return NextResponse.json({ error: 'Payment setup failed. Please try again.' }, { status: 500 })
  }
}
