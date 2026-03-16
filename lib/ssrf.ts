// SSRF-001: Server-Side Request Forgery protection for user-supplied URLs.
//
// Resolves the hostname to IP addresses via DNS and rejects any that fall
// within private, loopback, link-local, or cloud metadata IP ranges.
// This prevents attackers from using the site-audit URL fetcher to probe
// internal infrastructure (e.g., 169.254.169.254, 10.x.x.x, localhost).

import { lookup } from 'dns/promises';

/** IPv4 ranges that must never be fetched by user-supplied URLs. */
const BLOCKED_IPV4_RANGES: Array<{ prefix: number[]; bits: number }> = [
  // Loopback: 127.0.0.0/8
  { prefix: [127], bits: 8 },
  // Private: 10.0.0.0/8
  { prefix: [10], bits: 8 },
  // Private: 172.16.0.0/12
  { prefix: [172, 16], bits: 12 },
  // Private: 192.168.0.0/16
  { prefix: [192, 168], bits: 16 },
  // Link-local: 169.254.0.0/16 (includes AWS metadata 169.254.169.254)
  { prefix: [169, 254], bits: 16 },
  // Current network: 0.0.0.0/8
  { prefix: [0], bits: 8 },
];

/** Check if an IPv4 address string falls within any blocked range. */
function isBlockedIPv4(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
    return true; // Malformed → block
  }

  for (const range of BLOCKED_IPV4_RANGES) {
    let match = true;
    const fullBytes = Math.floor(range.bits / 8);

    for (let i = 0; i < fullBytes; i++) {
      if (octets[i] !== range.prefix[i]) {
        match = false;
        break;
      }
    }

    if (match && range.bits % 8 !== 0) {
      const partialBits = range.bits % 8;
      const mask = (0xff << (8 - partialBits)) & 0xff;
      if ((octets[fullBytes] & mask) !== ((range.prefix[fullBytes] ?? 0) & mask)) {
        match = false;
      }
    }

    if (match) return true;
  }
  return false;
}

/** Check if an IPv6 address is loopback (::1) or link-local (fe80::/10). */
function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  if (normalized.startsWith('fe80')) return true;
  // IPv4-mapped IPv6 (::ffff:x.x.x.x) — extract the IPv4 part and check it.
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isBlockedIPv4(v4Mapped[1]);
  return false;
}

/** Blocked hostnames that resolve to internal services. */
const BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

/**
 * Validate a user-supplied URL against SSRF attacks.
 * Resolves DNS and checks all returned IPs against blocked ranges.
 *
 * @returns `null` if safe, or an error message string if blocked.
 */
export async function validateUrlForSSRF(urlString: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return 'Invalid URL';
  }

  // Only allow HTTP(S)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only HTTP/HTTPS URLs are supported';
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known internal hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return 'This URL points to an internal service and cannot be audited';
  }

  // Block IP literals directly
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isBlockedIPv4(hostname)) {
      return 'This URL points to a private or internal IP address';
    }
    return null;
  }

  if (hostname.startsWith('[') || hostname.includes(':')) {
    // IPv6 literal
    const clean = hostname.replace(/^\[|\]$/g, '');
    if (isBlockedIPv6(clean)) {
      return 'This URL points to a private or internal IP address';
    }
    return null;
  }

  // DNS resolution — check all returned addresses
  try {
    const results = await lookup(hostname, { all: true });
    for (const result of results) {
      if (result.family === 4 && isBlockedIPv4(result.address)) {
        return 'This URL resolves to a private or internal IP address';
      }
      if (result.family === 6 && isBlockedIPv6(result.address)) {
        return 'This URL resolves to a private or internal IP address';
      }
    }
  } catch {
    return 'Could not resolve hostname. Please check the URL and try again.';
  }

  return null;
}
