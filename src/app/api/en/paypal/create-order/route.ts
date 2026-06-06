/**
 * POST /api/en/paypal/create-order
 *
 * Course purchase flow (English site only):
 *   1. Validates customer details from request body
 *   2. Creates a pending record in Notion (Course Purchases DB)
 *   3. Creates a PayPal order with customId = Notion page ID
 *   4. Returns { url } — the PayPal approval URL to redirect the user to
 *
 * After payment, PayPal redirects to /en/course/success?token=ORDER_ID&PayerID=xxx
 * That page captures the order and marks the Notion record as paid.
 *
 * Required env vars:
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_BASE_URL
 *   NOTION_TOKEN, NOTION_COURSE_DB_ID
 *   NEXT_PUBLIC_BASE_URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { createCoursePurchase }      from '@/lib/notion-en'
import { createPayPalOrder }         from '@/lib/paypal'

const REQUIRED_ENV = [
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_BASE_URL',
  'NOTION_TOKEN',
  'NOTION_COURSE_DB_ID',
  'NEXT_PUBLIC_BASE_URL',
]

export async function POST(req: NextRequest) {
  const missing = REQUIRED_ENV.filter(k => !process.env[k])
  if (missing.length) {
    console.error('[en/course/create-order] Missing env vars:', missing)
    return NextResponse.json({ error: 'Payment service is not configured.' }, { status: 503 })
  }

  let body: { name?: string; email?: string; instagram?: string; telegram?: string; phone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { name = '', email = '', instagram = '', telegram = '', phone = '' } = body

  if (!name.trim() || !email.trim()) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 422 })
  }

  try {
    const notionPageId = await createCoursePurchase({
      name:      name.trim(),
      email:     email.trim(),
      instagram: instagram.trim(),
      telegram:  telegram.trim(),
      mobile:    phone.trim(),
    })

    const BASE = process.env.NEXT_PUBLIC_BASE_URL!.replace(/\/$/, '')

    const approveUrl = await createPayPalOrder({
      amount:      '99.00',
      currency:    'USD',
      description: 'The Hidden Traps of Migration — Ashkan Faraa',
      customId:    notionPageId,
      returnUrl:   `${BASE}/en/course/success`,
      cancelUrl:   `${BASE}/en/course`,
    })

    return NextResponse.json({ url: approveUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[en/course/create-order]', msg)
    return NextResponse.json({ error: 'Payment setup failed. Please try again.' }, { status: 500 })
  }
}
