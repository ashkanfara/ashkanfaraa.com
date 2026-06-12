'use client'

import { useState, useRef, useCallback } from 'react'
import { CourseForm }  from './CourseForm'
import { AudioPlayer } from '@/components/ui/AudioPlayer'
import { Testimonials } from './Testimonials'

const PAD = 'clamp(1rem, 5vw, 4rem)'

function Eyebrow({ children }: { children: string }) {
  return (
    <div dir="rtl" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.75rem' }}>
      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, flexShrink: 0 }} />
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--subtle)', margin: 0 }}>
        {children}
      </p>
    </div>
  )
}

// ── Audio previews ─────────────────────────────────────────────
// Drop the three files in /public/audio/ when ready.
// Until then, the player renders but audio is silent.
const PREVIEWS = [
  {
    src:   '/audio/preview-1.mp3',
    name:  'فرهنگ دوست‌یابی و تفاوتش با ایران',
    label: 'پیش‌نمایش دوره',
  },
  {
    src:   '/audio/preview-2.mp3',
    name:  'مهاجرت برای فرزند یا برای خودت؟',
    label: 'پیش‌نمایش دوره',
  },
  {
    src:   '/audio/preview-3.mp3',
    name:  'دوستی، رابطه و تنهایی بعد از مهاجرت',
    label: 'پیش‌نمایش دوره',
  },
]

// ── Topics ─────────────────────────────────────────────────────
const TOPICS = [
  'چرا بعضی افراد از مهاجرت پشیمان می‌شوند اما درباره‌اش حرف نمی‌زنند',
  'تفاوت تصویر مهاجرت در شبکه‌های اجتماعی با زندگی واقعی',
  'دوستی‌ها، روابط و تنهایی بعد از مهاجرت',
  'اشتباهاتی که قبل از مهاجرت دیده نمی‌شوند',
  'نقش انتظارات در رضایت یا نارضایتی از مهاجرت',
  'چیزهایی که ای کاش قبل از مهاجرت می‌دانستم',
]

// ── Testimonials content override ──────────────────────────────
const courseTestimonialsContent = {
  sectionLabel: 'نظر خریداران',
  subtext:      'نظر کسانی که دوره را شنیده‌اند.',
  items: [
    {
      id:    'testimonial-1',
      name:  'شادی م.',
      label: 'خریدار دوره',
      quote: 'قبل از این جلسه فکر می‌کردم جواب‌ها را دارم.',
      src:   '/audio/testimonial-1.mp3',
    },
    {
      id:    'testimonial-2',
      name:  'عسل ج.',
      label: 'خریدار دوره',
      quote: 'اولین باری بود که کسی سوال‌های درست را می‌پرسید.',
      src:   '/audio/testimonial-2.mp3',
    },
    {
      id:    'testimonial-3',
      name:  'بابک ک.',
      label: 'خریدار دوره',
      quote: 'بعد از یک ساعت، چیزهایی دیدم که دو سال نادیده گرفته بودم.',
      src:   '/audio/testimonial-3.mp3',
    },
  ],
}

