import { Hero } from '@/components/sections/Hero'
import { Offers } from '@/components/sections/OfferCards'
import { Testimonials } from '@/components/sections/Testimonials'
import { Footer } from '@/components/layout/Footer'

export default function Home() {
  return (
    <main className="w-full overflow-x-hidden">
      <Hero />
      <section className="w-full" style={{ paddingInline: 'clamp(1rem, 2.2vw, 2rem)' }}>
        <Offers />
        <Testimonials />
      </section>
      <Footer />
    </main>
  )
}
