'use client'

import { useState, useRef, useCallback } from 'react'
import { CourseFormEn } from './CourseFormEn'
import { courseContent } from '@/data/content.en'

const PAD = 'clamp(1rem, 5vw, 4rem)'

function Eyebrow({ children }: { children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.75rem' }}>
      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, flexShrink: 0 }} />
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--subtle)', margin: 0 }}>
        {children}
      </p>
    </div>
  )
}

export function CoursePageShellEn() {
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

  const { modules, highlightedModules, outcomes } = courseContent

  return (
    <>
      {/* 1. HERO */}
      {!hidden && (
        <section style={{
          ...fadeStyle,
          paddingInline: PAD,
          paddingTop: '5rem',
          paddingBottom: '2rem',
          background: 'radial-gradient(ellipse at 65% 35%, rgba(196,151,58,0.05) 0%, transparent 60%)',
        }}>
          <div style={{ maxWidth: '580px' }}>
            <Eyebrow>{courseContent.eyebrow}</Eyebrow>

            <h1 style={{
              fontSize: 'clamp(2.4rem, 5.5vw, 4.2rem)',
              fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.03em',
              color: 'var(--foreground)', marginBottom: '1rem',
            }}>
              {courseContent.title}
            </h1>

            <p style={{
              fontSize: 'clamp(0.9rem, 1.3vw, 1.05rem)',
              lineHeight: 1.8, color: 'var(--muted)', marginBottom: '1.25rem', maxWidth: '38ch',
            }}>
              {courseContent.subtitle}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <a
                href="#form"
                className="btn-gold"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
                  padding: '0.8rem 2rem', fontSize: '0.85rem', fontWeight: 600,
                  letterSpacing: '0.04em', textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                {courseContent.ctaLabel}
              </a>
              <a
                href="/en"
                className="back-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--muted)', textDecoration: 'none', opacity: 0.75 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
                Back
              </a>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--subtle)', margin: 0, opacity: 0.8 }}>
              {courseContent.price} · {courseContent.priceNote}
            </p>
          </div>
        </section>
      )}

      {/* 2. CORE STATEMENT */}
      {!hidden && (
        <section style={{
          ...fadeStyle,
          paddingInline: PAD, paddingTop: '2rem', paddingBottom: '2rem',
          borderTop: '1px solid var(--border)',
        }}>
          <p style={{
            fontSize: 'clamp(1.2rem, 2.2vw, 1.7rem)',
            fontWeight: 500, lineHeight: 1.65, letterSpacing: '-0.02em',
            color: 'var(--foreground)', maxWidth: '34ch', margin: 0,
          }}>
            {courseContent.coreStatement[0]}
            <br />
            {courseContent.coreStatement[1]}
          </p>
        </section>
      )}

      {/* 3. WHAT YOU'LL UNDERSTAND DIFFERENTLY — outcomes first, people buy outcomes */}
      {!hidden && (
        <section style={{
          ...fadeStyle,
          paddingInline: PAD, paddingTop: '2.5rem', paddingBottom: '2.5rem',
          borderTop: '1px solid var(--border)',
          background: 'radial-gradient(ellipse at 60% 40%, rgba(196,151,58,0.04) 0%, transparent 65%)',
        }}>
          <Eyebrow>What You&rsquo;ll Understand Differently</Eyebrow>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', maxWidth: '540px' }}>
            {outcomes.map((item, i) => (
              <li
                key={item}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '1rem',
                  paddingTop: '0.9rem', paddingBottom: '0.9rem',
                  borderTop: '1px solid var(--border)',
                  borderBottom: i === outcomes.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span style={{ fontSize: '0.65rem', color: 'var(--accent)', opacity: 0.65, minWidth: '1.5rem', fontVariantNumeric: 'tabular-nums', flexShrink: 0, paddingTop: '0.2em' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '0.95rem', lineHeight: 1.55, color: 'var(--muted)' }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 4. CURRICULUM */}
      {!hidden && (
        <section style={{
          ...fadeStyle,
          paddingInline: PAD, paddingTop: '2.5rem', paddingBottom: '2.5rem',
          borderTop: '1px solid var(--border)',
        }}>
          <Eyebrow>Curriculum</Eyebrow>
          <p style={{ fontSize: '0.8rem', color: 'var(--subtle)', lineHeight: 1.75, marginBottom: '1.5rem', maxWidth: '52ch', opacity: 0.8 }}>
            {courseContent.credibilityLine}
          </p>

          <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>
            {modules.map((mod, i) => {
              const hi = highlightedModules.has(i)
              return (
                <div
                  key={mod.title}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    paddingTop: '0.8rem', paddingBottom: '0.8rem',
                    borderTop: '1px solid var(--border)',
                    borderBottom: i === modules.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '0.65rem', color: hi ? 'var(--accent)' : 'var(--subtle)', opacity: hi ? 0.7 : 0.45, minWidth: '1.5rem', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '1rem', lineHeight: 1.5, color: hi ? '#f5ede0' : 'var(--foreground)', fontWeight: hi ? 600 : 400 }}>
                    {mod.title}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 5. MID CTA */}
      {!hidden && (
        <section style={{
          ...fadeStyle,
          paddingInline: PAD, paddingTop: '2rem', paddingBottom: '2rem',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <a
              href="#form"
              className="btn-gold"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
                padding: '0.8rem 2rem', fontSize: '0.85rem', fontWeight: 600,
                letterSpacing: '0.04em', textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              {courseContent.ctaLabel}
            </a>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--subtle)', margin: 0, opacity: 0.8 }}>
            {courseContent.price} · {courseContent.priceNote}
          </p>
        </section>
      )}

      {/* 6. FORM / PAYMENT */}
      <section
        id="form"
        ref={formRef as React.RefObject<HTMLElement>}
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
            <Eyebrow>Get the Course</Eyebrow>
            <h2 style={{ fontSize: 'clamp(1rem, 1.6vw, 1.3rem)', fontWeight: 600, lineHeight: 1.4, color: 'var(--foreground)', marginBottom: '0.75rem' }}>
              Enter your details to proceed to payment.
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--subtle)', lineHeight: 1.8, marginBottom: '1.75rem', maxWidth: '48ch' }}>
              Immediate access after payment. Confirmation sent to your email.
            </p>
          </div>
        )}

        <CourseFormEn onPaymentMode={enterPaymentMode} />

        {!hidden && (
          <p style={{
            ...fadeStyle,
            marginTop: '1.5rem', fontSize: '0.7rem', color: 'var(--subtle)',
            lineHeight: 1.75, maxWidth: '52ch', opacity: fading ? 0 : 0.65,
          }}>
            This course is based on personal experience and is not a substitute for legal or professional advice.
          </p>
        )}
      </section>
    </>
  )
}
