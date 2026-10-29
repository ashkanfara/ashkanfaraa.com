// The root layout sets the document language from the explicit public route.

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return <div dir="ltr">{children}</div>
}
