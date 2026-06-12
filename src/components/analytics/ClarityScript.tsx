/**
 * Microsoft Clarity analytics.
 *
 * Loaded globally via the root layout.
 * Only fires in production (NODE_ENV === 'production').
 * Silently does nothing in development or when the env var is unset.
 *
 * Required env var (set in Vercel):
 *   NEXT_PUBLIC_CLARITY_ID  =  your Clarity project ID (e.g. "abc123xyz")
 *
 * The NEXT_PUBLIC_ prefix is required so Next.js embeds the value
 * into the client bundle at build time.
 */

import Script from 'next/script'

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID

export function ClarityScript() {
  // Do not load in development or when the project ID is not configured
  if (!CLARITY_ID || process.env.NODE_ENV !== 'production') return null

  return (
    <Script
      id="microsoft-clarity"
      strategy="afterInteractive"
    >{`
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_ID}");
    `}</Script>
  )
}
