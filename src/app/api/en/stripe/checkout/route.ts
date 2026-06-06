/**
 * POST /api/en/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the English course ($99 USD).
 *
 * Required environment variables (.env.local):
 *   STRIPE_SECRET_KEY          = sk_live_...   (or sk_test_... for testing)
 *   NEXT_PUBLIC_BASE_URL       = https://yourdomain.com
 *
 * After payment, Stripe redirects to:
 *   success: NEXT_PUBLIC_BASE_URL/en/course/success?session_id={CHECKOUT_SESSION_ID}
 *   cancel:  NEXT_PUBLIC_BASE_URL/en/course
 *
 * To verify payment server-side on the success page, retrieve the session:
 *   const session = await stripe.checkout.sessions.retrieve(session_id)
 *   if (session.payment_status !== 'paid') redirect('/en/course')
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    console.error('[Stripe] STRIPE_SECRET_KEY is not set.')
    return NextResponse.json(
      { error: 'Payment is currently unavailable. Please try again later.' },
      { status: 503 }
    )
  }

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'

  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(secret)

    const body = await req.json()
    const { name = '', email = '', instagram = '', telegram = '', phone = '' } = body

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 9900, // $99.00
            product_data: {
              name: 'The Hidden Traps of Migration',
              description: 'Course by Ashkan Faraa',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        customer_name: name,
        instagram,
        telegram,
        phone,
      },
      success_url: `${BASE_URL}/en/course/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/en/course`,
      locale: 'en',
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout session creation failed'
    console.error('[Stripe] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