export function CoursePageShell() {
  const [fading, setFading] = useState(false)
  const [hidden, setHidden] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  const enterPaymentMode = useCallback(() => {
    setFading(true)
    setTimeout(() => {
      setHidden(true)
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 480)
  }, [])

  const fadeStyle: React.CSSProperties = {
    opacity:       fading ? 0 : 1,
    transition:    'opacity 0.4s ease',
    pointerEvents: fading ? 'none' : 'auto',
  }

  return (
    <>
      {/* 1. HERO */}
      {!hidden && (
        <section
          dir="rtl"
          style={{
            ...fadeStyle,
            paddingInline: PAD,
            paddingTop: '5rem',
            paddingBottom: '2rem',
            background: 'radial-gradient(ellipse at 65% 35%, rgba(196,151,58,0.05) 0%, transparent 60%)',
          }}
        >
          <div style={{ maxWidth: '580px' }}>
            <Eyebrow>دوره آموزشی</Eyebrow>

            <h1 style={{
              fontSize:      'clamp(2.4rem, 5.5vw, 4.2rem)',
              fontWeight:    700,
              lineHeight:    1.08,
              letterSpacing: '-0.03em',
              color:         'var(--foreground)',
              marginBottom:  '1rem',
            }}>
              تله‌های پنهان مهاجرت
            </h1>

            <p style={{
              fontSize:      'clamp(0.9rem, 1.3vw, 1.05rem)',
              fontWeight:    400,
              lineHeight:    1.8,
              color:         'var(--muted)',
              letterSpacing: '-0.01em',
              marginBottom:  '1.25rem',
              maxWidth:      '38ch',
            }}>
              چیزهایی که کاش قبل از رفتن می‌دانستی.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <a
                href="#form"
                className="btn-gold"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '9999px',
                  background: 'var(--accent)', color: 'var(--accent-fg)',
                  padding: '0.8rem 2rem',
                  fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.04em',
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                درخواست دسترسی به دوره
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
              ۹.۹ میلیون تومان · قیمت اولیه برای اولین گروه
            </p>
          </div>
        </section>
      )}

      {/* 2. CORE STATEMENT */}
      {!hidden && (
        <section
          dir="rtl"
          style={{
            ...fadeStyle,
            paddingInline: PAD,
            paddingTop:    '2rem',
            paddingBottom: '2rem',
            borderTop:     '1px solid var(--border)',
          }}
        >
          <p style={{
            fontSize:      'clamp(1.2rem, 2.2vw, 1.7rem)',
            fontWeight:    500,
            lineHeight:    1.65,
            letterSpacing: '-0.02em',
            color:         'var(--foreground)',
            maxWidth:      '34ch',
            margin:        0,
          }}>
            بیشتر اشتباهات مهاجرتی قبل از مهاجرت اتفاق نمی‌افتند.
            <br />
            بعد از آن اتفاق می‌افتند.
          </p>
        </section>
      )}

      {/* 3. WHY THIS COURSE EXISTS */}
      {!hidden && (
        <section
          dir="rtl"
          style={{
            ...fadeStyle,
            paddingInline: PAD,
            paddingTop:    '2.5rem',
            paddingBottom: '2.5rem',
            borderTop:     '1px solid var(--border)',
          }}
        >
          <Eyebrow>چرا این دوره ساخته شد؟</Eyebrow>

          <div style={{ maxWidth: '48ch', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: 'clamp(0.9rem, 1.2vw, 1rem)', color: 'var(--muted)', lineHeight: 2, margin: 0 }}>
              این دوره برای ترساندن کسی از مهاجرت ساخته نشده.
            </p>
            <p style={{ fontSize: 'clamp(0.9rem, 1.2vw, 1rem)', color: 'var(--muted)', lineHeight: 2, margin: 0 }}>
              برای منصرف کردن کسی هم ساخته نشده.
            </p>
            <p style={{ fontSize: 'clamp(0.9rem, 1.2vw, 1rem)', color: 'var(--foreground)', lineHeight: 2, margin: 0, fontWeight: 500 }}>
              این دوره برای دیدن بخش‌هایی از مهاجرت ساخته شده که معمولاً بعد از خرید بلیت دیده می‌شوند.
            </p>
            <p style={{ fontSize: 'clamp(0.85rem, 1.1vw, 0.95rem)', color: 'var(--subtle)', lineHeight: 1.9, margin: 0 }}>
              هدف آن دادن جواب آماده نیست؛ هدف آن کمک به تصمیم‌گیری آگاهانه‌تر است.
            </p>
          </div>
        </section>
      )}

      {/* 4. AUDIO PREVIEWS */}
      {!hidden && (
        <section
          dir="rtl"
          style={{
            ...fadeStyle,
            paddingInline: PAD,
            paddingTop:    '2.5rem',
            paddingBottom: '2rem',
            borderTop:     '1px solid var(--border)',
            background:    'radial-gradient(ellipse at 60% 40%, rgba(196,151,58,0.04) 0%, transparent 65%)',
          }}
        >
          <Eyebrow>چند دقیقه از دوره</Eyebrow>

          <h2 style={{
            fontSize:      'clamp(1rem, 1.5vw, 1.2rem)',
            fontWeight:    600,
            lineHeight:    1.4,
            letterSpacing: '-0.01em',
            color:         'var(--foreground)',
            marginBottom:  '0.5rem',
          }}>
            چند دقیقه از دوره
          </h2>
          <p style={{
            fontSize:      '0.82rem',
            color:         'var(--subtle)',
            lineHeight:    1.75,
            marginBottom:  '1.75rem',
            maxWidth:      '48ch',
            opacity:       0.85,
          }}>
            برای اینکه بهتر با فضای دوره آشنا شوی، می‌توانی چند بخش کوتاه از آن را بشنوی.
          </p>

          <div style={{ maxWidth: '560px', display: 'flex', flexDirection: 'column' }}>
            {PREVIEWS.map((p, i) => (
              <div
                key={p.src}
                style={{
                  borderTop:  i === 0 ? '1px solid var(--border)' : 'none',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <AudioPlayer src={p.src} name={p.name} label={p.label} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. TESTIMONIALS — hear buyers after hearing Ashkan */}
      {!hidden && (
        <section
          dir="rtl"
          style={{
            ...fadeStyle,
            paddingInline: PAD,
            paddingTop:    '2.5rem',
            paddingBottom: '2rem',
            borderTop:     '1px solid var(--border)',
          }}
        >
          <h2 style={{
            fontSize:      'clamp(1rem, 1.5vw, 1.2rem)',
            fontWeight:    600,
            lineHeight:    1.4,
            letterSpacing: '-0.01em',
            color:         'var(--foreground)',
            marginBottom:  '0.25rem',
          }}>
            نظر کسانی که دوره را شنیده‌اند
          </h2>

          <Testimonials content={courseTestimonialsContent} locale="fa" />
        </section>
      )}

      {/* 6. TOPICS */}
      {!hidden && (
        <section
          dir="rtl"
          style={{
            ...fadeStyle,
            paddingInline: PAD,
            paddingTop:    '2.5rem',
            paddingBottom: '2.5rem',
            borderTop:     '1px solid var(--border)',
          }}
        >
          <Eyebrow>بخشی از موضوعات دوره</Eyebrow>

          <h2 style={{
            fontSize:      'clamp(1rem, 1.5vw, 1.2rem)',
            fontWeight:    600,
            lineHeight:    1.4,
            letterSpacing: '-0.01em',
            color:         'var(--foreground)',
            marginBottom:  '1.5rem',
          }}>
            بخشی از موضوعاتی که در دوره مطرح می‌شود
          </h2>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxWidth: '52ch', display: 'flex', flexDirection: 'column' }}>
            {TOPICS.map((topic, i) => (
              <li
                key={topic}
                style={{
                  display:       'flex',
                  alignItems:    'flex-start',
                  gap:           '0.875rem',
                  paddingTop:    '0.9rem',
                  paddingBottom: '0.9rem',
                  borderTop:     i === 0 ? '1px solid var(--border)' : 'none',
                  borderBottom:  '1px solid var(--border)',
                }}
              >
                <span style={{
                  width:        '4px',
                  height:       '4px',
                  borderRadius: '50%',
                  background:   'var(--accent)',
                  opacity:      0.55,
                  flexShrink:   0,
                  marginTop:    '0.55em',
                }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.65 }}>
                  {topic}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 7. MID CTA */}
      {!hidden && (
        <section
          dir="rtl"
          style={{
            ...fadeStyle,
            paddingInline: PAD,
            paddingTop:    '2rem',
            paddingBottom: '2rem',
            borderTop:     '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <a
              href="#form"
              className="btn-gold"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '9999px',
                background: 'var(--accent)', color: 'var(--accent-fg)',
                padding: '0.8rem 2rem',
                fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.04em',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              درخواست دسترسی به دوره
            </a>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--subtle)', margin: 0, opacity: 0.8 }}>
            ۹.۹ میلیون تومان · قیمت اولیه برای اولین گروه
          </p>
        </section>
      )}

      {/* 8. FORM / PAYMENT */}
      <section
        id="form"
        ref={formRef as React.RefObject<HTMLElement>}
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop:    hidden ? '3.5rem' : '2.5rem',
          paddingBottom: '3rem',
          borderTop:     hidden ? 'none' : '1px solid var(--border)',
          transition:    'padding-top 0.3s ease',
        }}
      >
        {!hidden && (
          <div style={fadeStyle}>
            <Eyebrow>درخواست دسترسی</Eyebrow>

            <h2 style={{
              fontSize:     'clamp(1rem, 1.6vw, 1.3rem)',
              fontWeight:   600,
              lineHeight:   1.4,
              color:        'var(--foreground)',
              marginBottom: '0.75rem',
            }}>
              برای دریافت دسترسی، اطلاعات زیر را بفرست.
            </h2>

            <p style={{
              fontSize:     '0.8rem',
              color:        'var(--subtle)',
              lineHeight:   1.8,
              marginBottom: '1.75rem',
              maxWidth:     '48ch',
            }}>
              پس از بررسی، اطلاعات پرداخت از طریق اینستاگرام ارسال می‌شود.
            </p>
          </div>
        )}

        <CourseForm onPaymentMode={enterPaymentMode} />

        {!hidden && (
          <p style={{
            ...fadeStyle,
            marginTop:  '1.5rem',
            fontSize:   '0.7rem',
            color:      'var(--subtle)',
            lineHeight: 1.75,
            maxWidth:   '52ch',
            opacity:    fading ? 0 : 0.65,
          }}>
            این دوره بر پایه تجربه شخصی است. جایگزین مشاوره حقوقی یا تخصصی نیست.
          </p>
        )}
      </section>
    </>
  )
}
