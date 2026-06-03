import Link from 'next/link'
import { site, nav } from '@/data/content'

export function Header() {
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      {/* dir=ltr so brand mark sits at physical left, nav at physical right */}
      <div className="px-site py-5 md:py-6 flex items-center justify-between" dir="ltr">
        {/* Brand */}
        <div className="flex flex-col gap-0.5">
          <span className="text-foreground tracking-[0.4em] uppercase text-[13px] md:text-[14px] font-light">
            {site.name}
          </span>
          <span className="text-subtle tracking-[0.25em] uppercase text-[9px] md:text-[10px] font-light">
            {site.tagline}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-6">
          {nav.links.map((link) =>
            link.highlight ? (
              <Link
                key={link.label}
                href={link.href}
                className="hidden md:inline-flex items-center rounded-full border border-accent text-accent px-5 py-2 text-[12px] tracking-wide transition-colors duration-200 hover:bg-accent hover:text-accent-fg"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="hidden md:inline-block text-muted text-[12px] tracking-wide hover:text-foreground transition-colors duration-200"
              >
                {link.label}
              </a>
            )
          )}
        </nav>
      </div>
    </header>
  )
}
