/**
 * /en/consultation/success
 *
 * Server component — reached only after PayPal redirects back.
 * PayPal appends: ?token=ORDER_ID&PayerID=PAYER_ID
 *
 * Flow:
 *   1. Read `token` from searchParams
 *   2. Capture the PayPal order (idempotent — safe to reload)
 *   3. Mark the Notion consultation record as paid
 *   4. Render confirmation page
 *
 * Direct access (no token) → redirect to /en/consultation
 * Capture failure → redirect to /en/consultation
 */

import type { Metadata }      from 'next'
import { redirect }           from 'next/navigation'
import Link                   from 'next/link'
import { Footer }             from '@/components/layout/Footer'
import { footer }             from '@/data/content.en'
import { capturePayPalOrder } from '@/lib/paypal'
import { markPagePaid }       from '@/lib/notion-en'

export const metadata: Metadata = {
  title:  'Session Confirmed — Ashkan Faraa',
  robots: { index: false },
}

const PAD = 'clamp(1rem, 5vw, 4rem)'

export default async function ConsultationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; PayerID?: string }>
}) {
  const { token } = await searchParams

  if (!token) redirect('/en/consultation')

  try {
    const capture = await capturePayPalOrder(token)

    if (capture.customId) {
      await markPagePaid(capture.customId, token).catch(err =>
        console.error('[consultation/success] Notion update failed (non-critical):', err)
      )
    }
  } catch (err) {
    console.error('[consultation/success] Capture failed:', err)
    redirect('/en/consultation')
  }

  return (
    <main className="w-full overflow-x-hidden">
      <section style={{
        paddingInline:  PAD,
        paddingTop:     '10rem',
        paddingBottom:  '6rem',
        minHeight:      '80vh',
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'center',
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
            Session confirmed.
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--muted)', lineHeight: 1.95, marginBottom: '0.75rem' }}>
            Payment received. Your strategy session has been booked.
          </p>
          <p style={{ fontSize: '1rem', color: 'var(--muted)', lineHeight: 1.95, marginBottom: '3rem' }}>
            You will be contacted within 48 hours to confirm the time and format.
          </p>

          <div style={{ height: '1px', background: 'var(--border)', marginBottom: '3rem' }} />

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
      </section>

      <Footer content={footer} />
    </main>
  )
}
