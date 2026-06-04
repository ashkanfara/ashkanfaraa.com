import { Hero } from '@/components/sections/Hero'
import { Offers } from '@/components/sections/OfferCards'
import { Testimonials } from '@/components/sections/Testimonials'
import { Footer } from '@/components/layout/Footer'

const CREDENTIALS = [
  'زندگی در چند کشور',
  'مهاجرت شخصی',
  'سال‌ها مشاوره با ایرانیان',
  'تجربه تصمیم‌هایی که روی کاغذ دیده نمی‌شوند',
]

export default function Home() {
  return (
    <main className="w-full overflow-x-hidden">
      <Hero />

      {/* ── Credibility ───────────────────────────────────── */}
      <section
        dir="rtl"
        className="px-site"
        style={{
          paddingTop: '1.75rem',
          paddingBottom: '1.75rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <p style={{
          fontSize: '0.62rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--subtle)',
          marginBottom: '1rem',
        }}>
          تجربه واقعی
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {CREDENTIALS.map(c => (
            <li key={c} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--accent)', opacity: 0.6, flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.6 }}>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Offers + Testimonials ─────────────────────────── */}
      <section className="w-full px-site">
        <Offers />
        <Testimonials />
      </section>

      <Footer />
    </main>
  )
}
