// Coverage for verifyWebhookSignature — locks in the structural validation
// step that closes the timing-oracle path Claudit flagged on PR #17.

import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { verifyWebhookSignature } from '@/lib/github/app';

const SECRET = 'test-webhook-secret-please-do-not-use-in-prod';
const BODY = JSON.stringify({ action: 'opened', number: 1 });

function validSig(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyWebhookSignature', () => {
  beforeEach(() => {
    process.env.GITHUB_APP_WEBHOOK_SECRET = SECRET;
  });

  it('accepts a valid signature for the given body', () => {
    expect(verifyWebhookSignature(BODY, validSig(BODY, SECRET))).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    expect(verifyWebhookSignature(BODY, validSig(BODY, 'different-secret'))).toBe(false);
  });

  it('rejects when the body has been tampered with', () => {
    const sig = validSig(BODY, SECRET);
    expect(verifyWebhookSignature(BODY + ' ', sig)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifyWebhookSignature(BODY, null)).toBe(false);
  });

  it('rejects when the env secret is unset', () => {
    delete process.env.GITHUB_APP_WEBHOOK_SECRET;
    expect(verifyWebhookSignature(BODY, validSig(BODY, SECRET))).toBe(false);
  });

  it('rejects a scheme other than sha256 (e.g. sha1)', () => {
    const hex = createHmac('sha256', SECRET).update(BODY).digest('hex');
    expect(verifyWebhookSignature(BODY, `sha1=${hex}`)).toBe(false);
  });

  it('rejects a header missing the scheme=hex separator', () => {
    const hex = createHmac('sha256', SECRET).update(BODY).digest('hex');
    expect(verifyWebhookSignature(BODY, hex)).toBe(false);
  });

  // This is the timing-oracle case the Claudit audit flagged on PR #17.
  // Before the fix, a 64-char string of non-hex chars (e.g. all 'z's) passed
  // the length check, then Buffer.from(_, 'hex') truncated silently,
  // timingSafeEqual threw, the catch returned false — and that path was
  // measurably faster than the constant-time compare.
  it('rejects a 64-char non-hex string without taking the throw path', () => {
    const sixtyFourZs = 'z'.repeat(64);
    expect(verifyWebhookSignature(BODY, `sha256=${sixtyFourZs}`)).toBe(false);
  });

  it('rejects a mixed hex/non-hex 64-char string (truncation attack)', () => {
    const trick = 'a'.repeat(32) + 'z'.repeat(32);
    expect(verifyWebhookSignature(BODY, `sha256=${trick}`)).toBe(false);
  });

  it('rejects a too-short hex string', () => {
    const short = 'a'.repeat(63);
    expect(verifyWebhookSignature(BODY, `sha256=${short}`)).toBe(false);
  });

  it('rejects a too-long hex string', () => {
    const long = 'a'.repeat(65);
    expect(verifyWebhookSignature(BODY, `sha256=${long}`)).toBe(false);
  });

  it('accepts a valid uppercase hex signature too', () => {
    const hex = createHmac('sha256', SECRET).update(BODY).digest('hex').toUpperCase();
    expect(verifyWebhookSignature(BODY, `sha256=${hex}`)).toBe(true);
  });
});
