import { hero as defaultContent } from '@/data/content'
import { PortraitImage } from '@/components/ui/PortraitImage'

type HeroContent = {
  headlineLines: string[]
  subtext: string
}

type HeroProps = {
  content?: HeroContent
  primaryCta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
}

const defaultPrimary   = { label: 'تله‌های پنهان مهاجرت',  href: '/course' }
const defaultSecondary = { label: 'درخواست مشاوره', href: '/consultation' }

export function Hero({
  content       = defaultContent,
  primaryCta    = defaultPrimary,
  secondaryCta  = defaultSecondary,
}: HeroProps) {
  return (
    <section
      className="w-full grid grid-cols-1 md:grid-cols-[3fr_2fr] md:h-svh md:min-h-[600px]"
      id="hero"
    >
      {/* Text column */}
      <div className="order-2 md:order-none flex flex-col justify-center px-6 pt-8 pb-12 md:pt-0 md:pb-0 md:ps-14 md:pe-8">
        <div className="flex flex-col gap-5">

          <h1 className="text-foreground font-bold text-[1.65rem] leading-[1.25] tracking-[-0.02em] md:text-[2.2rem]">
            {content.headlineLines.map((line, i) => (
              <span key={i} className="block">{line}</span>
            ))}
          </h1>

          <div className="w-10 h-px" style={{ background: 'var(--accent)', opacity: 0.7 }} />

          <p className="text-muted text-[0.95rem] leading-[var(--leading-body)]">
            {content.subtext}
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href={primaryCta.href}
              className="btn-gold inline-flex items-center rounded-full text-[0.82rem] font-semibold tracking-[0.04em] whitespace-nowrap"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)', padding: '0.7rem 1.5rem', textDecoration: 'none' }}
            >
              {primaryCta.label}
            </a>
            <a
              href={secondaryCta.href}
              className="inline-flex items-center rounded-full text-[0.82rem] font-medium tracking-[0.04em] whitespace-nowrap"
              style={{ background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--muted)', padding: '0.7rem 1.5rem', textDecoration: 'none' }}
            >
              {secondaryCta.label}
            </a>
          </div>

        </div>
      </div>

      {/* Portrait column */}
      <div className="order-1 md:order-none relative overflow-hidden bg-surface h-[52vh] md:h-full">
        <PortraitImage objectPosition="50% 15%" />
        <div className="absolute inset-x-0 top-0 h-40 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(14,12,10,0.65), transparent)' }} />
        <div className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{ height: '28%', background: 'linear-gradient(to top, var(--background), transparent)' }} />
        <div className="absolute inset-y-0 start-0 pointer-events-none hidden md:block"
          style={{ width: '35%', background: 'linear-gradient(to right, transparent, var(--background))' }} />
      </div>
    </section>
  )
}
