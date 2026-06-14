import type { Metadata } from 'next'
import { Footer }                from '@/components/layout/Footer'
import { MigrationDetailedForm } from '@/components/sections/MigrationDetailedForm'
import { footer }                from '@/data/content'

export const metadata: Metadata = {
  title:  'ارزیابی تفصیلی مهاجرت — اشکان فارا',
  description:
    'فرم ارزیابی تفصیلی مهاجرت برای دریافت بررسی دقیق‌تر. اشکان فارا مشاور مهاجرت ثبت‌شده نیست. این فرم اختیاری است و جایگزین مشاوره حقوقی نیست.',
  robots: 'noindex',
}

const PAD = 'clamp(1rem, 5vw, 4rem)'

function Eyebrow({ children }: { children: string }) {
  return (
    <div dir="rtl" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, flexShrink: 0 }} />
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--subtle)', margin: 0 }}>
        {children}
      </p>
    </div>
  )
}

interface Props {
  searchParams: Promise<{ leadId?: string; dest?: string }>
}

export default async function MigrationDetailedPage({ searchParams }: Props) {
  const params      = await searchParams
  const leadId      = params.leadId      || ''
  const destination = params.dest        || ''

  return (
    <main className="w-full overflow-x-hidden">

      {/* ── Hero ── */}
      <section dir="rtl" style={{ paddingInline: PAD, paddingTop: '6.5rem', paddingBottom: '3rem' }}>
        <div style={{ maxWidth: '680px' }}>
          <Eyebrow>ارزیابی تفصیلی — مرحله دوم اختیاری</Eyebrow>

          <h1 style={{
            fontSize:      'clamp(1.9rem, 3.8vw, 3rem)',
            fontWeight:    700,
            lineHeight:    1.2,
            letterSpacing: '-0.025em',
            color:         'var(--foreground)',
            marginBottom:  '1.25rem',
          }}>
            ارزیابی تفصیلی
            <br />
            پرونده مهاجرتی
          </h1>

          <p style={{ fontSize: 'clamp(0.875rem, 1.1vw, 1rem)', color: 'var(--muted)', lineHeight: 1.9, maxWidth: '52ch', marginBottom: '2rem' }}>
            با تکمیل این فرم اطلاعات کامل‌تری در اختیار ما قرار می‌دهید. این مرحله کاملاً اختیاری است و بررسی دقیق‌تری از پرونده شما امکان‌پذیر می‌کند.
          </p>

          {/* Disclaimer */}
          <div style={{
            borderRight:  '2px solid var(--accent)',
            paddingRight: '1.25rem',
            marginBottom: '0',
            opacity:      0.85,
          }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--subtle)', lineHeight: 1.85 }}>
              اشکان فارا مشاور مهاجرت ثبت‌شده نیست. این فرم مشاوره مهاجرتی، ارزیابی رسمی اهلیت یا تضمین واجد شرایط بودن ارائه نمی‌دهد. اطلاعات شما فقط برای ارزیابی اولیه و امکان معرفی به متخصصان معتبر استفاده می‌شود.
            </p>
          </div>
        </div>
      </section>

      {/* ── Form ── */}
      <section dir="rtl" style={{
        paddingInline:  PAD,
        paddingTop:     '2.5rem',
        paddingBottom:  '5rem',
        borderTop:      '1px solid var(--border)',
      }}>
        <MigrationDetailedForm leadId={leadId} destination={destination} />
      </section>

      <Footer content={footer} />
    </main>
  )
}
