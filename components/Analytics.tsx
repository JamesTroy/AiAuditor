import Script from 'next/script';

/**
 * Plausible analytics — only renders when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set.
 * Privacy-friendly, no cookies, GDPR-compliant out of the box.
 */
export default function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;

  return (
    <>
      <Script
        defer
        data-domain={domain}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
      {/* AUDIT-CWV: Define plausible() function early so web-vitals can send events
          before the Plausible script loads. Queued events fire when the script arrives. */}
      <Script id="plausible-init" strategy="beforeInteractive">
        {`window.plausible = window.plausible || function(){ (window.plausible.q = window.plausible.q || []).push(arguments) }`}
      </Script>
    </>
  );
}
