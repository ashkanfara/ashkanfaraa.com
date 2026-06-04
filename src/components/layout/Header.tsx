import Link from 'next/link'
import { site, nav } from '@/data/content'

export function Header() {
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="px-site py-4 md:py-6 flex items-center justify-between" dir="ltr">
        {/* Brand */}
        <div className="flex flex-col gap-0.5">
          <span className="text-foreground tracking-[0.4em] uppercase text-[12px] md:text-[14px] font-light">
            {site.name}
          </span>
          <span className="text-subtle tracking-[0.25em] uppercase text-[8px] md:text-[10px] font-light hidden sm:block">
            {site.tagline}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-5 md:gap-7">
          {nav.links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="inline-block text-muted text-[11px] md:text-[12px] tracking-wide hover:text-foreground transition-colors duration-200"
              style={{ fontWeight: 400 }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
