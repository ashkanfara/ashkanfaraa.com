/**
 * POST /api/en/paypal/create-order
 *
 * Creates a PayPal Order for the English course ($99 USD) and returns
 * the approval URL to redirect the user to PayPal's hosted checkout.
 *
 * Required environment variables (.env.local):
 *   PAYPAL_CLIENT_ID           = your PayPal client ID
 *   PAYPAL_CLIENT_SECRET       = your PayPal client secret
 *   NEXT_PUBLIC_BASE_URL       = https://yourdomain.com
 *
 * For sandbox testing, set PAYPAL_SANDBOX=true in .env.local.
 *
 * After payment, PayPal redirects to:
 *   return_url: NEXT_PUBLIC_BASE_URL/en/course/success
 *   cancel_url: NEXT_PUBLIC_BASE_URL/en/course
 *
 * On the success page, capture the order using the token query param:
 *   POST https://api-m.paypal.com/v2/checkout/orders/{token}/capture
 */

import { NextRequest, NextResponse } from 'next/server'

const PAYPAL_BASE = process.env.PAYPAL_SANDBOX === 'true'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com'

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error('Failed to obtain PayPal access token')
  const data = await res.json()
  return data.access_token as string
}

export async function POST(req: NextRequest) {
  const clientId     = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('[PayPal] PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not set.')
    return NextResponse.json(
      { error: 'Payment is currently unavailable. Please try again later.' },
      { status: 503 }
    )
  }

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'

  try {
    const body = await req.json()
    const { name = '', instagram = '', telegram = '', phone = '' } = body

    const token = await getAccessToken(clientId, clientSecret)

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'PayPal-Request-Id': `ashkanfaraa-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount:      { currency_code: 'USD', value: '99.00' },
            description: 'The Hidden Traps of Migration — Ashkan Faraa',
            custom_id:   JSON.stringify({ name, instagram, telegram, phone }),
          },
        ],
        application_context: {
          brand_name:          'Ashkan Faraa',
          locale:              'en-AU',
          landing_page:        'BILLING',
          user_action:         'PAY_NOW',
          return_url:          `${BASE_URL}/en/course/success`,
          cancel_url:          `${BASE_URL}/en/course`,
          shipping_preference: 'NO_SHIPPING',
        },
      }),
    })

    const order = await res.json()
    const approveLink = (order.links as Array<{ rel: string; href: string }>)
      ?.find(l => l.rel === 'approve')?.href

    if (!approveLink) {
      console.error('[PayPal] No approve link in response:', order)
      throw new Error('PayPal order creation failed')
    }

    return NextResponse.json({ url: approveLink })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Order creation failed'
    console.error('[PayPal] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
