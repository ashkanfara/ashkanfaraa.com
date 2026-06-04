import { hero } from '@/data/content'
import { PortraitImage } from '@/components/ui/PortraitImage'

export function Hero() {
  return (
    <section
      className="w-full grid grid-cols-1 md:grid-cols-[3fr_2fr]"
      style={{ height: '100svh', minHeight: '600px' }}
      id="hero"
    >
        {/* ── Text column — DOM first → right column in RTL ─────── */}
        <div
          className="order-2 md:order-none flex flex-col justify-center"
          style={{
            paddingTop: 'clamp(5rem, 8vw, 7rem)',
            paddingBottom: 'clamp(2rem, 4vw, 3rem)',
            paddingInlineStart: 'clamp(1.5rem, 4vw, 3.5rem)',
            paddingInlineEnd: 'clamp(1rem, 2.5vw, 2rem)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h1
              className="text-foreground font-bold"
              style={{
                fontSize: 'clamp(1.4rem, 2.1vw, 2.2rem)',
                lineHeight: '1.25',
                letterSpacing: '-0.02em',
              }}
            >
              {hero.headlineLines.map((line, i) => (
                <span key={i} className="block">{line}</span>
              ))}
            </h1>

            <div style={{ width: '2.5rem', height: '1px', background: 'var(--accent)', opacity: 0.7 }} />

            <p
              className="text-muted"
              style={{ fontSize: '0.95rem', lineHeight: 'var(--leading-body)' }}
            >
              {hero.subtext}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <a
                href="/course"
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  borderRadius: '9999px',
                  background: 'var(--accent)', color: 'var(--accent-fg)',
                  padding: '0.7rem 1.5rem',
                  fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.04em',
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                تله‌های پنهان مهاجرت
              </a>
              <a
                href="/consultation"
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  borderRadius: '9999px',
                  background: 'transparent',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--muted)',
                  padding: '0.7rem 1.5rem',
                  fontSize: '0.82rem', fontWeight: 500, letterSpacing: '0.04em',
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                درخواست مشاوره
              </a>
            </div>
          </div>
        </div>

        {/* ── Portrait column — DOM second → left column in RTL ─── */}
        <div className="order-1 md:order-none relative overflow-hidden bg-surface" style={{ minHeight: 'clamp(300px, 50vw, 100%)' }}>
          <PortraitImage objectPosition="50% 15%" />

          {/* Top vignette */}
          <div
            className="absolute inset-x-0 top-0 h-40 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(14,12,10,0.65), transparent)' }}
          />
          {/* Bottom fade */}
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{ height: '28%', background: 'linear-gradient(to top, var(--background), transparent)' }}
          />
          {/* Inner-edge fade toward text column */}
          <div
            className="absolute inset-y-0 start-0 pointer-events-none hidden md:block"
            style={{ width: '35%', background: 'linear-gradient(to right, transparent, var(--background))' }}
          />
        </div>
    </section>
  )
}
