/**
 * /en/course/success
 *
 * Server component — reached only after PayPal redirects back.
 * PayPal appends: ?token=ORDER_ID&PayerID=PAYER_ID
 *
 * Flow:
 *   1. Read `token` from searchParams
 *   2. Capture the PayPal order (idempotent — safe to reload)
 *   3. Mark the Notion record as paid using the customId stored in the order
 *   4. Render success page with Telegram join link + QR code
 *
 * Direct access (no token) → redirect to /en/course
 * Capture failure → redirect to /en/course
 */

import type { Metadata }    from 'next'
import { redirect }         from 'next/navigation'
import Link                 from 'next/link'
import { Footer }           from '@/components/layout/Footer'
import { footer }           from '@/data/content.en'
import { capturePayPalOrder } from '@/lib/paypal'
import { markPagePaid }     from '@/lib/notion-en'

export const metadata: Metadata = {
  title:   'Purchase Confirmed — Ashkan Faraa',
  robots:  { index: false },
}

const TELEGRAM_URL = 'https://t.me/+JbKiC5JzK5thOWVl'
const PAD          = 'clamp(1rem, 5vw, 4rem)'

export default async function CourseSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; PayerID?: string }>
}) {
  const { token } = await searchParams

  if (!token) redirect('/en/course')

  try {
    const capture = await capturePayPalOrder(token)

    if (capture.customId) {
      await markPagePaid(capture.customId, token).catch(err =>
        console.error('[course/success] Notion update failed (non-critical):', err)
      )
    }
  } catch (err) {
    console.error('[course/success] Capture failed:', err)
    redirect('/en/course')
  }

  return (
    <main className="w-full overflow-x-hidden">
      <section style={{
        paddingInline:   PAD,
        paddingTop:      '10rem',
        paddingBottom:   '6rem',
        minHeight:       '80vh',
        display:         'flex',
        flexDirection:   'column',
        justifyContent:  'center',
      }}>
        <div style={{ maxWidth: '520px' }}>

          <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '2.5rem' }} />

          <h1 style={{
            fontSize:      'clamp(2rem, 4vw, 3rem)',
            fontWeight:    700,
            lineHeight:    1.1,
            letterSpacing: '-0.025em',
            color:         'var(--foreground)',
            marginBottom:  '1.75rem',
          }}>
            Thank you.
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--muted)', lineHeight: 1.95, marginBottom: '0.75rem' }}>
            Your purchase is confirmed.
          </p>
          <p style={{ fontSize: '1rem', color: 'var(--muted)', lineHeight: 1.95, marginBottom: '3rem' }}>
            Join the private course group on Telegram using the link or QR code below. Access is approved manually.
          </p>

          <div style={{ height: '1px', background: 'var(--border)', marginBottom: '3rem' }} />

          <p style={{
            fontSize:      '0.6rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color:         'var(--subtle)',
            marginBottom:  '1.25rem',
          }}>
            Course Access
          </p>

          {/* QR code — external image, rendered as plain img to avoid next/image domain config */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(TELEGRAM_URL)}&bgcolor=161310&color=c4973a&qzone=2&format=png`}
            alt="Scan to join Telegram course group"
            width={180}
            height={180}
            style={{
              display:      'block',
              marginBottom: '1.75rem',
              borderRadius: '0.75rem',
              border:       '1px solid var(--border)',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                justifyContent: 'center',
                borderRadius:   '9999px',
                background:     'var(--accent)',
                color:          'var(--accent-fg)',
                padding:        '0.875rem 2rem',
                fontSize:       '0.875rem',
                fontWeight:     600,
                letterSpacing:  '0.04em',
                textDecoration: 'none',
                whiteSpace:     'nowrap',
              }}
            >
              Request Telegram Access
            </a>

            <Link
              href="/en"
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                justifyContent: 'center',
                borderRadius:   '9999px',
                border:         '1px solid var(--border-strong)',
                color:          'var(--subtle)',
                padding:        '0.875rem 1.5rem',
                fontSize:       '0.875rem',
                fontWeight:     400,
                textDecoration: 'none',
                whiteSpace:     'nowrap',
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
