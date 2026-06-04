import type { Metadata } from 'next'
import Image from 'next/image'
import { Footer } from '@/components/layout/Footer'
import { ConsultationForm } from '@/components/sections/ConsultationForm'

export const metadata: Metadata = {
  title: 'جلسه خصوصی تصمیم‌گیری — اشکان فارا',
  description: 'قبل از تصمیم‌های بزرگ، تصویر کامل را ببین. جلسه خصوصی با اشکان فارا درباره مهاجرت، تحصیل، کار و فرصت‌های بین‌المللی.',
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

      {/* ══════════════════════════════════════════════════
          HERO — image left, text right
          ══════════════════════════════════════════════════ */}
      {/* Back button */}
      <div dir="rtl" style={{ paddingInline: PAD, paddingTop: '5rem', paddingBottom: '1rem' }}>
        <a
          href="/"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            fontSize: '0.78rem', color: 'var(--subtle)',
            textDecoration: 'none', transition: 'color 0.15s',
          }}
        >
          <span style={{ fontSize: '0.85rem' }}>←</span>
          بازگشت
        </a>
      </div>

      <section style={{ paddingInline: PAD, paddingTop: '1.5rem', paddingBottom: '3rem' }}>

        {/*
          dir="ltr" on the grid so column order is physical left→right
          regardless of the document's RTL direction.
          The text column gets its own dir="rtl".
        */}
        <div
          dir="ltr"
          className="grid grid-cols-1 md:grid-cols-[45fr_55fr] items-center gap-10 md:gap-14"
        >

          {/* ── Left: image ── */}
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

          {/* ── Right: text ── */}
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
              اگر در آستانه یک تصمیم مهم هستی، این جلسه برای کمک به شفاف‌تر شدن تصویر طراحی شده است. از مهاجرت و تحصیل گرفته تا کسب‌وکار، سرمایه‌گذاری، خرید ملک در استرالیا یا انتخاب مسیر بعدی زندگی.
              <br /><br />
              هدف این جلسه ارائه نسخه آماده نیست. هدف این است که قبل از صرف زمان، پول و انرژی، تصمیم آگاهانه‌تری بگیری.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <a
                href="#form"
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
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent)' }}>
                جلسات از ۲۵۰ دلار استرالیا آغاز می‌شوند.
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FORM
          ══════════════════════════════════════════════════ */}
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
          قبل از ثبت درخواست، کمی از شرایطت بگو.
        </h2>

        <p style={{
          fontSize: '0.82rem',
          color: 'var(--subtle)',
          lineHeight: 1.8,
          marginBottom: '2rem',
          maxWidth: '52ch',
        }}>
          همه درخواست‌ها پذیرفته نمی‌شوند. پس از بررسی درخواست، در صورت مناسب بودن شرایط برای هماهنگی تماس خواهیم گرفت.
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
