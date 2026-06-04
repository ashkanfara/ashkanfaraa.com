import { site, footer } from '@/data/content'

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="px-site py-12 md:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-6">

          {/* Column 1 — brand (inline-start in RTL = rightmost on desktop) */}
          <div className="flex flex-col gap-3">
            <span
              className="text-foreground tracking-[0.4em] uppercase text-[12px] font-light"
              dir="ltr"
            >
              {site.name}
            </span>
            <p className="text-subtle text-xs">{footer.brand.tagline}</p>
            <p className="text-subtle text-xs leading-relaxed">{footer.brand.description}</p>
          </div>

          {/* Column 2 — legal / center */}
          <div className="flex items-center justify-center">
            <p className="text-subtle text-xs">{footer.legal}</p>
          </div>

          {/* Column 3 — partnerships (inline-end in RTL = leftmost on desktop) */}
          <div className="flex flex-col gap-3 md:items-end">
            <p className="text-accent text-[10px] tracking-[0.22em] uppercase">
              {footer.partnerships.label}
            </p>
            <p className="text-subtle text-xs leading-relaxed">{footer.partnerships.text}</p>
            <a
              href={`mailto:${footer.partnerships.email}`}
              className="text-muted text-xs transition-colors hover:text-accent"
            >
              {footer.partnerships.email}
            </a>
          </div>

        </div>
      </div>
    </footer>
  )
}
