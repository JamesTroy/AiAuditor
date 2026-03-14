// ARCH-009 / VULN-013: Centralised URL allowlist for the fetch-url proxy.
// Uses the WHATWG URL parser for strict validation rather than regex alone,
// preventing @-credential injection, non-standard ports, and path confusion.

const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
  'gist.github.com',
]);

/** Human-readable description shown in the UI placeholder / error messages. */
export const ALLOWED_URL_DESCRIPTION =
  'raw.githubusercontent.com, gist.githubusercontent.com, or gist.github.com/.../raw/';

/**
 * VULN-013: Validate a URL using the WHATWG URL parser, then apply host and
 * path rules. Rejects credentials, non-standard ports, non-HTTPS, redirects,
 * and gist.github.com URLs that don't contain /raw/ in the path.
 */
export function isAllowedUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return false;
  }

  // Enforce HTTPS only
  if (parsed.protocol !== 'https:') return false;

  // Reject credentials embedded in the URL (e.g. https://user:pass@host/)
  if (parsed.username || parsed.password) return false;

  // Reject non-standard ports (GitHub raw content never needs them)
  if (parsed.port) return false;

  // Hostname must be exactly one of the allowed hosts
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return false;

  // gist.github.com URLs must contain /raw/ in the path to target raw content
  // (not the HTML gist page, which would return text/html and be rejected
  // downstream anyway, but better to block early)
  if (parsed.hostname === 'gist.github.com' && !parsed.pathname.includes('/raw/')) {
    return false;
  }

  return true;
}
