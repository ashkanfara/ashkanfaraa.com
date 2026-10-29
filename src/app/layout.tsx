import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { Header } from "@/components/layout/SiteHeader";
import { headers } from 'next/headers';
import { pageAlternates } from '@/lib/site-locale';
import { ClarityScript } from "@/components/analytics/ClarityScript";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const baseMetadata: Metadata = {
  metadataBase: new URL('https://www.ashkanfaraa.com'),
  title: "Ashkan Faraa",
  description: "تصمیم‌های بزرگ را با دیدِ کامل‌تری بگیر. جلسه استراتژی خصوصی با اشکان فارا.",
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png', rel: 'icon' },
    ],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers()
  const path = requestHeaders.get('x-site-path')
  return { ...baseMetadata, ...(path ? { alternates: pageAlternates(path) } : {}) }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers()
  const locale = requestHeaders.get('x-site-locale') === 'en' ? 'en' : 'fa'
  return (
    <html
      lang={locale}
      dir={locale === 'fa' ? 'rtl' : 'ltr'}
      className={`${vazirmatn.variable} h-full antialiased`}
    >
      <body className="w-full min-h-full bg-background text-foreground">
        <ClarityScript />
        {requestHeaders.has('x-site-path') && <a className="skip-link" href="#main-content">{locale === 'fa' ? 'رفتن به محتوای اصلی' : 'Skip to content'}</a>}
        <Header />
        {children}
      </body>
    </html>
  );
}
