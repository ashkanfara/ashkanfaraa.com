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

function GoldDot() {
  return (
    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', opacity: 0.75, flexShrink: 0, marginTop: '0.4rem' }} />
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
        <div style={{ maxWidth: '720px' }}>
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
            fontSize: 'clamp(0.95rem, 1.3vw, 1.1rem)',
            color: 'var(--muted)',
            lineHeight: 1.95,
            marginBottom: '2.5rem',
            maxWidth: '54ch',
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
          2 — WHAT YOU AVOID
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
        <Eyebrow>چه چیزی یاد می‌گیری</Eyebrow>

        <h2 style={{
          fontSize: 'clamp(1.4rem, 2.5vw, 2.1rem)',
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: '-0.015em',
          color: 'var(--foreground)',
          marginBottom: '2.75rem',
          maxWidth: '40ch',
        }}>
          اشتباه‌هایی که هزینه‌شان گران است و اغلب دیر شناخته می‌شوند.
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem',
        }}>
          {[
            {
              title: 'اعتماد به وکیلی که «بله» می‌گوید',
              desc: 'خیلی از وکلا و مشاوران کارشان فروش است، نه راهنمایی صادقانه. تفاوت را یاد می‌گیری.',
            },
            {
              title: 'هزینه برای مسیر اشتباه',
              desc: 'کلاس زبان، آزمون، ترجمه و مدرک در مسیری که از ابتدا برای شرایطت مناسب نبوده.',
            },
            {
              title: 'اپلای در زمان اشتباه',
              desc: 'رد شدنی که روی سابقه پرونده‌ات می‌ماند و در مراحل بعدی کار را سخت‌تر می‌کند.',
            },
            {
              title: 'انتخاب کشور بر اساس ترند',
              desc: 'کشورهایی که الان «مد» هستند، لزوماً با شرایط شغلی، سنی یا خانوادگی تو سازگار نیستند.',
            },
            {
              title: 'باور به آمارهای شبکه‌های اجتماعی',
              desc: 'نرخ پذیرش‌ها، مسیرهای تضمینی و تجربه‌های استثنایی که به عنوان قاعده ارائه می‌شوند.',
            },
            {
              title: 'تصمیم بدون تصویر کامل',
              desc: 'هزینه واقعی زندگی، بازار کار، شرایط اقامت و آنچه هیچ ویدیویی نشانت نمی‌دهد.',
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '0.875rem',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
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
          3 — WHAT'S INSIDE
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
          maxWidth: '40ch',
        }}>
          آنچه در هیچ ویدیوی مجانی پیدا نمی‌کنی.
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1px',
          background: 'var(--border)',
          borderRadius: '1rem',
          overflow: 'hidden',
          maxWidth: '860px',
        }}>
          {[
            { num: '۰۱', title: 'واقعیت مهاجرت', desc: 'آنطور که کسی بهت نمی‌گوید. نه برای ترساندن، برای آگاه کردن.' },
            { num: '۰۲', title: 'کشور، ویزا یا مسیر؟', desc: 'چطور بفهمی کدام برای شرایط خاص تو منطقی‌تر است.' },
            { num: '۰۳', title: 'وکیل، مشاور یا خودت؟', desc: 'کجا به متخصص نیاز داری و کجا می‌توانی بدون آن‌ها پیش بروی.' },
            { num: '۰۴', title: 'قبل از اقدام، این‌ها را بدان', desc: 'فهرستی از چیزهایی که پیش از هر خرج یا اقدامی باید بدانی.' },
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
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)', opacity: 0.45, lineHeight: 1 }}>
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
          4 — WHO THIS IS FOR
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
        <Eyebrow>این دوره برای کیست</Eyebrow>

        <h2 style={{
          fontSize: 'clamp(1.4rem, 2.5vw, 2.1rem)',
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: '-0.015em',
          color: 'var(--foreground)',
          marginBottom: '2rem',
          maxWidth: '40ch',
        }}>
          اگر یکی از این‌ها درباره‌ات صدق می‌کند.
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxWidth: '560px' }}>
          {[
            'به مهاجرت فکر می‌کنی اما هنوز تصمیم نگرفته‌ای',
            'از منابع مختلف اطلاعات متناقض گرفته‌ای و گیج شده‌ای',
            'می‌خواهی قبل از هر هزینه‌ای، تصویر واقعی داشته باشی',
            'نگران اشتباه کردن در مرحله‌ای هستی که جبرانش سخت است',
            'به دنبال اطلاعات صادقانه هستی، نه تبلیغ یک مسیر خاص',
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
      </section>

      {/* ══════════════════════════════════════════════════
          5 — PRICE CTA
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
          maxWidth: '720px',
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
            marginBottom: '2rem', maxWidth: '46ch',
          }}>
            یک بار بخر، هر بار که نیاز داری برگرد. همه آنچه باید پیش از تصمیم‌گیری بدانی.
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
              درخواست دسترسی
            </a>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent)' }}>
              ۱۴ میلیون تومان
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          6 — FORM
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
