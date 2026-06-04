import { site, footer as defaultContent } from '@/data/content'

type FooterContent = {
  brand: { tagline: string; description: string }
  legal: string
  partnerships: { label: string; text: string; email: string }
}

export function Footer({ content = defaultContent }: { content?: FooterContent }) {
  return (
    <footer className="border-t border-border">
      <div className="px-site py-12 md:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-6">

          <div className="flex flex-col gap-3">
            <span className="text-foreground tracking-[0.4em] uppercase text-[12px] font-light" dir="ltr">
              {site.name}
            </span>
            <p className="text-subtle text-xs">{content.brand.tagline}</p>
            <p className="text-subtle text-xs leading-relaxed">{content.brand.description}</p>
          </div>

          <div className="flex items-center justify-center">
            <p className="text-subtle text-xs">{content.legal}</p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <p className="text-accent text-[10px] tracking-[0.22em] uppercase">
              {content.partnerships.label}
            </p>
            <p className="text-subtle text-xs leading-relaxed">{content.partnerships.text}</p>
            <a href={`mailto:${content.partnerships.email}`} className="text-muted text-xs transition-colors hover:text-accent">
              {content.partnerships.email}
            </a>
          </div>

        </div>
      </div>
    </footer>
  )
}
