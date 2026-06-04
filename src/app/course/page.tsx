import type { Metadata } from 'next'
import { Footer } from '@/components/layout/Footer'
import { CourseForm } from '@/components/sections/CourseForm'

export const metadata: Metadata = {
  title: 'تله‌های پنهان مهاجرت — اشکان فارا',
  description: 'قبل از هزینه کردن برای مهاجرت، اشتباه‌هایی را بشناس که خیلی‌ها دیر متوجه‌شان می‌شوند.',
}

const PAD = 'clamp(1rem, 5vw, 4rem)'
const GAP = '3.5rem'   // tightened from 5.5rem

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

// Real audio modules from the Telegram course.
// TODO: fill in actual durations (e.g. '۱۲:۳۰') once available.
const MODULES = [
  { title: 'مقدمه',                                               duration: '' },
  { title: 'دید باز و خلاصه‌ای از زندگیم و ویدیو من',             duration: '' },
  { title: 'بررسی علت مهاجرت (پارت ۱)',                           duration: '' },
  { title: 'بررسی علت مهاجرت (پارت ۲)',                           duration: '' },
  { title: 'دام‌های احساسی',                                       duration: '' },
  { title: 'دام‌های مالی',                                         duration: '' },
  { title: 'دام‌های شغلی و تحصیلی',                               duration: '' },
  { title: 'فرهنگ دوست‌یابی و تفاوت‌ها با ایران',                  duration: '' },
  { title: 'فرهنگ ایرانی‌های خارج و چرا فاصله دارند',              duration: '' },
  { title: 'پارتنر خارجی vs پارتنر ایرانی',                       duration: '' },
  { title: 'تفاوت فرهنگی و قانونی کشور مقصد',                     duration: '' },
  { title: 'جمع‌بندی',                                             duration: '' },
]

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
          paddingTop: '6.5rem',
          paddingBottom: '3.5rem',
          background: 'radial-gradient(ellipse at 65% 35%, rgba(196,151,58,0.055) 0%, transparent 60%)',
        }}
      >
        <div style={{ maxWidth: '660px' }}>
          <Eyebrow>دوره آموزشی</Eyebrow>

          <h1 style={{
            fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            color: 'var(--foreground)',
            marginBottom: '1.5rem',
          }}>
            تله‌های پنهان مهاجرت
          </h1>

          <div style={{ width: '2.5rem', height: '1px', background: 'var(--accent)', opacity: 0.7, marginBottom: '1.5rem' }} />

          <p style={{
            fontSize: 'clamp(0.9rem, 1.2vw, 1rem)',
            color: 'var(--muted)',
            lineHeight: 1.9,
            marginBottom: '2.25rem',
            maxWidth: '50ch',
          }}>
            قبل از اینکه برای مهاجرت، اپلای، ویزا، کلاس زبان، وکیل یا مسیر اشتباه هزینه کنی، اشتباه‌هایی را بشناس که خیلی‌ها دیر متوجه‌شان می‌شوند.
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
          fontSize: 'clamp(1.3rem, 2.2vw, 1.9rem)',
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: '-0.015em',
          color: 'var(--foreground)',
          marginBottom: '2rem',
          maxWidth: '38ch',
        }}>
          سه اشتباه که بیشترین هزینه را می‌سازند.
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', maxWidth: '660px' }}>
          {[
            {
              num: '۰۱',
              title: 'اعتماد به کسی که «بله» می‌گوید',
              desc: 'وکلا و مشاورانی که کارشان فروش است، نه راهنمایی. یاد می‌گیری تفاوت را چطور تشخیص بدهی — قبل از اینکه هزینه کنی.',
            },
            {
              num: '۰۲',
              title: 'هزینه در مسیر اشتباه',
              desc: 'کلاس زبان، آزمون، ترجمه و مدرک برای کشور یا ویزایی که از ابتدا با شرایطت همخوانی نداشته.',
            },
            {
              num: '۰۳',
              title: 'تصمیم بدون تصویر کامل',
              desc: 'هزینه واقعی زندگی، بازار کار، شرایط اقامت — اطلاعاتی که کسی ساده و صادقانه جمع‌شان نمی‌کند.',
            },
          ].map((item, i, arr) => (
            <div
              key={item.num}
              style={{
                display: 'grid',
                gridTemplateColumns: '2.75rem 1fr',
                gap: '1rem',
                paddingTop: '1.5rem',
                paddingBottom: '1.5rem',
                borderTop: '1px solid var(--border)',
                borderBottom: i === arr.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'start',
              }}
            >
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent)', opacity: 0.45, lineHeight: 1, paddingTop: '0.2rem' }}>
                {item.num}
              </span>
              <div>
                <h3 style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.4, marginBottom: '0.4rem' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '0.83rem', color: 'var(--muted)', lineHeight: 1.8, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          3 — AUDIO MODULES
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
        <Eyebrow>محتوای دوره</Eyebrow>

        <h2 style={{
          fontSize: 'clamp(1.3rem, 2.2vw, 1.9rem)',
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: '-0.015em',
          color: 'var(--foreground)',
          marginBottom: '2rem',
          maxWidth: '36ch',
        }}>
          ۱۲ فایل صوتی. صادقانه و بدون فیلتر.
        </h2>

        <div style={{ maxWidth: '620px', display: 'flex', flexDirection: 'column', gap: '0' }}>
          {MODULES.map((mod, i) => (
            <div
              key={mod.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                paddingTop: '0.9rem',
                paddingBottom: '0.9rem',
                borderTop: '1px solid var(--border)',
                borderBottom: i === MODULES.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--subtle)', opacity: 0.6, minWidth: '1.5rem', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
                  {mod.title}
                </span>
              </div>
              {mod.duration && (
                <span style={{ fontSize: '0.75rem', color: 'var(--subtle)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {mod.duration}
                </span>
              )}
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
        <Eyebrow>این دوره مناسب چه کسانی است</Eyebrow>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '560px', marginTop: '1.5rem' }}>
          {[
            'می‌خواهی قبل از هر هزینه‌ای، تصویر واقعی داشته باشی',
            'از منابع مختلف اطلاعات متناقض گرفته‌ای و نمی‌دانی به کدام اعتماد کنی',
            'نگران اشتباه کردن در مرحله‌ای هستی که جبرانش سخت است',
            'قبل از مراجعه به وکیل یا مشاور، می‌خواهی خودت بفهمی چه می‌خواهی',
            'به دنبال دیدگاه صادقانه‌ای هستی، نه تبلیغ یک مسیر خاص',
          ].map((text) => (
            <div key={text} style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
              <div style={{
                width: '16px', height: '16px', borderRadius: '50%',
                border: '1px solid var(--accent)', flexShrink: 0, marginTop: '0.2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)' }} />
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.75, margin: 0 }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          5 — PRICE / ACCESS CTA
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
          padding: 'clamp(1.75rem, 3.5vw, 2.75rem) clamp(1.5rem, 4vw, 3rem)',
          backgroundImage: 'radial-gradient(ellipse at 80% 20%, rgba(196,151,58,0.065) 0%, transparent 55%)',
          maxWidth: '660px',
        }}>
          <p style={{
            fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase',
            color: 'var(--accent)', opacity: 0.8, marginBottom: '1rem',
          }}>
            دسترسی به دوره
          </p>

          <h2 style={{
            fontSize: 'clamp(1.3rem, 2.5vw, 2rem)',
            fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em',
            color: 'var(--foreground)', marginBottom: '0.625rem',
          }}>
            تله‌های پنهان مهاجرت
          </h2>

          <p style={{
            fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.8,
            marginBottom: '1.75rem', maxWidth: '44ch',
          }}>
            یک بار بخر، هر وقت نیاز داشتی برگرد.
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
          6 — FORM
          ══════════════════════════════════════════════════ */}
      <section
        id="form"
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '3rem',
          paddingBottom: '4.5rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <Eyebrow>درخواست دسترسی</Eyebrow>

        <h2 style={{
          fontSize: 'clamp(1.1rem, 1.8vw, 1.4rem)',
          fontWeight: 600,
          lineHeight: 1.4,
          letterSpacing: '-0.01em',
          color: 'var(--foreground)',
          marginBottom: '0.875rem',
        }}>
          اطلاعات زیر را وارد کن.
        </h2>

        <p style={{
          fontSize: '0.82rem',
          color: 'var(--subtle)',
          lineHeight: 1.8,
          marginBottom: '2rem',
          maxWidth: '52ch',
        }}>
          پس از بررسی درخواست، اطلاعات پرداخت از طریق اینستاگرام ارسال می‌شود.
        </p>

        <CourseForm />

        <p style={{
          marginTop: '1.75rem',
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
