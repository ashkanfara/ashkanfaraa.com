/**
 * POST /api/en/consultation
 *
 * Consultation booking flow (English site only):
 *   1. Validates form fields: name, instagram, email, reason
 *   2. Creates a pending record in Notion (Consultation Applications DB)
 *   3. Creates a PayPal order (AUD 450) with customId = Notion page ID
 *   4. Returns { url } — the PayPal approval URL to redirect the user to
 *
 * After payment, PayPal redirects to /en/consultation/success?token=ORDER_ID
 * That page captures the order and marks the Notion record as paid.
 *
 * Required env vars:
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_BASE_URL
 *   NOTION_TOKEN, NOTION_CONSULTATION_DB_ID
 *   NEXT_PUBLIC_BASE_URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { createConsultationApp }     from '@/lib/notion-en'
import { createPayPalOrder }         from '@/lib/paypal'

const REQUIRED_ENV = [
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_BASE_URL',
  'NOTION_TOKEN',
  'NOTION_CONSULTATION_DB_ID',
  'NEXT_PUBLIC_BASE_URL',
]

export async function POST(req: NextRequest) {
  const missing = REQUIRED_ENV.filter(k => !process.env[k])
  if (missing.length) {
    console.error('[en/consultation] Missing env vars:', missing)
    return NextResponse.json({ error: 'Booking service is not configured.' }, { status: 503 })
  }

  let body: { name?: string; instagram?: string; email?: string; reason?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { name = '', instagram = '', email = '', reason = '' } = body

  if (!name.trim() || !email.trim() || !reason.trim()) {
    return NextResponse.json({ error: 'Name, email, and reason are required.' }, { status: 422 })
  }

  try {
    const notionPageId = await createConsultationApp({
      name:      name.trim(),
      instagram: instagram.trim(),
      email:     email.trim(),
      reason:    reason.trim(),
    })

    const BASE = process.env.NEXT_PUBLIC_BASE_URL!.replace(/\/$/, '')

    const approveUrl = await createPayPalOrder({
      amount:      '450.00',
      currency:    'AUD',
      description: 'Private Strategy Session — Ashkan Faraa',
      customId:    notionPageId,
      returnUrl:   `${BASE}/en/consultation/success`,
      cancelUrl:   `${BASE}/en/consultation`,
    })

    return NextResponse.json({ url: approveUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[en/consultation]', msg)
    return NextResponse.json({ error: 'Booking setup failed. Please try again.' }, { status: 500 })
  }
}
