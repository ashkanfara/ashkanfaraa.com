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

// TODO: fill in real durations once available, e.g. '۱۲:۳۰'
const MODULES = [
  { title: 'مقدمه' },
  { title: 'دید باز و خلاصه‌ای از زندگیم و ویدیو من' },
  { title: 'بررسی علت مهاجرت (پارت ۱)' },
  { title: 'بررسی علت مهاجرت (پارت ۲)' },
  { title: 'دام‌های احساسی' },
  { title: 'دام‌های مالی' },
  { title: 'دام‌های شغلی و تحصیلی' },
  { title: 'فرهنگ دوست‌یابی و تفاوت‌ها با ایران' },
  { title: 'فرهنگ ایرانی‌های خارج و چرا فاصله دارند' },
  { title: 'پارتنر خارجی vs پارتنر ایرانی' },
  { title: 'تفاوت فرهنگی و قانونی کشور مقصد' },
  { title: 'جمع‌بندی' },
]

const statement: React.CSSProperties = {
  fontSize: 'clamp(1.1rem, 1.9vw, 1.5rem)',
  fontWeight: 500,
  lineHeight: 1.75,
  color: 'var(--foreground)',
  letterSpacing: '-0.01em',
  margin: 0,
}

export default function CoursePage() {
  return (
    <main className="w-full overflow-x-hidden">

      {/* ══════════════════════════════════════════════════
          HERO
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '6.5rem',
          paddingBottom: '5rem',
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
            marginBottom: '2.5rem',
          }}>
            تله‌های پنهان مهاجرت
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>
                ۹.۹ میلیون تومان
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--subtle)' }}>
                قیمت اولیه برای اولین گروه شرکت‌کنندگان
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          WHY THIS EXISTS
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '5rem',
          paddingBottom: '5rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <p style={{ ...statement, maxWidth: '36ch' }}>
          بیشتر اشتباهات مهاجرتی قبل از مهاجرت اتفاق نمی‌افتند.
          <br />
          بعد از آن اتفاق می‌افتند.
        </p>
      </section>

      {/* ══════════════════════════════════════════════════
          WHAT THIS IS
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '5rem',
          paddingBottom: '5rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <p style={{ ...statement, maxWidth: '32ch', color: 'var(--muted)' }}>
          ۱۲ فایل صوتی.
          <br />
          سال‌ها تجربه زندگی، کار و تحصیل در کشورهای مختلف.
          <br />
          بدون فیلتر. بدون شعار.
        </p>
      </section>

      {/* ══════════════════════════════════════════════════
          MODULE LIST
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '4rem',
          paddingBottom: '4rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '0' }}>
          {MODULES.map((mod, i) => (
            <div
              key={mod.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                paddingTop: '0.875rem',
                paddingBottom: '0.875rem',
                borderTop: '1px solid var(--border)',
                borderBottom: i === MODULES.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{
                fontSize: '0.68rem', color: 'var(--subtle)', opacity: 0.55,
                minWidth: '1.5rem', fontVariantNumeric: 'tabular-nums', flexShrink: 0,
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
                {mod.title}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          VALUE
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '5rem',
          paddingBottom: '5rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <p style={{ ...statement, maxWidth: '38ch', color: 'var(--muted)' }}>
          بعضی از این درس‌ها را در چند ساعت یاد می‌گیری.
          <br />
          بعضی افراد برای یاد گرفتنشان چند سال زمان می‌دهند.
        </p>
      </section>

      {/* ══════════════════════════════════════════════════
          FINAL CTA
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '5rem',
          paddingBottom: '5rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{ maxWidth: '660px' }}>
          <p style={{ ...statement, maxWidth: '40ch', marginBottom: '3rem' }}>
            قبل از اینکه چند سال از زندگی‌ات را روی یک تصمیم بزرگ سرمایه‌گذاری کنی،
            <br />
            تصویر کامل‌تری از مسیر پیش رو داشته باش.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
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
              ۱۴ میلیون تومان
            </span>
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
          paddingTop: '3.5rem',
          paddingBottom: '5rem',
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
          اطلاعات زیر را وارد کن.
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
