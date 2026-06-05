'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { site, nav }    from '@/data/content'
import { nav as navEn } from '@/data/content.en'

function getAltLocaleHref(pathname: string, isEn: boolean): string {
  if (isEn) {
    const stripped = pathname.replace(/^\/en/, '')
    return stripped === '' ? '/' : stripped
  }
  return pathname === '/' ? '/en' : `/en${pathname}`
}

export function Header() {
  const pathname = usePathname()
  const isEn     = pathname.startsWith('/en')
  const links    = isEn ? navEn.links : nav.links
  const homeHref = isEn ? '/en' : '/'
  const altHref  = getAltLocaleHref(pathname, isEn)

  return (
    <header
      className="fixed top-0 inset-x-0 z-50"
      style={{
        background: 'rgba(14,12,10,0.72)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(44,39,34,0.55)',
      }}
    >
      <div className="px-site py-4 md:py-5 flex items-center justify-between" dir="ltr">
        {/* Brand */}
        <Link href={homeHref} style={{ textDecoration: 'none' }}>
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground tracking-[0.4em] uppercase text-[12px] md:text-[14px] font-light">
              {site.name}
            </span>
            <span className="text-subtle tracking-[0.25em] uppercase text-[8px] md:text-[10px] font-light hidden sm:block">
              {site.tagline}
            </span>
          </div>
        </Link>

        {/* Nav + language switch */}
        <nav className="flex items-center gap-5 md:gap-7">
          {links.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.label}
                href={link.href}
                className="inline-flex flex-col items-center gap-[3px] text-[11px] md:text-[12px] tracking-wide transition-colors duration-200"
                style={{ fontWeight: 400, color: active ? 'var(--foreground)' : 'var(--muted)', textDecoration: 'none' }}
              >
                {link.label}
                {active && (
                  <span style={{ display: 'block', width: '100%', height: '1px', background: 'var(--accent)', opacity: 0.7 }} />
                )}
              </Link>
            )
          })}

          {/* Language switch — luxury inline text, no badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
            {isEn ? (
              <>
                <span style={{ color: 'var(--muted)' }}>English</span>
                <span style={{ color: 'var(--border-strong)' }}>·</span>
                <Link href={altHref} className="lang-inactive">فارسی</Link>
              </>
            ) : (
              <>
                <Link href={altHref} className="lang-inactive">English</Link>
                <span style={{ color: 'var(--border-strong)' }}>·</span>
                <span style={{ color: 'var(--muted)' }}>فارسی</span>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
