// Coverage for the PEM normalizer added to lib/github/app.ts.
//
// We hit this codepath every time a GitHub App JWT is built — for webhook
// PR audits, install backfill, vet/check-run creation. Each new failure
// mode listed in the source comment maps to a test below so a future
// refactor can't silently regress the recovery behaviour that
// unblocks Railway env-var pastes.

import { describe, it, expect } from 'vitest';
import { normalizePem } from '@/lib/github/app';

const BODY_LINES = [
  'MIIEowIBAAKCAQEAuVeYW0aW3Hc2YPQ4lZAfXQpzJBh1qPB6X1qNYHk0Sz4qLrFA',
  'k8m3FQpJHKt6rT9o4Yp2WzD0lEXcN0v8xQ4Y0bZjF3pLcQyP1rXrFwT9G4M6vG2N',
  '/aB5QqYjU0kF7y6X2hRzG2nN7pY8mZkH3uTbVcK6XfP9YqLrFvT1lZHkP0sBcG6X',
  'hYfNkV3MzN1QmJp8nZ8M6vXf3WjG2yT4kQpJHKt6rT9o4Yp2WzD0lEXcN0v8xQ4Y',
  '0bZjF3pLcQyP1rXrFwT9G4M6vG2NABCDEFGHIJKLMNOPQRSTUVWXYZabcdef==',
];
const CANONICAL_PEM =
  ['-----BEGIN RSA PRIVATE KEY-----', ...BODY_LINES, '-----END RSA PRIVATE KEY-----', ''].join('\n');

describe('normalizePem', () => {
  it('passes through an already-canonical multi-line PEM', () => {
    expect(normalizePem(CANONICAL_PEM)).toBe(CANONICAL_PEM);
  });

  it('strips surrounding double quotes', () => {
    const wrapped = `"${CANONICAL_PEM}"`;
    expect(normalizePem(wrapped)).toBe(CANONICAL_PEM);
  });

  it('strips surrounding single quotes', () => {
    const wrapped = `'${CANONICAL_PEM}'`;
    expect(normalizePem(wrapped)).toBe(CANONICAL_PEM);
  });

  it('only strips ONE layer of wrapping quotes', () => {
    // Defensive: if a value was double-quoted (legitimately escaped), we
    // should not eat the inner quotes too.
    const inner = `"actual"`;
    const wrapped = `"${inner}"`;
    expect(normalizePem(wrapped)).toBe(inner);
  });

  it('decodes literal \\n escape sequences to real newlines', () => {
    const escaped = CANONICAL_PEM.replace(/\n/g, '\\n');
    expect(normalizePem(escaped)).toBe(CANONICAL_PEM);
  });

  it('normalises CRLF line endings', () => {
    const crlf = CANONICAL_PEM.replace(/\n/g, '\r\n');
    expect(normalizePem(crlf)).toBe(CANONICAL_PEM);
  });

  it('normalises lone CR line endings', () => {
    const cr = CANONICAL_PEM.replace(/\n/g, '\r');
    expect(normalizePem(cr)).toBe(CANONICAL_PEM);
  });

  it('rebuilds a single-line PEM by re-wrapping the base64 body', () => {
    // Simulates Railway/Vercel UI swallowing the newlines on paste.
    const oneLine = `-----BEGIN RSA PRIVATE KEY-----${BODY_LINES.join('')}-----END RSA PRIVATE KEY-----`;
    const out = normalizePem(oneLine);
    // The re-wrapped form must contain the BEGIN/END markers on their own
    // lines and 64-char body chunks between them.
    expect(out.startsWith('-----BEGIN RSA PRIVATE KEY-----\n')).toBe(true);
    expect(out.includes('\n-----END RSA PRIVATE KEY-----\n')).toBe(true);
    // Round-trip: stripping whitespace must give the same base64 body back.
    const bodyOut = out
      .replace('-----BEGIN RSA PRIVATE KEY-----', '')
      .replace('-----END RSA PRIVATE KEY-----', '')
      .replace(/\s+/g, '');
    expect(bodyOut).toBe(BODY_LINES.join(''));
  });

  it('strips leading and trailing whitespace from the input', () => {
    const padded = `   \n\n${CANONICAL_PEM}\n\n   `;
    expect(normalizePem(padded)).toBe(CANONICAL_PEM);
  });

  it('handles a value that combines several pathologies at once', () => {
    // Quoted + CRLF + literal \n + trailing whitespace — a realistic
    // worst-case after a copy through three different tools.
    const ugly = `"  ${CANONICAL_PEM.replace(/\n/g, '\\n').replace(/\\n/g, '\r\n')}  "`;
    expect(normalizePem(ugly)).toBe(CANONICAL_PEM);
  });

  it('returns input unchanged when no BEGIN/END markers are present', () => {
    // Caller is responsible for raising the "missing markers" error; the
    // normalizer should NOT invent or hallucinate markers around random text.
    const garbage = 'just some random text with no markers';
    expect(normalizePem(garbage)).toBe(garbage);
  });

  it('is idempotent — normalising twice gives the same result as once', () => {
    // Regression guard: a future change that, say, always appended a newline
    // would break idempotency and slowly grow the value on each pass.
    const once  = normalizePem(`"${CANONICAL_PEM.replace(/\n/g, '\\n')}"`);
    const twice = normalizePem(once);
    expect(twice).toBe(once);
  });

  it('supports the PKCS#8 "BEGIN PRIVATE KEY" header form too', () => {
    const pkcs8 = CANONICAL_PEM
      .replace('-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----')
      .replace('-----END RSA PRIVATE KEY-----', '-----END PRIVATE KEY-----');
    // Single-line PKCS#8 should still be rebuilt correctly.
    const oneLine = pkcs8.replace(/\n/g, '');
    const out = normalizePem(oneLine);
    expect(out.includes('-----BEGIN PRIVATE KEY-----')).toBe(true);
    expect(out.includes('-----END PRIVATE KEY-----')).toBe(true);
  });
});
