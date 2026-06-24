/**
 * /consultation/pay/success
 *
 * Server component — PayPal redirects here after payment.
 * PayPal appends: ?token=ORDER_ID&PayerID=PAYER_ID
 * We also pass:   ?consultationToken=UUID (our private token)
 *
 * Flow:
 *   1. Capture PayPal order → get notionPageId via customId
 *   2. Generate CONS-INT-##### code
 *   3. Update Notion: CONS Code, PaymentStatus=Confirmed, Status=Paid
 *   4. Render CONS code with DM instructions
 */

import type { Metadata }      from 'next'
import { redirect }           from 'next/navigation'
import { Footer }             from '@/components/layout/Footer'
import { footer }             from '@/data/content'
import { capturePayPalOrder } from '@/lib/paypal'
import { confirmPayment }     from '@/lib/notion-fa-consultation'

export const metadata: Metadata = {
  title:  'پرداخت موفق — اشکان فارا',
  robots: { index: false },
}

const PAD = 'clamp(1rem, 5vw, 4rem)'

function generateConsCode(): string {
  return 'CONS-INT-' + String(Math.floor(10000 + Math.random() * 90000))
}

export default async function ConsultationPaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; PayerID?: string; consultationToken?: string }>
}) {
  const { token: paypalOrderId, consultationToken } = await searchParams

  if (!paypalOrderId || !consultationToken) {
    redirect('/consultation')
  }

  let consCode = ''

  try {
    const capture = await capturePayPalOrder(paypalOrderId)

    if (capture.status !== 'COMPLETED') {
      console.error('[pay/success] PayPal capture status not COMPLETED:', capture.status)
      redirect('/consultation')
    }

    consCode = generateConsCode()
    await confirmPayment(capture.customId, consCode)

  } catch (err) {
    console.error('[pay/success] Error:', err)
    redirect('/consultation')
  }

  return (
    <main className="w-full overflow-x-hidden" dir="rtl">
      <section style={{
        paddingInline:  PAD,
        paddingTop:     '8rem',
        paddingBottom:  '6rem',
        minHeight:      '80vh',
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'center',
      }}>
        <div style={{ maxWidth: '520px' }}>
          <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '2rem' }} />

          <p style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '0.75rem' }}>
            کد مشاوره شما
          </p>

          <p style={{
            fontSize:           'clamp(2rem, 7vw, 3.5rem)',
            fontWeight:         700,
            color:              'var(--accent)',
            letterSpacing:      '0.08em',
            fontVariantNumeric: 'tabular-nums',
            lineHeight:         1,
            marginBottom:       '2rem',
          }}>
            {consCode}
          </p>

          <div style={{ height: '1px', background: 'var(--border)', marginBottom: '2rem' }} />

          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '0.5rem' }}>
            پرداخت موفق بود. این کد را در دایرکت اینستاگرام برای ادمین ارسال کن تا مرحله هماهنگی جلسه انجام بشه.
          </p>

          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '2rem' }}>
            ارسال کد به:{' '}
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>@ashkanfaraa</span>
          </p>

          <a
            href="https://www.instagram.com/ashkanfaraa/"
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
            رفتن به اینستاگرام
          </a>
        </div>
      </section>

      <Footer content={footer} />
    </main>
  )
}
