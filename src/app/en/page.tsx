import type { Metadata } from 'next'
import { Hero }         from '@/components/sections/Hero'
import { Offers }       from '@/components/sections/OfferCards'
import { Testimonials } from '@/components/sections/Testimonials'
import { Footer }       from '@/components/layout/Footer'
import {
  hero,
  credibilitySection,
  offers,
  offersMeta,
  testimonials,
  footer,
} from '@/data/content.en'

export const metadata: Metadata = {
  title: 'Ashkan Faraa — Private Strategy Sessions',
  description:
    "Before the big decisions, see the full picture. Private strategy sessions for people facing major decisions — relocation, career, business, education, and life abroad.",
}

export default function EnHomePage() {
  return (
    <main className="w-full overflow-x-hidden">

      {/* 1 — Hero */}
      <Hero
        content={hero}
        primaryCta={{ label: 'Request a Strategy Session', href: '/en/consultation' }}
        secondaryCta={{ label: 'Explore The Hidden Traps of Migration', href: '/en/course' }}
      />

      {/* 2 — Credibility */}
      <section
        className="px-site"
        style={{ paddingTop: '2rem', paddingBottom: '2rem', borderTop: '1px solid var(--border)' }}
      >
        <p style={{
          fontSize: '0.62rem', letterSpacing: '0.22em',
          textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '1.25rem',
        }}>
          {credibilitySection.eyebrow}
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {credibilitySection.points.map(point => (
            <li key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem' }}>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--accent)', opacity: 0.6, flexShrink: 0, marginTop: '0.5em' }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.65 }}>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 3 — Offers (consultation first) */}
      <section className="w-full px-site">
        <Offers offers={offers as any} meta={offersMeta} />
      </section>

      {/* 4 — Testimonials */}
      <section className="w-full px-site">
        <Testimonials content={testimonials} locale="en" />
      </section>

      {/* 5 — Footer */}
      <Footer content={footer} />
    </main>
  )
}
