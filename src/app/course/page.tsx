import type { Metadata } from 'next'
import { Footer } from '@/components/layout/Footer'
import { CourseForm } from '@/components/sections/CourseForm'

export const metadata: Metadata = {
  title: 'تله‌های پنهان مهاجرت — اشکان فارا',
  description: 'قبل از مهاجرت، تصویر کامل‌تری از مسیر پیش رو داشته باش.',
}

const PAD = 'clamp(1rem, 5vw, 4rem)'

function Eyebrow({ children }: { children: string }) {
  return (
    <div dir="rtl" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.1rem' }}>
      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, flexShrink: 0 }} />
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--subtle)', margin: 0 }}>
        {children}
      </p>
    </div>
  )
}

const MODULES = [
  { title: 'چرا این دوره را ساختم' },
  { title: 'مسیری که طی کردم' },
  { title: 'دلیل واقعی مهاجرت' },
  { title: 'مهاجرت آن چیزی نیست که فکر می‌کنی' },
  { title: 'دام‌های احساسی' },
  { title: 'دام‌های مالی' },
  { title: 'دام‌های شغلی و تحصیلی' },
  { title: 'دوستی و روابط در کشور جدید' },
  { title: 'ایرانی‌های خارج و فاصله‌ای که می‌گذارند' },
  { title: 'پارتنر خارجی vs پارتنر ایرانی' },
  { title: 'تفاوت‌های فرهنگی و قانونی کشور مقصد' },
  { title: 'قبل از اینکه بروی' },
]

export default function CoursePage() {
  return (
    <main className="w-full overflow-x-hidden">

      {/* ══════════════════════════════════════════════════
          1. HERO
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '4.5rem',
          paddingBottom: '3rem',
          background: 'radial-gradient(ellipse at 65% 35%, rgba(196,151,58,0.05) 0%, transparent 60%)',
        }}
      >
        <div style={{ maxWidth: '660px' }}>
          <Eyebrow>دوره آموزشی</Eyebrow>

          <h1 style={{
            fontSize: 'clamp(2.4rem, 5.5vw, 4.2rem)',
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            color: 'var(--foreground)',
            margin: 0,
          }}>
            تله‌های پنهان مهاجرت
          </h1>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          2. CORE STATEMENT
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '3.5rem',
          paddingBottom: '3.5rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <p style={{
          fontSize: 'clamp(1.2rem, 2.2vw, 1.7rem)',
          fontWeight: 500,
          lineHeight: 1.65,
          letterSpacing: '-0.02em',
          color: 'var(--foreground)',
          maxWidth: '34ch',
          margin: 0,
        }}>
          بیشتر اشتباهات مهاجرتی قبل از مهاجرت اتفاق نمی‌افتند.
          <br />
          بعد از آن اتفاق می‌افتند.
        </p>
      </section>

      {/* ══════════════════════════════════════════════════
          3. MODULE LIST
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '3rem',
          paddingBottom: '3rem',
          borderTop: '1px solid var(--border)',
          background: 'radial-gradient(ellipse at 30% 50%, rgba(196,151,58,0.04) 0%, transparent 65%)',
        }}
      >
        <p style={{
          fontSize: '0.72rem',
          letterSpacing: '0.06em',
          color: 'var(--subtle)',
          marginBottom: '1.75rem',
          opacity: 0.75,
        }}>
          چیزهایی که کسی قبل از رفتن به تو نمی‌گوید.
        </p>

        <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '0' }}>
          {MODULES.map((mod, i) => (
            <div
              key={mod.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                paddingTop: '0.9rem',
                paddingBottom: '0.9rem',
                borderTop: '1px solid var(--border)',
                borderBottom: i === MODULES.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{
                fontSize: '0.65rem', color: 'var(--subtle)', opacity: 0.45,
                minWidth: '1.5rem', fontVariantNumeric: 'tabular-nums', flexShrink: 0,
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '1rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
                {mod.title}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          4. CTA / PRICE
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '3.5rem',
          paddingBottom: '3.5rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          <a
            href="#form"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '9999px',
              background: 'var(--accent)', color: 'var(--accent-fg)',
              padding: '0.875rem 2.25rem',
              fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.04em',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            درخواست دسترسی به دوره
          </a>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>
            ۹.۹ میلیون تومان
          </span>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--subtle)', margin: 0 }}>
          قیمت اولیه برای اولین گروه شرکت‌کنندگان
        </p>
      </section>

      {/* ══════════════════════════════════════════════════
          5. FORM
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
        <Eyebrow>درخواست دسترسی</Eyebrow>

        <h2 style={{
          fontSize: 'clamp(1rem, 1.6vw, 1.3rem)',
          fontWeight: 600,
          lineHeight: 1.4,
          color: 'var(--foreground)',
          marginBottom: '0.75rem',
        }}>
          برای دریافت دسترسی، اطلاعات زیر را بفرست.
        </h2>

        <p style={{
          fontSize: '0.8rem',
          color: 'var(--subtle)',
          lineHeight: 1.8,
          marginBottom: '2rem',
          maxWidth: '48ch',
        }}>
          پس از بررسی، اطلاعات پرداخت از طریق اینستاگرام ارسال می‌شود.
        </p>

        <CourseForm />

        <p style={{
          marginTop: '1.75rem',
          fontSize: '0.7rem',
          color: 'var(--subtle)',
          lineHeight: 1.75,
          maxWidth: '52ch',
          opacity: 0.65,
        }}>
          این دوره بر پایه تجربه شخصی است. جایگزین مشاوره حقوقی یا تخصصی نیست.
        </p>
      </section>

      <Footer />
    </main>
  )
}
