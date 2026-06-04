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

        {/* Nav — visible at all sizes */}
        <nav className="flex items-center gap-4 md:gap-6">
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

          {/* Separator */}
          <span
            className="block"
            style={{ width: '1px', height: '0.75rem', background: 'var(--border-strong)', opacity: 0.5 }}
          />

          {/* Language switch */}
          <span
            style={{
              fontSize: '10px',
              letterSpacing: '0.12em',
              color: 'var(--subtle)',
              fontWeight: 400,
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            EN
          </span>
        </nav>
      </div>
    </header>
  )
}
