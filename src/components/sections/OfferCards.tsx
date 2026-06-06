import Image from 'next/image'
import { offers as defaultOffers, offersMeta as defaultMeta } from '@/data/content'

type Offer = {
  id: string
  title: string
  description: string
  price: string
  priceSub: string | null
  action: string
  href: string
  ctaVariant?: 'primary' | 'ghost'
}

type OffersMeta = { disclaimer: string }

type OffersProps = {
  offers?: readonly Offer[]
  meta?: OffersMeta
}

const cardImageSrc: Record<string, { src: string; alt: string; objectPosition: string; height?: string }> = {
  consultation: { src: '/images/card-consultation.png', alt: 'Private strategy session', objectPosition: 'center 40%', height: '320px' },
  course:       { src: '/images/card-course.png',       alt: 'Migration course',         objectPosition: 'center 45%' },
}

export function Offers({ offers = defaultOffers as unknown as Offer[], meta = defaultMeta }: OffersProps) {
  return (
    <section id="offers" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '2rem' }}>
        {offers.map((offer) => {
          const isGhost = offer.ctaVariant === 'ghost'
          return (
            <div
              key={offer.id}
              className="card-lift flex flex-col rounded-2xl border border-border bg-surface overflow-hidden"
            >
              {/* Card image */}
              <div style={{ position: 'relative', height: cardImageSrc[offer.id]?.height ?? '280px', flexShrink: 0 }}>
                <Image
                  src={cardImageSrc[offer.id]?.src ?? '/images/card-course.png'}
                  alt={cardImageSrc[offer.id]?.alt ?? ''}
                  fill
                  className="object-cover"
                  style={{ objectPosition: cardImageSrc[offer.id]?.objectPosition ?? 'center' }}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div aria-hidden style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to bottom, transparent 40%, rgba(22,19,16,0.72) 100%)',
                  pointerEvents: 'none',
                }} />
              </div>

              {/* Body */}
              <div className="flex flex-col flex-1" style={{ padding: '1.4rem 1.4rem 0' }}>
                <h2 className="text-foreground" style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.35, marginBottom: '0.5rem' }}>
                  {offer.title}
                </h2>
                <p className="text-muted" style={{ fontSize: '0.83rem', lineHeight: 'var(--leading-body)', marginBottom: '1rem' }}>
                  {offer.description}
                </p>
                {offer.price && (
                  <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>{offer.price}</span>
                    {offer.priceSub && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--subtle)' }}>· {offer.priceSub}</span>
                    )}
                  </div>
                )}
              </div>

              {/* CTA */}
              <div style={{ padding: '0 1.4rem 1.4rem' }}>
                <a
                  href={offer.href}
                  className={isGhost ? undefined : 'btn-gold'}
                  {...(offer.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  style={isGhost ? {
                    display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '9999px', background: 'transparent',
                    border: '1px solid var(--border-strong)', color: 'var(--muted)',
                    padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 400,
                    letterSpacing: '0.04em', textDecoration: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s, color 0.15s',
                  } : {
                    display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
                    padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500,
                    letterSpacing: '0.04em', textDecoration: 'none', boxSizing: 'border-box',
                  }}
                >
                  {offer.action}
                </a>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border border-border" style={{
        marginTop: '0.9rem', borderRadius: '0.625rem', padding: '0.85rem 1.5rem',
        background: 'var(--surface)', textAlign: 'center',
        fontSize: '0.78rem', color: 'var(--subtle)', lineHeight: 1.65,
      }}>
        {meta.disclaimer}
      </div>
    </section>
  )
}
