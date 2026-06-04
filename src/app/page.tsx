import { Hero } from '@/components/sections/Hero'
import { Offers } from '@/components/sections/OfferCards'
import { Testimonials } from '@/components/sections/Testimonials'
import { Footer } from '@/components/layout/Footer'

const PAD = 'clamp(1rem, 5vw, 4rem)'

export default function Home() {
  return (
    <main className="w-full overflow-x-hidden">
      <Hero />

      {/* ── Credibility ───────────────────────────────────── */}
      <section
        dir="rtl"
        style={{
          paddingInline: PAD,
          paddingTop: '3.5rem',
          paddingBottom: '3.5rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <h2 style={{
          fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--foreground)',
          marginBottom: '1rem',
        }}>
          چرا اشکان؟
        </h2>
        <p style={{
          fontSize: '0.9rem',
          color: 'var(--muted)',
          lineHeight: 1.95,
          maxWidth: '52ch',
          margin: 0,
        }}>
          مهاجرت را زندگی کرده‌ام، نه فقط درباره آن صحبت کرده‌ام.
          <br /><br />
          سال‌ها زندگی، تحصیل و کار در کشورهای مختلف، تجربه‌ای ساخته که بسیاری از افراد تنها بعد از مهاجرت به دست می‌آورند.
        </p>
      </section>

      {/* ── Offers + Testimonials ─────────────────────────── */}
      <section className="w-full" style={{ paddingInline: 'clamp(1rem, 2.2vw, 2rem)' }}>
        <Offers />
        <Testimonials />
      </section>

      <Footer />
    </main>
  )
}
