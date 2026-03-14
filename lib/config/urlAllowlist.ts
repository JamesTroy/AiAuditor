// ARCH-009: Centralised URL allowlist for the fetch-url proxy.
// Shared between the API route (enforcement) and client UI (informational copy).
// Add new patterns here — the route will automatically enforce them.

export const ALLOWED_URL_PATTERNS: readonly RegExp[] = [
  /^https:\/\/raw\.githubusercontent\.com\//,
  /^https:\/\/gist\.githubusercontent\.com\//,
  /^https:\/\/gist\.github\.com\/[^/]+\/[^/]+\/raw\//,
];

/** Returns true if the given URL is in the allowlist. */
export function isAllowedUrl(url: string): boolean {
  return ALLOWED_URL_PATTERNS.some((p) => p.test(url.trim()));
}

/** Human-readable description shown in the UI placeholder / error messages. */
export const ALLOWED_URL_DESCRIPTION =
  'raw.githubusercontent.com, gist.githubusercontent.com, or gist.github.com/.../raw/';
