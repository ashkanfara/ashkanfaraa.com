import type { Metadata } from 'next'
import { Footer }         from '@/components/layout/Footer'
import { MigrationForm }  from '@/components/sections/MigrationForm'
import { footer }         from '@/data/content'

export const metadata: Metadata = {
  title:  'ارزیابی اولیه مسیر مهاجرت — اشکان فارا',
  description:
    'اطلاعات خود را برای ارزیابی اولیه مسیر مهاجرت ارسال کنید. اشکان فارا مشاور مهاجرت ثبت‌شده نیست. اطلاعات شما ممکن است به متخصصان معتبر ارجاع داده شود.',
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

export default function MigrationAssistancePage() {
  return (
    <main className="w-full overflow-x-hidden">

      {/* ── Hero ── */}
      <section dir="rtl" style={{ paddingInline: PAD, paddingTop: '6.5rem', paddingBottom: '3rem' }}>
        <div style={{ maxWidth: '680px' }}>
          <Eyebrow>ارزیابی اولیه مسیر مهاجرت</Eyebrow>

          <h1 style={{
            fontSize:      'clamp(1.9rem, 3.8vw, 3rem)',
            fontWeight:    700,
            lineHeight:    1.2,
            letterSpacing: '-0.025em',
            color:         'var(--foreground)',
            marginBottom:  '1.25rem',
          }}>
            ارزیابی اولیه
            <br />
            مسیر مهاجرت
          </h1>

          <p style={{ fontSize: 'clamp(0.875rem, 1.1vw, 1rem)', color: 'var(--muted)', lineHeight: 1.9, maxWidth: '52ch', marginBottom: '2rem' }}>
            این فرم برای افرادی طراحی شده که به طور جدی به مهاجرت فکر می‌کنند. اطلاعات شما بررسی می‌شود و در صورت مناسب بودن شرایط، ممکن است به مشاوران یا متخصصان مهاجرت معتبر معرفی شوید.
          </p>

          {/* Disclaimer */}
          <div style={{
            borderRight:   '2px solid var(--accent)',
            paddingRight:  '1.25rem',
            marginBottom:  '0',
            opacity:       0.85,
          }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--subtle)', lineHeight: 1.85 }}>
              اشکان فارا مشاور مهاجرت ثبت‌شده نیست و این فرم به معنی دریافت مشاوره مهاجرتی، بررسی رسمی پرونده یا تضمین واجد شرایط بودن نیست. اطلاعات شما فقط برای ارزیابی اولیه و امکان معرفی به افراد متخصص استفاده می‌شود.
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
        <MigrationForm />
      </section>

      <Footer content={footer} />
    </main>
  )
}
