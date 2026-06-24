/**
 * /consultation/success
 *
 * Server component — reached after PayPal redirects back (INT region only).
 * PayPal appends: ?token=ORDER_ID&PayerID=PAYER_ID
 *
 * Flow:
 *   1. Read `token` from searchParams
 *   2. Capture the PayPal order (idempotent — safe to reload)
 *   3. Generate CONS-INT-##### code
 *   4. Update the Notion record (customId = notionPageId from Phase 1)
 *   5. Render success with CONS code + Instagram DM instruction
 *
 * Direct access (no token) → redirect to /consultation
 * Capture failure → redirect to /consultation
 */

import type { Metadata }      from 'next'
import { redirect }           from 'next/navigation'
import { Footer }             from '@/components/layout/Footer'
import { footer }             from '@/data/content'
import { capturePayPalOrder } from '@/lib/paypal'

export const metadata: Metadata = {
  title:  'ثبت مشاوره — اشکان فارا',
  robots: { index: false },
}

const NOTION_API     = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'
const PAD            = 'clamp(1rem, 5vw, 4rem)'

function generateConsCode(): string {
  return 'CONS-INT-' + String(Math.floor(10000 + Math.random() * 90000))
}

function rt(text: string) {
  return [{ text: { content: text.slice(0, 2000) } }]
}

async function updateNotionRecord(notionPageId: string, consCode: string, paypalOrderId: string) {
  const token = process.env.NOTION_TOKEN
  if (!token || !notionPageId) return

  try {
    const res = await fetch(`${NOTION_API}/pages/${notionPageId}`, {
      method:  'PATCH',
      headers: {
        Authorization:    `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({
        properties: {
          'CONS Code':   { rich_text: rt(consCode) },
          'Region':      { select: { name: 'INT' } },
          'Price':       { rich_text: rt('USD 99') },
          'Proof Type':  { select: { name: 'paypal' } },
          'Proof Value': { rich_text: rt(paypalOrderId) },
          'Status':      { select: { name: 'Paid' } },
        },
      }),
    })
    if (!res.ok) {
      console.error('[consultation/success] Notion update failed:', res.status, await res.text())
    } else {
      console.log('[consultation/success] ✓ Notion record updated. CONS Code:', consCode)
    }
  } catch (err) {
    console.error('[consultation/success] Notion update error (non-critical):', err)
  }
}

export default async function ConsultationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; PayerID?: string }>
}) {
  const { token } = await searchParams

  if (!token) redirect('/consultation')

  let consCode = ''

  try {
    const capture = await capturePayPalOrder(token)
    consCode = generateConsCode()

    await updateNotionRecord(capture.customId, consCode, capture.orderId)

  } catch (err) {
    console.error('[consultation/success] Capture failed:', err)
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
            fontSize: 'clamp(2rem, 7vw, 3.5rem)', fontWeight: 700,
            color: 'var(--accent)', letterSpacing: '0.08em',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            marginBottom: '2rem',
          }}>
            {consCode}
          </p>

          <div style={{ height: '1px', background: 'var(--border)', marginBottom: '2rem' }} />

          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '0.5rem' }}>
            درخواست مشاوره شما ثبت شد. لطفاً این کد را در دایرکت اینستاگرام برای ادمین ارسال کنید تا پرداخت بررسی و مرحله بعد هماهنگ شود.
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
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
              padding: '0.875rem 2rem', fontSize: '0.875rem', fontWeight: 600,
              letterSpacing: '0.04em', textDecoration: 'none', whiteSpace: 'nowrap',
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
