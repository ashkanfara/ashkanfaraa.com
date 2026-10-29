'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import { equivalentPath, localeForPath } from '@/lib/site-locale'

export function Header() {
  const pathname = usePathname()
  const en = localeForPath(pathname) === 'en'
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const links = en
    ? [{ label: 'The approach', href: '/#approach' }, { label: 'Private session', href: '/en/consultation' }, { label: 'The course', href: '/en/course' }]
    : [{ label: 'نگاه من', href: '/fa#approach' }, { label: 'جلسه خصوصی', href: '/consultation' }, { label: 'دوره مهاجرت', href: '/course' }]
  const alternate = equivalentPath(pathname)
  return <header className="site-header" onKeyDown={event => { if (event.key === 'Escape' && open) { setOpen(false); menuButton.current?.focus() } }}><div className="header-inner" dir="ltr">
    <Link className="brand" href={en ? '/' : '/fa'} aria-label={en ? 'Ashkan Faraa — Home' : 'اشکان فارا — خانه'}><span>ASHKAN FARAA<span className="brand-dot">.</span></span><small>STRATEGY · PERSPECTIVE · CLARITY</small></Link>
    <nav className={`site-nav ${open ? 'is-open' : ''}`} aria-label={en ? 'Main navigation' : 'منوی اصلی'} id="site-navigation" dir={en ? 'ltr' : 'rtl'}>
      {links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>)}
    </nav>
    <div className="header-actions">
      {/* A document navigation refreshes server-rendered html lang/dir too. */}
      <a className="language-link" href={alternate || (en ? '/fa' : '/')} hrefLang={en ? 'fa' : 'en'} lang={en ? 'fa' : 'en'}>{alternate ? (en ? 'فارسی' : 'English') : (en ? 'خانه فارسی' : 'English home')} <span aria-hidden>↗</span></a>
      <button ref={menuButton} className="menu-toggle" aria-controls="site-navigation" aria-expanded={open} aria-label={en ? 'Toggle navigation' : 'باز و بسته کردن منو'} onClick={() => setOpen(!open)}>{open ? '×' : '☰'}</button>
    </div>
  </div></header>
}
