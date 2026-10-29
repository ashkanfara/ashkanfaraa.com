export type SiteLocale = 'en' | 'fa'
// Keep established Persian conversion URLs stable for DMs and comments.
const pairs: ReadonlyArray<readonly [string, string]> = [
  ['/', '/fa'],
  ['/en/consultation', '/consultation'],
  ['/en/course', '/course'],
  ['/en/consultation/success', '/consultation/success'],
]
export function localeForPath(path: string): SiteLocale {
  return path === '/' || path === '/en' || path.startsWith('/en/') ? 'en' : 'fa'
}
export function equivalentPath(path: string): string | null {
  const pair = pairs.find(([en, fa]) => path === en || path === fa || (path === '/en' && en === '/'))
  return pair ? localeForPath(path) === 'en' ? pair[1] : pair[0] : null
}
export function pageAlternates(path: string) {
  const canonical = path === '/en' ? '/' : path
  const pair = pairs.find(([en, fa]) => canonical === en || canonical === fa)
  return { canonical, ...(pair ? { languages: { en: pair[0], fa: pair[1], 'x-default': pair[0] } } : {}) }
}
