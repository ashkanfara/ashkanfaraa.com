import type { Metadata } from 'next'
import Image from 'next/image'
import { Footer } from '@/components/layout/Footer'
import { ConsultationForm } from '@/components/sections/ConsultationForm'

export const metadata: Metadata = {
  title: 'جلسه خصوصی تصمیم‌گیری — اشکان فارا',
  description: 'قبل از تصمیم‌های بزرگ، تصویر کامل را ببین. جلسه خصوصی برای کسانی که می‌خواهند قبل از تعهد، با دیدِ کامل‌تری تصمیم بگیرند.',
}

const PAD = 'clamp(1rem, 5vw, 4rem)'

function Eyebrow({ children }: { children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, flexShrink: 0 }} />
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--subtle)', margin: 0 }}>
        {children}
      </p>
    </div>
  )
}

export default function ConsultationPage() {
  return (
    <main className="w-full overflow-x-hidden">

      {/* ── Hero: image left, text right ── */}
      <section style={{ paddingInline: PAD, paddingTop: '6.5rem', paddingBottom: '3rem' }}>
        <div
          dir="ltr"
          className="grid grid-cols-1 md:grid-cols-[45fr_55fr] items-center gap-10 md:gap-14"
        >
          {/* Left: image */}
          <div
            className="w-full aspect-[16/9] md:aspect-[4/5]"
            style={{ position: 'relative', borderRadius: '0.875rem', overflow: 'hidden' }}
          >
            <Image
              src="/images/card-consultation.png"
              alt="اشکان فارا"
              fill
              priority
              className="object-cover object-[50%_15%] md:object-top"
              sizes="(max-width: 768px) 100vw, 45vw"
            />
          </div>

          {/* Right: text */}
          <div dir="rtl" style={{ display: 'flex', flexDirection: 'column' }}>
            <Eyebrow>جلسه خصوصی تصمیم‌گیری</Eyebrow>

            <h1 style={{
              fontSize: 'clamp(1.8rem, 3.5vw, 3.2rem)',
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              color: 'var(--foreground)',
              marginBottom: '1.5rem',
            }}>
              قبل از تصمیم‌های بزرگ،
              <br />
              تصویر کامل را ببین.
            </h1>

            <div style={{ width: '2.5rem', height: '1px', background: 'var(--accent)', opacity: 0.7, marginBottom: '1.5rem' }} />

            <p style={{
              fontSize: 'clamp(0.875rem, 1.1vw, 1rem)',
              color: 'var(--muted)',
              lineHeight: 1.95,
              marginBottom: '2.25rem',
              maxWidth: '44ch',
            }}>
              اگر در آستانه یک تصمیم مهم هستی، این جلسه برای کمک به دیدن تصویر کامل‌تر طراحی شده است. از مهاجرت، تحصیل و کسب‌وکار گرفته تا سرمایه‌گذاری و انتخاب مسیر بعدی زندگی؛ هدف این جلسه کمک به تصمیم‌گیری آگاهانه‌تر قبل از هر تعهد جدی است.
              <br /><br />
              بسیاری از اشتباهات بزرگ نه از کمبود اطلاعات، بلکه از ندیدن تصویر کامل اتفاق می‌افتند. این جلسه برای کسانی است که می‌خواهند قبل از صرف زمان، پول و انرژی، تصمیمی بگیرند که سال‌ها بعد از آن پشیمان نشوند.
            </p>

            {/* CTA row: primary action + back link */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <a
                href="#form"
                className="btn-gold"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '9999px',
                  background: 'var(--accent)', color: 'var(--accent-fg)',
                  padding: '0.875rem 2rem',
                  fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.04em',
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                ارسال درخواست
              </a>
              <a
                href="/"
                className="back-link"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.78rem', color: 'var(--muted)',
                  textDecoration: 'none', opacity: 0.75,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
                بازگشت
              </a>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--subtle)', margin: 0, opacity: 0.8 }}>
              به دلیل محدودیت زمان، همه درخواست‌ها پذیرفته نمی‌شوند. در صورت تأیید درخواست، جزئیات جلسه و هزینه برای شما ارسال خواهد شد.
            </p>
          </div>

        </div>
      </section>

      {/* ── Form ── */}
      <section
        id="form"
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '3rem',
          paddingBottom: '4rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <h2 style={{
          fontSize: 'clamp(1.1rem, 1.8vw, 1.5rem)',
          fontWeight: 600,
          lineHeight: 1.4,
          letterSpacing: '-0.01em',
          color: 'var(--foreground)',
          marginBottom: '1.5rem',
        }}>
          از تصمیمی که با آن روبه‌رو هستی بگو.
        </h2>

        <p style={{
          fontSize: '0.82rem',
          color: 'var(--subtle)',
          lineHeight: 1.8,
          marginBottom: '2rem',
          maxWidth: '52ch',
        }}>
          همه درخواست‌ها پذیرفته نمی‌شوند. پس از بررسی، در صورت تناسب، برای مرحله بعد با تو در تماس خواهم بود.
        </p>

        <ConsultationForm />

        <p style={{
          marginTop: '2rem',
          fontSize: '0.72rem',
          color: 'var(--subtle)',
          lineHeight: 1.75,
          maxWidth: '56ch',
          opacity: 0.75,
        }}>
          این جلسه بر پایه تجربه شخصی، مشاهده، تحقیق و گفت‌وگوهای متعدد شکل گرفته است. جایگزین مشاوره حقوقی، مالی یا تخصصی نیست.
        </p>
      </section>

      <Footer />
    </main>
  )
}
