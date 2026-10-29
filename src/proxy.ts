import { NextResponse, type NextRequest } from 'next/server'
import { localeForPath } from '@/lib/site-locale'
// Explicit URLs determine locale. Cookies/browser preferences never redirect root.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-site-locale', localeForPath(request.nextUrl.pathname))
  headers.set('x-site-path', request.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}
export const config = { matcher: ['/((?!api|admin|_next|.*\\..*).*)'] }
