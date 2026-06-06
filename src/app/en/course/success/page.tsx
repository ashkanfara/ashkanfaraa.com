/**
 * /en/course/success
 *
 * Landing page after Stripe or PayPal redirects back on successful payment.
 *
 * Stripe redirects to: /en/course/success?session_id={CHECKOUT_SESSION_ID}
 * PayPal redirects to: /en/course/success?token={ORDER_ID}&PayerID={PAYER_ID}
 *
 * TODO (when credentials are live): verify payment server-side before
 * showing this page to prevent direct URL access without payment.
 *
 * Stripe verification example:
 *   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
 *   const session = await stripe.checkout.sessions.retrieve(session_id)
 *   if (session.payment_status !== 'paid') redirect('/en/course')
 *
 * PayPal capture example:
 *   await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${token}/capture`, {
 *     method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }
 *   })
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/layout/Footer'
import { footer } from '@/data/content.en'

export const metadata: Metadata = {
  title: 'Purchase Confirmed — Ashkan Faraa',
  robots: { index: false },
}

const PAD = 'clamp(1rem, 5vw, 4rem)'
const TELEGRAM_URL = 'https://t.me/+JbKiC5JzK5thOWVl'

export default function CourseSuccessPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <section style={{
        paddingInline: PAD,
        paddingTop: '10rem',
        paddingBottom: '6rem',
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <div style={{ maxWidth: '520px' }}>

          <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '2.5rem' }} />

          <h1 style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            color: 'var(--foreground)',
            marginBottom: '1.75rem',
          }}>
            Thank you.
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--muted)', lineHeight: 1.95, marginBottom: '0.5rem' }}>
            Your purchase has been received.
          </p>
          <p style={{ fontSize: '1rem', color: 'var(--muted)', lineHeight: 1.95, marginBottom: '3rem' }}>
            You will receive access instructions shortly.
          </p>

          <div style={{ height: '1px', background: 'var(--border)', marginBottom: '3rem' }} />

          <p style={{
            fontSize: '0.6rem', letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '1rem',
          }}>
            Telegram Community
          </p>

          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.85, marginBottom: '2rem' }}>
            Join the course community on Telegram.
            Membership is approved manually — request access using the link below.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
                padding: '0.875rem 2rem', fontSize: '0.875rem', fontWeight: 600,
                letterSpacing: '0.04em', textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              Request Telegram Access
            </a>

            <Link
              href="/en"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '9999px', border: '1px solid var(--border-strong)',
                color: 'var(--subtle)', padding: '0.875rem 1.5rem', fontSize: '0.875rem',
                fontWeight: 400, textDecoration: 'none', whiteSpace: 'nowrap',
                transition: 'border-color 0.15s, color 0.15s',
              }}
            >
              Back to home
            </Link>
          </div>

        </div>
      </section>

      <Footer content={footer} />
    </main>
  )
}
