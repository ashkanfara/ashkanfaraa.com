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
      <section style={{ paddingInline: PAD, paddingTop: '6rem', paddingBottom: '4.5rem' }}>

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
              اگر بین چند مسیر مختلف گیر کرده‌ای، این جلسه برای کمک به تصمیم‌گیری بهتر طراحی شده است؛ درباره مهاجرت، تحصیل، کار، زندگی در کشورهای مختلف، راه‌اندازی کسب‌وکار، خرید ملک در استرالیا یا فرصت‌های مهمی که پیش رویت قرار گرفته‌اند.
              <br /><br />
              هدف این جلسه فروش چیزی نیست. هدف این است که قبل از تصمیم‌های مهم، تصویر کامل‌تری داشته باشی.
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
                درخواست بررسی جلسه
              </a>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent)' }}>
                شروع از ۶.۹ میلیون تومان
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
          paddingTop: '4rem',
          paddingBottom: '6rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <h2 style={{
          fontSize: 'clamp(1.1rem, 1.8vw, 1.5rem)',
          fontWeight: 600,
          lineHeight: 1.4,
          letterSpacing: '-0.01em',
          color: 'var(--foreground)',
          marginBottom: '2.5rem',
        }}>
          قبل از رزرو، کمی از شرایطت بگو.
        </h2>

        <p style={{
          fontSize: '0.82rem',
          color: 'var(--subtle)',
          lineHeight: 1.8,
          marginBottom: '2.5rem',
          maxWidth: '52ch',
        }}>
          همه درخواست‌ها پذیرفته نمی‌شوند. اگر احساس کنم این جلسه واقعاً می‌تواند برای شرایطت مفید باشد، برای هماهنگی مرحله بعد با تو تماس می‌گیریم.
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
