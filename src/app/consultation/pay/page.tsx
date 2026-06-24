/**
 * /consultation/pay?token=UUID
 *
 * Token-gated payment page. Server component.
 * Fetches the Notion record for the token and renders the
 * appropriate payment UI based on PaymentMethod.
 */

import type { Metadata }         from 'next'
import { Footer }                from '@/components/layout/Footer'
import { footer }                from '@/data/content'
import { getApplicationByToken } from '@/lib/notion-fa-consultation'
import PayPalButton              from './PayPalButton'
import ManualClaimForm           from './ManualClaimForm'

export const metadata: Metadata = {
  title:  'پرداخت مشاوره — اشکان فارا',
  robots: { index: false },
}

const PAD = 'clamp(1rem, 5vw, 4rem)'

function Section({ children }: { children: React.ReactNode }) {
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
          {children}
        </div>
      </section>
      <Footer content={footer} />
    </main>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <Section>
      <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 2 }}>{message}</p>
    </Section>
  )
}

function formatPrice(price: number, currency: string, method: string): string {
  const formatted = new Intl.NumberFormat('fa-IR', { style: 'decimal' }).format(price)
  if (method === 'manual_ir') return formatted + ' تومان'
  return formatted + ' ' + currency
}

export default async function ConsultationPayPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <ErrorState message="این لینک معتبر نیست." />
  }

  let record
  try {
    record = await getApplicationByToken(token)
  } catch {
    return <ErrorState message="سرویس موقتاً در دسترس نیست. لطفاً دوباره تلاش کن." />
  }

  if (!record) {
    return <ErrorState message="این لینک معتبر نیست." />
  }

  if (record.tokenExpiry && new Date(record.tokenExpiry) < new Date()) {
    return <ErrorState message="این لینک منقضی شده است. برای دریافت لینک جدید با اشکان جان در تماس باش." />
  }

  if (record.paymentStatus === 'Confirmed') {
    return <ErrorState message="پرداخت این درخواست قبلاً تأیید شده است." />
  }

  if (record.paymentStatus === 'Claimed') {
    return (
      <Section>
        <p style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.7, marginBottom: '1rem' }}>
          درخواست پرداخت ثبت شد.
        </p>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 2 }}>
          پس از تأیید پرداخت توسط ادمین، کد CONS برایت ارسال می‌شود.
        </p>
      </Section>
    )
  }

  const method    = record.paymentMethod
  const firstName = record.name.trim().split(/\s+/)[0]
  const priceLabel = record.approvedPrice
    ? formatPrice(record.approvedPrice, record.approvedCurrency, method)
    : '—'

  // ── IR card details ────────────────────────────────────────
  const cardHolder = process.env.NEXT_PUBLIC_CARD_HOLDER ?? ''
  const cardNumber = process.env.NEXT_PUBLIC_CARD_NUMBER ?? ''
  const cardSheba  = process.env.NEXT_PUBLIC_CARD_SHEBA  ?? ''

  // ── AU bank details (optional) ─────────────────────────────
  const auBsb     = process.env.AU_BSB            ?? ''
  const auAccount = process.env.AU_ACCOUNT_NUMBER ?? ''
  const auHolder  = process.env.AU_ACCOUNT_HOLDER ?? ''
  const auReady   = Boolean(auBsb && auAccount && auHolder)

  if (method === 'manual_au' && !auReady) {
    return <ErrorState message="این روش پرداخت موقتاً در دسترس نیست. لطفاً با اشکان جان در تماس باش." />
  }

  return (
    <Section>
      <p style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '1.25rem' }}>
        پرداخت مشاوره
      </p>

      <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
        سلام {firstName} جان
      </p>

      <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '2rem' }}>
        مبلغ تأیید شده برای جلسه مشاوره:{' '}
        <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{priceLabel}</span>
      </p>

      <div style={{ height: '1px', background: 'var(--border)', marginBottom: '2rem' }} />

      {method === 'paypal' && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '1.5rem' }}>
            پرداخت از طریق PayPal انجام می‌شود. پس از پرداخت، کد CONS نمایش داده می‌شود.
          </p>
          <PayPalButton token={token} />
        </>
      )}

      {method === 'manual_ir' && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '1.5rem' }}>
            مبلغ را به کارت زیر واریز کن، سپس شماره پیگیری را وارد کن.
          </p>

          <div style={{
            background: 'var(--surface-raised)',
            border:     '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding:    '1.25rem 1.5rem',
            marginBottom: '2rem',
            display:    'flex',
            flexDirection: 'column',
            gap:        '0.6rem',
          }}>
            {cardHolder && (
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                <span style={{ color: 'var(--subtle)', marginLeft: '0.5rem' }}>به نام:</span>
                {cardHolder}
              </div>
            )}
            {cardNumber && (
              <div style={{ fontSize: '1rem', color: 'var(--foreground)', letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums' }}>
                {cardNumber}
              </div>
            )}
            {cardSheba && (
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', direction: 'ltr', textAlign: 'right' }}>
                شبا: {cardSheba}
              </div>
            )}
          </div>

          <ManualClaimForm token={token} method="manual_ir" />
        </>
      )}

      {method === 'manual_au' && auReady && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '1.5rem' }}>
            مبلغ را به حساب زیر انتقال بده، سپس شماره مرجع را وارد کن.
          </p>

          <div style={{
            background: 'var(--surface-raised)',
            border:     '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding:    '1.25rem 1.5rem',
            marginBottom: '2rem',
            display:    'flex',
            flexDirection: 'column',
            gap:        '0.6rem',
          }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              <span style={{ color: 'var(--subtle)', marginLeft: '0.5rem' }}>Account Name:</span>
              {auHolder}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', direction: 'ltr', textAlign: 'right' }}>
              BSB: {auBsb} &nbsp;·&nbsp; Account: {auAccount}
            </div>
          </div>

          <ManualClaimForm token={token} method="manual_au" />
        </>
      )}
    </Section>
  )
}
