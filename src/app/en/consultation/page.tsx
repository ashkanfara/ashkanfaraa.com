import type { Metadata } from 'next'
import Image from 'next/image'
import { Footer }             from '@/components/layout/Footer'
import { ConsultationFormEn } from '@/components/sections/ConsultationFormEn'
import { footer, consultationContent } from '@/data/content.en'

export const metadata: Metadata = {
  title: 'Private Strategy Session — Ashkan Faraa',
  description: 'Before the big decisions, see the full picture. A private session with Ashkan Faraa on migration, education, business, and life strategy.',
}

const PAD = 'clamp(1rem, 5vw, 4rem)'

function Eyebrow({ children }: { children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, flexShrink: 0 }} />
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--subtle)', margin: 0 }}>
        {children}
      </p>
    </div>
  )
}

export default function EnConsultationPage() {
  const c = consultationContent
  return (
    <main className="w-full overflow-x-hidden">

      {/* Hero */}
      <section style={{ paddingInline: PAD, paddingTop: '6.5rem', paddingBottom: '3rem' }}>
        <div className="grid grid-cols-1 md:grid-cols-[45fr_55fr] items-center gap-10 md:gap-14">

          {/* Left: image */}
          <div className="w-full aspect-[16/9] md:aspect-[4/5]" style={{ position: 'relative', borderRadius: '0.875rem', overflow: 'hidden' }}>
            <Image
              src="/images/card-consultation.png"
              alt="Ashkan Faraa"
              fill priority
              className="object-cover object-[50%_15%] md:object-top"
              sizes="(max-width: 768px) 100vw, 45vw"
            />
          </div>

          {/* Right: text */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Eyebrow>{c.eyebrow}</Eyebrow>

            <h1 style={{
              fontSize: 'clamp(1.8rem, 3.5vw, 3.2rem)',
              fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em',
              color: 'var(--foreground)', marginBottom: '1.5rem',
            }}>
              {c.titleLines[0]}
              <br />
              {c.titleLines[1]}
            </h1>

            <div style={{ width: '2.5rem', height: '1px', background: 'var(--accent)', opacity: 0.7, marginBottom: '1.5rem' }} />

            <p style={{ fontSize: 'clamp(0.875rem, 1.1vw, 1rem)', color: 'var(--muted)', lineHeight: 1.95, marginBottom: '2.25rem', maxWidth: '44ch' }}>
              {c.body[0]}
              <br /><br />
              {c.body[1]}
            </p>

            {/* CTA row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <a
                href="#form"
                className="btn-gold"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
                  padding: '0.875rem 2rem', fontSize: '0.875rem', fontWeight: 600,
                  letterSpacing: '0.04em', textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                {c.ctaLabel}
              </a>
              <a
                href="/en"
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
                Back
              </a>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--subtle)', margin: 0, opacity: 0.8 }}>
              {c.price}
            </p>
          </div>

        </div>
      </section>

      {/* Form */}
      <section id="form" style={{ paddingInline: PAD, paddingTop: '3rem', paddingBottom: '4rem', borderTop: '1px solid var(--border)' }}>
        <h2 style={{
          fontSize: 'clamp(1.1rem, 1.8vw, 1.5rem)', fontWeight: 600,
          lineHeight: 1.4, letterSpacing: '-0.01em',
          color: 'var(--foreground)', marginBottom: '1.5rem',
        }}>
          {c.formHeading}
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--subtle)', lineHeight: 1.8, marginBottom: '2rem', maxWidth: '52ch' }}>
          {c.formSubtext}
        </p>

        <ConsultationFormEn />

        <p style={{ marginTop: '2rem', fontSize: '0.72rem', color: 'var(--subtle)', lineHeight: 1.75, maxWidth: '56ch', opacity: 0.75 }}>
          {c.disclaimer}
        </p>
      </section>

      <Footer content={footer} />
    </main>
  )
}
