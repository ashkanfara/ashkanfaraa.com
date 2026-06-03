import type { Metadata } from 'next'
import Image from 'next/image'
import { Footer } from '@/components/layout/Footer'
import { ConsultationForm } from '@/components/sections/ConsultationForm'

export const metadata: Metadata = {
  title: 'مشاوره خصوصی مهاجرت — اشکان فارا',
  description: '۴۰ دقیقه مشاوره خصوصی با اشکان فارا. بر اساس شرایط خاص تو، بدون وعده‌های توخالی.',
}

const CONTENT_PADDING = 'clamp(1.25rem, 5vw, 4rem)'

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

export default function ConsultationPage() {
  return (
    <main className="w-full overflow-x-hidden">

      {/* ══════════════════════════════════════════════════
          1 — HERO (two-column on desktop, stacked on mobile)
          ══════════════════════════════════════════════════ */}
      <section
        style={{
          paddingInline: CONTENT_PADDING,
          paddingTop: '6rem',
          paddingBottom: '4rem',
        }}
      >
        {/* Grid: image left, text right on desktop / stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-[45fr_55fr] items-center gap-10 md:gap-16">

          {/* ── Image column ── */}
          <div
            className="w-full aspect-[4/3] md:aspect-[4/5]"
            style={{
              position: 'relative',
              borderRadius: '0.875rem',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <Image
              src="/images/card-consultation.png"
              alt="مشاوره خصوصی اشکان فارا"
              fill
              priority
              className="object-cover object-top"
              sizes="(max-width: 768px) 100vw, 45vw"
            />
          </div>

          {/* ── Text column ── */}
          <div dir="rtl">
            <Eyebrow>مشاوره خصوصی مهاجرت</Eyebrow>

            <h1 style={{
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              color: 'var(--foreground)',
              marginBottom: '1.5rem',
            }}>
              یک جلسه.
              <br />
              مسیر مهاجرتت را روشن کن.
            </h1>

            <div style={{ width: '2.5rem', height: '1px', background: 'var(--accent)', opacity: 0.7, marginBottom: '1.5rem' }} />

            <p style={{
              fontSize: 'clamp(0.9rem, 1.2vw, 1.05rem)',
              color: 'var(--muted)',
              lineHeight: 1.9,
              marginBottom: '2.25rem',
              maxWidth: '46ch',
            }}>
              اگر بین چند مسیر، کشور، و تصمیم مختلف گیر کرده‌ای، این جلسه برای این است که شرایطت را دقیق ببینیم و قبل از خرج کردن وقت و پول، مسیر درست‌تری انتخاب کنی.
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
                شروع رزرو مشاوره
              </a>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.975rem', fontWeight: 700, color: 'var(--accent)' }}>
                  ۶.۹ میلیون تومان
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--subtle)' }}>
                  ۴۰ دقیقه · آنلاین
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          2 — FORM
          ══════════════════════════════════════════════════ */}
      <section
        id="form"
        dir="rtl"
        style={{
          paddingInline: CONTENT_PADDING,
          paddingTop: '4rem',
          paddingBottom: '6rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <Eyebrow>رزرو جلسه</Eyebrow>

        <h2 style={{
          fontSize: 'clamp(1.2rem, 2vw, 1.65rem)',
          fontWeight: 600,
          lineHeight: 1.35,
          letterSpacing: '-0.015em',
          color: 'var(--foreground)',
          marginBottom: '2.5rem',
        }}>
          اطلاعات زیر را وارد کن.
        </h2>

        <ConsultationForm />

        <p style={{
          marginTop: '2rem',
          fontSize: '0.75rem',
          color: 'var(--subtle)',
          lineHeight: 1.7,
          maxWidth: '52ch',
          opacity: 0.8,
        }}>
          من وکیل مهاجرت نیستم، این جلسه مشاوره حقوقی نیست و هیچ نتیجه ویزایی را تضمین نمی‌کند.
        </p>
      </section>

      <Footer />
    </main>
  )
}
