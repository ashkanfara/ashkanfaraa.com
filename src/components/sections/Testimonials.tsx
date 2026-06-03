import { testimonials } from '@/data/content'
import { AudioPlayer } from '@/components/ui/AudioPlayer'

export function Testimonials() {
  return (
    <section style={{ paddingTop: '2rem', paddingBottom: '5.5rem' }}>

      {/* Eyebrow */}
      <div
        dir="rtl"
        style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}
      >
        <div style={{
          width: '2rem', height: '1px',
          background: 'var(--accent)', opacity: 0.65, flexShrink: 0,
        }} />
        <p style={{
          fontSize: '0.65rem', letterSpacing: '0.26em',
          textTransform: 'uppercase', color: 'var(--subtle)', margin: 0,
        }}>
          {testimonials.sectionLabel}
        </p>
      </div>

      {/* Headline + subtext */}
      <div dir="rtl" style={{ marginBottom: '3rem' }}>
        <h2 style={{
          fontSize: 'clamp(1.25rem, 2vw, 1.8rem)',
          fontWeight: 600,
          color: 'var(--foreground)',
          lineHeight: 1.3,
          marginBottom: '0.6rem',
          letterSpacing: '-0.01em',
        }}>
          {testimonials.headline}
        </h2>
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--muted)',
          lineHeight: 1.75,
        }}>
          {testimonials.subtext}
        </p>
      </div>

      {/* Editorial layout — track number in right margin, card takes full width */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {testimonials.items.map((item, i) => (
          <div
            key={item.id}
            dir="rtl"
            style={{ display: 'flex', alignItems: 'stretch', gap: '1.25rem' }}
          >
            {/* Track number — DOM first → right margin in RTL */}
            <div style={{
              width: '1.5rem', flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              paddingTop: '1.25rem', gap: '0.5rem',
            }}>
              <span style={{
                fontSize: '0.55rem', letterSpacing: '0.12em',
                color: 'var(--accent)', opacity: 0.5,
                userSelect: 'none', pointerEvents: 'none',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{
                flex: 1, width: '1px',
                background: 'linear-gradient(to bottom, var(--border-strong), transparent)',
              }} />
            </div>

            {/* Card — DOM second → left (wide) in RTL */}
            <div style={{
              flex: 1,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.875rem',
              paddingInline: '0.75rem',
            }}>
              <AudioPlayer src={item.src} name={item.name} label={item.label} />
            </div>
          </div>
        ))}
      </div>

    </section>
  )
}
