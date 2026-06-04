import type { Metadata } from 'next'
import { Hero }         from '@/components/sections/Hero'
import { Offers }       from '@/components/sections/OfferCards'
import { Testimonials } from '@/components/sections/Testimonials'
import { Footer }       from '@/components/layout/Footer'
import {
  hero,
  credentials,
  offers,
  offersMeta,
  testimonials,
  footer,
} from '@/data/content.en'

export const metadata: Metadata = {
  title: 'Ashkan Faraa — Migration Strategy',
  description: 'Before the big decisions, see the picture most people miss. Private strategy sessions and courses for Iranians navigating major life choices.',
}

export default function EnHomePage() {
  return (
    <main className="w-full overflow-x-hidden">
      <Hero
        content={hero}
        primaryCta={{ label: 'Migration: The Full Picture', href: '/en/course' }}
        secondaryCta={{ label: 'Request a Session', href: '/en/consultation' }}
      />

      {/* Credibility */}
      <section
        className="px-site"
        style={{ paddingTop: '1.75rem', paddingBottom: '1.75rem', borderTop: '1px solid var(--border)' }}
      >
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '1rem' }}>
          Real Experience
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {credentials.map(c => (
            <li key={c} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--accent)', opacity: 0.6, flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.6 }}>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Offers + Testimonials */}
      <section className="w-full px-site">
        <Offers offers={offers as any} meta={offersMeta} />
        <Testimonials content={testimonials} />
      </section>

      <Footer content={footer} />
    </main>
  )
}
