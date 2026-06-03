import type { Metadata } from 'next'
import { Footer } from '@/components/layout/Footer'
import { CourseForm } from '@/components/sections/CourseForm'

export const metadata: Metadata = {
  title: 'تله‌های پنهان مهاجرت — اشکان فارا',
  description: 'قبل از هزینه کردن برای مهاجرت، اشتباه‌هایی را بشناس که خیلی‌ها دیر متوجه‌شان می‌شوند.',
}

const PAD = 'clamp(1rem, 5vw, 4rem)'
const GAP = '5.5rem'

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

export default function CoursePage() {
  return (
    <main className="w-full overflow-x-hidden">

      {/* ══════════════════════════════════════════════════
          1 — HERO
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '7rem',
          paddingBottom: '5rem',
          background: 'radial-gradient(ellipse at 65% 35%, rgba(196,151,58,0.055) 0%, transparent 60%)',
        }}
      >
        <div style={{ maxWidth: '680px' }}>
          <Eyebrow>دوره آموزشی</Eyebrow>

          <h1 style={{
            fontSize: 'clamp(2.2rem, 5vw, 4rem)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            color: 'var(--foreground)',
            marginBottom: '1.75rem',
          }}>
            تله‌های پنهان مهاجرت
          </h1>

          <div style={{ width: '2.5rem', height: '1px', background: 'var(--accent)', opacity: 0.7, marginBottom: '1.75rem' }} />

          <p style={{
            fontSize: 'clamp(0.95rem, 1.3vw, 1.05rem)',
            color: 'var(--muted)',
            lineHeight: 1.95,
            marginBottom: '2.5rem',
            maxWidth: '50ch',
          }}>
            قبل از اینکه برای مهاجرت، اپلای، ویزا، کلاس زبان، وکیل یا مسیر اشتباه هزینه کنی، اشتباه‌هایی را بشناس که خیلی‌ها دیر متوجه‌شان می‌شوند.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap' }}>
            <a
              href="#form"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '9999px',
                background: 'var(--accent)', color: 'var(--accent-fg)',
                padding: '0.9rem 2.25rem',
                fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.04em',
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
          2 — THREE KEY MISTAKES
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: GAP,
          paddingBottom: GAP,
          borderTop: '1px solid var(--border)',
        }}
      >
        <Eyebrow>چرا این دوره مهم است</Eyebrow>

        <h2 style={{
          fontSize: 'clamp(1.4rem, 2.5vw, 2.1rem)',
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: '-0.015em',
          color: 'var(--foreground)',
          marginBottom: '3rem',
          maxWidth: '38ch',
        }}>
          سه اشتباه که بیشترین هزینه را می‌سازند.
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', maxWidth: '680px' }}>
          {[
            {
              num: '۰۱',
              title: 'اعتماد به کسی که «بله» می‌گوید',
              desc: 'وکلا و مشاورانی که کارشان فروش است، نه راهنمایی. یاد می‌گیری تفاوت را چطور تشخیص بدهی — قبل از اینکه هزینه کنی.',
            },
            {
              num: '۰۲',
              title: 'هزینه در مسیر اشتباه',
              desc: 'کلاس زبان، آزمون، ترجمه و مدرک برای کشور یا ویزایی که از ابتدا با شرایطت همخوانی نداشته. این اتفاق خیلی بیشتر از آنچه فکر می‌کنی رخ می‌دهد.',
            },
            {
              num: '۰۳',
              title: 'تصمیم بدون تصویر کامل',
              desc: 'هزینه واقعی زندگی، بازار کار، شرایط اقامت و آنچه پشت آمارهای شبکه‌های اجتماعی پنهان است. اطلاعاتی که کسی ساده و صادقانه جمع‌شان نمی‌کند.',
            },
          ].map((item, i, arr) => (
            <div
              key={item.num}
              style={{
                display: 'grid',
                gridTemplateColumns: '3rem 1fr',
                gap: '1.25rem',
                paddingTop: '2rem',
                paddingBottom: '2rem',
                borderTop: '1px solid var(--border)',
                borderBottom: i === arr.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'start',
              }}
            >
              <span style={{
                fontSize: '1.1rem', fontWeight: 700,
                color: 'var(--accent)', opacity: 0.45, lineHeight: 1,
                paddingTop: '0.2rem',
              }}>
                {item.num}
              </span>
              <div>
                <h3 style={{ fontSize: '0.975rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.4, marginBottom: '0.6rem' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.85, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          3 — THREE MODULES
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: GAP,
          paddingBottom: GAP,
          borderTop: '1px solid var(--border)',
        }}
      >
        <Eyebrow>داخل دوره</Eyebrow>

        <h2 style={{
          fontSize: 'clamp(1.4rem, 2.5vw, 2.1rem)',
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: '-0.015em',
          color: 'var(--foreground)',
          marginBottom: '3rem',
          maxWidth: '36ch',
        }}>
          آنچه در هیچ ویدیوی مجانی پیدا نمی‌کنی.
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1px',
          background: 'var(--border)',
          borderRadius: '1rem',
          overflow: 'hidden',
          maxWidth: '780px',
        }}>
          {[
            {
              num: '۰۱',
              title: 'واقعیت مهاجرت',
              desc: 'آنطور که کسی بهت نمی‌گوید. نه برای ترساندن — برای اینکه تصویر کامل داشته باشی.',
            },
            {
              num: '۰۲',
              title: 'کشور، ویزا یا مسیر؟',
              desc: 'چطور بفهمی کدام گزینه با شرایط خاص تو منطقی‌تر است، قبل از هر اقدامی.',
            },
            {
              num: '۰۳',
              title: 'قبل از اقدام، این‌ها را بدان',
              desc: 'آنچه باید پیش از هر هزینه، وکیل یا تصمیم مهمی بدانی.',
            },
          ].map((item) => (
            <div
              key={item.num}
              style={{
                background: 'var(--surface)',
                padding: '2rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)', opacity: 0.4, lineHeight: 1 }}>
                {item.num}
              </span>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', margin: 0, lineHeight: 1.4 }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.8, margin: 0 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          4 — PRICE / ACCESS CTA
          ══════════════════════════════════════════════════ */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: GAP,
          paddingBottom: GAP,
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: '1.25rem',
          padding: 'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 4vw, 3rem)',
          backgroundImage: 'radial-gradient(ellipse at 80% 20%, rgba(196,151,58,0.065) 0%, transparent 55%)',
          maxWidth: '680px',
        }}>
          <p style={{
            fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase',
            color: 'var(--accent)', opacity: 0.8, marginBottom: '1.25rem',
          }}>
            دسترسی به دوره
          </p>

          <h2 style={{
            fontSize: 'clamp(1.4rem, 2.8vw, 2.2rem)',
            fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em',
            color: 'var(--foreground)', marginBottom: '0.75rem',
          }}>
            تله‌های پنهان مهاجرت
          </h2>

          <p style={{
            fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.8,
            marginBottom: '2rem', maxWidth: '44ch',
          }}>
            یک بار بخر، هر وقت نیاز داشتی برگرد. اطلاعاتی که قبل از هر تصمیم مهمی باید داشته باشی.
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
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent)' }}>
              ۱۴ میلیون تومان
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          5 — FORM
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
        <Eyebrow>درخواست دسترسی</Eyebrow>

        <h2 style={{
          fontSize: 'clamp(1.1rem, 1.8vw, 1.5rem)',
          fontWeight: 600,
          lineHeight: 1.4,
          letterSpacing: '-0.01em',
          color: 'var(--foreground)',
          marginBottom: '1rem',
        }}>
          اطلاعات زیر را وارد کن.
        </h2>

        <p style={{
          fontSize: '0.82rem',
          color: 'var(--subtle)',
          lineHeight: 1.8,
          marginBottom: '2.5rem',
          maxWidth: '52ch',
        }}>
          پس از بررسی درخواست، اطلاعات پرداخت از طریق اینستاگرام ارسال می‌شود.
        </p>

        <CourseForm />

        <p style={{
          marginTop: '2rem',
          fontSize: '0.72rem',
          color: 'var(--subtle)',
          lineHeight: 1.75,
          maxWidth: '56ch',
          opacity: 0.75,
        }}>
          این دوره بر پایه تجربه شخصی، مشاهده و تحقیق تهیه شده است. جایگزین مشاوره حقوقی، مالی یا تخصصی نیست.
        </p>
      </section>

      <Footer />
    </main>
  )
}
