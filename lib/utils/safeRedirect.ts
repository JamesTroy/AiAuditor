// AUTH-001: Validate callback URLs to prevent open redirect attacks.
// Only allows relative paths or URLs matching known app origins.

const ALLOWED_HOSTS = new Set(
  [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
    'http://localhost:3000',
  ]
    .filter(Boolean)
    .map((u) => {
      try { return new URL(u!).host; } catch { return null; }
    })
    .filter(Boolean) as string[],
);

export function safeCallbackUrl(raw: string | null, fallback = '/dashboard'): string {
  if (!raw) return fallback;

  // Relative paths starting with a single slash are safe
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;

  // Absolute URLs — only allow known hosts
  try {
    const parsed = new URL(raw);
    if (!['https:', 'http:'].includes(parsed.protocol)) return fallback;
    if (!ALLOWED_HOSTS.has(parsed.host)) return fallback;
    return raw;
  } catch {
    return fallback;
  }
}
