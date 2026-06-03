import type { Metadata } from 'next'
import { Footer } from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'مشاوره خصوصی مهاجرت — اشکان فارا',
  description: '۴۰ دقیقه مشاوره خصوصی با اشکان فارا. بر اساس شرایط خاص تو، بدون وعده‌های توخالی.',
}

const BOOKING_HREF = 'https://example.com/consultation'

/* ─── shared tokens ─────────────────────────────────────── */
const CONTENT_PADDING = 'clamp(1rem, 2.2vw, 2rem)'
const SECTION_GAP = '5rem'

/* ─── reusable pieces ──────────────────────────────────── */
function SectionEyebrow({ children }: { children: string }) {
  return (
    <div dir="rtl" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, flexShrink: 0 }} />
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--subtle)', margin: 0 }}>
        {children}
      </p>
    </div>
  )
}

function GoldDot() {
  return (
    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', opacity: 0.75, flexShrink: 0, marginTop: '0.45rem' }} />
  )
}

/* ═══════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════ */
export default function ConsultationPage() {
  return (
    <main className="w-full overflow-x-hidden">

      {/* ══════════════════════════════════════════════════
          HERO
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingInline: CONTENT_PADDING,
          paddingTop: '8rem',
          paddingBottom: '5rem',
          background: 'radial-gradient(ellipse at 70% 40%, rgba(196,151,58,0.06) 0%, transparent 60%)',
        }}
      >
        <div style={{ maxWidth: '780px' }}>
          <SectionEyebrow>مشاوره خصوصی مهاجرت</SectionEyebrow>

          <h1
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3.8rem)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              color: 'var(--foreground)',
              marginBottom: '1.75rem',
            }}
          >
            یک جلسه.
            <br />
            مسیر مهاجرتت را روشن کن.
          </h1>

          <div style={{ width: '2.5rem', height: '1px', background: 'var(--accent)', opacity: 0.7, marginBottom: '1.5rem' }} />

          <p style={{ fontSize: 'clamp(1rem, 1.4vw, 1.15rem)', color: 'var(--muted)', lineHeight: 1.85, marginBottom: '2.5rem', maxWidth: '52ch' }}>
            ۴۰ دقیقه مشاوره اختصاصی با اشکان فارا — بر اساس شرایط خاص تو،
            نه یک مسیر کلیشه‌ای که برای همه یکسان است.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <a
              href={BOOKING_HREF}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '9999px',
                background: 'var(--accent)', color: 'var(--accent-fg)',
                padding: '0.875rem 2rem',
                fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.04em',
                textDecoration: 'none', whiteSpace: 'nowrap',
                transition: 'background-color 0.2s',
              }}
            >
              رزرو مشاوره
            </a>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>۶.۹ میلیون تومان</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--subtle)' }}>جلسه ۴۰ دقیقه‌ای · آنلاین</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          WHAT WE COVER
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{ paddingInline: CONTENT_PADDING, paddingTop: SECTION_GAP, paddingBottom: SECTION_GAP }}
      >
        <SectionEyebrow>در این جلسه چه می‌گیری</SectionEyebrow>

        <h2 style={{
          fontSize: 'clamp(1.4rem, 2.5vw, 2.2rem)',
          fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.015em',
          color: 'var(--foreground)', marginBottom: '3rem', maxWidth: '44ch',
        }}>
          هر دقیقه با تمرکز کامل روی مسیر تو.
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {[
            { title: 'ارزیابی وضعیت کنونی', desc: 'بررسی دقیق آنچه داری — مدرک، سابقه کار، سن، وضعیت خانوادگی — و آنچه ممکن است.' },
            { title: 'مسیرهای واقعی و قابل دسترس', desc: 'کدام کشورها و ویزاها با شرایط تو همخوانی دارند. نه آنچه در اینترنت می‌خوانی، آنچه در واقعیت کار می‌کند.' },
            { title: 'نقاط قوت و ضعف پرونده‌ات', desc: 'صادقانه، نه برای دلخوش‌کردن. اینجاست که اکثر مشاوران چیزی نمی‌گویند.' },
            { title: 'اشتباهات رایجی که باید از آن‌ها اجتناب کنی', desc: 'تله‌هایی که مهاجران تازه‌کار بارها تکرار می‌کنند و هزینه‌شان گران است.' },
            { title: 'گام‌های عملی بعدی', desc: 'خروجی جلسه، یک لیست مشخص از کارهایی است که باید بعد از جلسه انجام بدهی.' },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '0.875rem',
                padding: '1.5rem',
                display: 'flex', flexDirection: 'column', gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <GoldDot />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.4, margin: 0 }}>
                  {item.title}
                </h3>
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--muted)', lineHeight: 1.8, margin: 0, paddingRight: '1.25rem' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          WHO IS IT FOR
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: CONTENT_PADDING, paddingTop: SECTION_GAP, paddingBottom: SECTION_GAP,
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3rem' }}>

          {/* For who */}
          <div>
            <SectionEyebrow>این مشاوره برای کیست</SectionEyebrow>
            <h2 style={{
              fontSize: 'clamp(1.4rem, 2.5vw, 2.2rem)',
              fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.015em',
              color: 'var(--foreground)', marginBottom: '2rem', maxWidth: '44ch',
            }}>
              اگر یکی از این‌ها درباره‌ات صدق می‌کند.
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                'مسیر مهاجرتت هنوز برایت مبهم است و نمی‌دانی از کجا شروع کنی.',
                'از چند منبع مختلف اطلاعات متناقض گرفته‌ای و گیج شده‌ای.',
                'می‌خواهی قبل از هر هزینه یا اقدام مهمی، تصویر کاملی داشته باشی.',
                'در میانه مسیر گیر کرده‌ای و نمی‌دانی چطور ادامه بدهی.',
                'پرونده‌ات رد شده و نمی‌دانی دقیقاً چرا و چه باید بکنی.',
              ].map((text) => (
                <div key={text} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    border: '1px solid var(--accent)', flexShrink: 0, marginTop: '0.15rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.75, margin: 0 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Not for who */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0.875rem', padding: '1.5rem 1.75rem',
          }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '1rem' }}>
              این مشاوره برای تو نیست اگر
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                'به دنبال تضمین قطعی نتیجه هستی.',
                'می‌خواهی کسی مدارکت را برایت تنظیم کند.',
                'نیاز به مشاوره حقوقی یا وکیل مهاجرت داری.',
              ].map((text) => (
                <p key={text} style={{ fontSize: '0.85rem', color: 'var(--subtle)', lineHeight: 1.65, margin: 0, paddingRight: '0.5rem', borderRight: '1px solid var(--border-strong)' }}>
                  {text}
                </p>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          HOW THE PROCESS WORKS
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: CONTENT_PADDING, paddingTop: SECTION_GAP, paddingBottom: SECTION_GAP,
          borderTop: '1px solid var(--border)',
        }}
      >
        <SectionEyebrow>مراحل کار</SectionEyebrow>
        <h2 style={{
          fontSize: 'clamp(1.4rem, 2.5vw, 2.2rem)',
          fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.015em',
          color: 'var(--foreground)', marginBottom: '3rem', maxWidth: '44ch',
        }}>
          از لحظه رزرو تا خروجی نهایی.
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1px',
          background: 'var(--border)',
          borderRadius: '1rem',
          overflow: 'hidden',
        }}>
          {[
            { num: '۰۱', title: 'رزرو و پرداخت', desc: 'وقت مناسب خود را انتخاب کن. پرداخت آنلاین و فوری.' },
            { num: '۰۲', title: 'فرم پیش از جلسه', desc: 'وضعیتت را شرح بده تا جلسه کاملاً هدفمند باشد.' },
            { num: '۰۳', title: 'جلسه ۴۰ دقیقه‌ای', desc: 'مشاوره اختصاصی آنلاین با تمرکز کامل روی مسیر تو.' },
            { num: '۰۴', title: 'خلاصه مکتوب', desc: 'نکات کلیدی جلسه ظرف ۲۴ ساعت برایت ارسال می‌شود.' },
          ].map((step) => (
            <div
              key={step.num}
              style={{
                background: 'var(--surface)',
                padding: '2rem 1.5rem',
                display: 'flex', flexDirection: 'column', gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', opacity: 0.5, lineHeight: 1 }}>
                {step.num}
              </span>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', margin: 0, lineHeight: 1.4 }}>
                {step.title}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.8, margin: 0 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FAQ
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: CONTENT_PADDING, paddingTop: SECTION_GAP, paddingBottom: SECTION_GAP,
          borderTop: '1px solid var(--border)',
        }}
      >
        <SectionEyebrow>سوالات متداول</SectionEyebrow>
        <h2 style={{
          fontSize: 'clamp(1.4rem, 2.5vw, 2.2rem)',
          fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.015em',
          color: 'var(--foreground)', marginBottom: '3rem', maxWidth: '44ch',
        }}>
          جواب سوال‌هایی که احتمالاً داری.
        </h2>

        <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '0' }}>
          {[
            {
              q: 'جلسه کجا برگزار می‌شود؟',
              a: 'آنلاین از طریق Google Meet. لینک ورود پس از رزرو برایت ارسال می‌شود.',
            },
            {
              q: 'آیا ضبط جلسه دارم؟',
              a: 'بله. ضبط کامل جلسه ظرف ۲۴ ساعت پس از پایان جلسه برایت ارسال می‌شود.',
            },
            {
              q: 'چه چیزی شامل این مشاوره نمی‌شود؟',
              a: 'تنظیم مدارک، پیگیری پرونده، مشاوره حقوقی، یا تضمین هیچ نتیجه ویزایی. این یک جلسه راهنمایی آگاهانه است، نه خدمت وکالت.',
            },
            {
              q: 'امکان تغییر یا لغو وقت وجود دارد؟',
              a: 'تغییر وقت تا ۴۸ ساعت قبل از جلسه امکان‌پذیر است. پس از این مدت، وقت غیرقابل بازگشت است.',
            },
            {
              q: 'اگر سوالاتم خیلی پایه‌ای باشد چه؟',
              a: 'سوال‌های پایه، دقیقاً همان‌هایی هستند که اگر جواب اشتباه بگیری، بیشترین آسیب را می‌زنند. هیچ سوالی ساده نیست.',
            },
            {
              q: 'زبان جلسه فارسی است؟',
              a: 'بله. جلسه کاملاً به فارسی برگزار می‌شود.',
            },
          ].map((item, i, arr) => (
            <details
              key={item.q}
              style={{
                borderTop: '1px solid var(--border)',
                borderBottom: i === arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <summary
                style={{
                  listStyle: 'none',
                  padding: '1.25rem 0',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  userSelect: 'none',
                }}
              >
                {item.q}
                <span style={{
                  color: 'var(--accent)', fontSize: '1.2rem', lineHeight: 1,
                  flexShrink: 0, opacity: 0.7, fontWeight: 300,
                }}>
                  +
                </span>
              </summary>
              <p style={{
                fontSize: '0.875rem', color: 'var(--muted)',
                lineHeight: 1.85, paddingBottom: '1.25rem',
                margin: 0,
              }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FINAL CTA
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: CONTENT_PADDING,
          paddingTop: SECTION_GAP,
          paddingBottom: SECTION_GAP,
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: '1.25rem',
          padding: 'clamp(2.5rem, 5vw, 4rem) clamp(1.5rem, 4vw, 3.5rem)',
          display: 'flex', flexDirection: 'column', gap: '0',
          backgroundImage: 'radial-gradient(ellipse at 80% 20%, rgba(196,151,58,0.07) 0%, transparent 55%)',
        }}>
          <p style={{
            fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase',
            color: 'var(--accent)', opacity: 0.8, marginBottom: '1.25rem',
          }}>
            شروع کن
          </p>
          <h2 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
            fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em',
            color: 'var(--foreground)', marginBottom: '1rem', maxWidth: '20ch',
          }}>
            اگر سوالی داری، این جلسه برای توست.
          </h2>
          <p style={{
            fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.85,
            marginBottom: '2.5rem', maxWidth: '48ch',
          }}>
            همین سوال‌هایی که الان داری، مهم‌ترین چیزهایی هستند که باید بررسی شوند.
            قبل از هر اقدام دیگری.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <a
              href={BOOKING_HREF}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '9999px',
                background: 'var(--accent)', color: 'var(--accent-fg)',
                padding: '0.875rem 2.25rem',
                fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.04em',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              رزرو مشاوره — ۶.۹ میلیون تومان
            </a>
            <p style={{ fontSize: '0.75rem', color: 'var(--subtle)', margin: 0, lineHeight: 1.6 }}>
              پس از پرداخت، لینک رزرو وقت برایت ارسال می‌شود.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
