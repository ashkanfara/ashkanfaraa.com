'use client'

import { useState, useRef, useCallback } from 'react'
import { CourseForm } from './CourseForm'

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

// Indices of modules 03, 05, 06, 08 (0-based: 2, 4, 5, 7)
const HIGHLIGHTED = new Set([2, 4, 5, 7])

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
            paddingTop: '3.5rem',
            paddingBottom: '2.5rem',
            background: 'radial-gradient(ellipse at 65% 35%, rgba(196,151,58,0.05) 0%, transparent 60%)',
          }}
        >
          <div style={{ maxWidth: '580px' }}>
            <Eyebrow>دوره آموزشی</Eyebrow>

            <h1 style={{
              fontSize: 'clamp(2.4rem, 5.5vw, 4.2rem)',
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              color: 'var(--foreground)',
              marginBottom: '1.25rem',
            }}>
              تله‌های پنهان مهاجرت
            </h1>

            <p style={{
              fontSize: 'clamp(0.9rem, 1.3vw, 1.05rem)',
              fontWeight: 400,
              lineHeight: 1.8,
              color: 'var(--muted)',
              letterSpacing: '-0.01em',
              marginBottom: '1.75rem',
              maxWidth: '38ch',
            }}>
              چیزهایی که کاش قبل از رفتن می‌دانستی.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              <a
                href="#form"
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
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent)' }}>
                ۹.۹ میلیون تومان
              </span>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--subtle)', margin: 0, opacity: 0.75 }}>
              قیمت اولیه برای اولین گروه شرکت‌کنندگان
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
            paddingTop: '2rem',
            paddingBottom: '2rem',
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
      )}

      {/* 3. MODULE LIST */}
      {!hidden && (
        <section
          dir="rtl"
          style={{
            ...fadeStyle,
            paddingInline: PAD,
            paddingTop: '2.5rem',
            paddingBottom: '2.5rem',
            borderTop: '1px solid var(--border)',
            background: 'radial-gradient(ellipse at 30% 50%, rgba(196,151,58,0.04) 0%, transparent 65%)',
          }}
        >
          {/* Credibility statement */}
          <p style={{
            fontSize: '0.8rem',
            color: 'var(--subtle)',
            lineHeight: 1.75,
            marginBottom: '1.5rem',
            maxWidth: '52ch',
            opacity: 0.8,
          }}>
            این دوره حاصل سال‌ها تجربه زندگی، تحصیل، کار و گفتگو با مهاجران در کشورهای مختلف است.
          </p>

          {/* Framing line */}
          <p style={{
            fontSize: '0.72rem',
            letterSpacing: '0.06em',
            color: 'var(--subtle)',
            marginBottom: '1.5rem',
            opacity: 0.65,
          }}>
            چیزهایی که کسی قبل از رفتن به تو نمی‌گوید.
          </p>

          <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>
            {MODULES.map((mod, i) => {
              const hi = HIGHLIGHTED.has(i)
              return (
                <div
                  key={mod.title}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    paddingTop: '0.8rem',
                    paddingBottom: '0.8rem',
                    borderTop: '1px solid var(--border)',
                    borderBottom: i === MODULES.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span style={{
                    fontSize: '0.65rem',
                    color: hi ? 'var(--accent)' : 'var(--subtle)',
                    opacity: hi ? 0.7 : 0.45,
                    minWidth: '1.5rem', fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{
                    fontSize: '1rem', lineHeight: 1.5,
                    color: hi ? '#f5ede0' : 'var(--foreground)',
                    fontWeight: hi ? 600 : 400,
                  }}>
                    {mod.title}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 4. MID CTA */}
      {!hidden && (
        <section
          dir="rtl"
          style={{
            ...fadeStyle,
            paddingInline: PAD,
            paddingTop: '2rem',
            paddingBottom: '2rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
            <a
              href="#form"
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
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent)' }}>
              ۹.۹ میلیون تومان
            </span>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--subtle)', margin: 0, opacity: 0.75 }}>
            قیمت اولیه برای اولین گروه شرکت‌کنندگان
          </p>
        </section>
      )}

      {/* 5. FORM / PAYMENT */}
      <section
        id="form"
        ref={formRef as React.RefObject<HTMLElement>}
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop:    hidden ? '3.5rem' : '2.5rem',
          paddingBottom: '3rem',
          borderTop: hidden ? 'none' : '1px solid var(--border)',
          transition: 'padding-top 0.3s ease',
        }}
      >
        {!hidden && (
          <div style={fadeStyle}>
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
              marginBottom: '1.75rem',
              maxWidth: '48ch',
            }}>
              پس از بررسی، اطلاعات پرداخت از طریق اینستاگرام ارسال می‌شود.
            </p>
          </div>
        )}

        <CourseForm onPaymentMode={enterPaymentMode} />

        {!hidden && (
          <p style={{
            ...fadeStyle,
            marginTop: '1.5rem',
            fontSize: '0.7rem',
            color: 'var(--subtle)',
            lineHeight: 1.75,
            maxWidth: '52ch',
            opacity: fading ? 0 : 0.65,
          }}>
            این دوره بر پایه تجربه شخصی است. جایگزین مشاوره حقوقی یا تخصصی نیست.
          </p>
        )}
      </section>
    </>
  )
}
