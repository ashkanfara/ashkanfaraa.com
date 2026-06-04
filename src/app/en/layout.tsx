// English sub-layout: sets dir="ltr" for all /en routes.
// Note: <html lang> remains "fa" from the root layout.
// TODO: For full lang/dir parity, switch to Next.js i18n routing
// or make the root layout locale-aware via middleware.

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return <div dir="ltr">{children}</div>
}
