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

// ── Segmented EN / FA toggle ──────────────────────────────────
// Looks like a small OS-style segment control, not a nav link pair.
function LocaleToggle({ isEn, altHref }: { isEn: boolean; altHref: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        borderRadius: '0.3rem',
        overflow: 'hidden',
        fontSize: '0.6rem',
        letterSpacing: '0.12em',
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {/* EN segment */}
      {isEn ? (
        <span style={{
          padding: '0.26rem 0.55rem',
          background: 'rgba(255,255,255,0.1)',
          color: 'var(--foreground)',
          borderRight: '1px solid var(--border)',
          userSelect: 'none',
        }}>
          EN
        </span>
      ) : (
        <Link href={altHref} style={{
          padding: '0.26rem 0.55rem',
          color: 'var(--subtle)',
          textDecoration: 'none',
          borderRight: '1px solid var(--border)',
          transition: 'color 0.15s, background 0.15s',
          display: 'block',
        }}>
          EN
        </Link>
      )}

      {/* FA segment */}
      {!isEn ? (
        <span style={{
          padding: '0.26rem 0.55rem',
          background: 'rgba(255,255,255,0.1)',
          color: 'var(--foreground)',
          userSelect: 'none',
        }}>
          FA
        </span>
      ) : (
        <Link href={altHref} style={{
          padding: '0.26rem 0.55rem',
          color: 'var(--subtle)',
          textDecoration: 'none',
          transition: 'color 0.15s, background 0.15s',
          display: 'block',
        }}>
          FA
        </Link>
      )}
    </div>
  )
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

        {/* Nav + locale toggle */}
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

          <LocaleToggle isEn={isEn} altHref={altHref} />
        </nav>
      </div>
    </header>
  )
}
