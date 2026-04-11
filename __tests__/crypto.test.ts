import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We test encrypt/decrypt by importing the module fresh with controlled env vars.
// Since the module caches keys lazily, we reset the module cache between tests.

const TEST_KEY_A = 'a'.repeat(64); // 64 hex chars = 256 bits
const TEST_KEY_B = 'b'.repeat(64);

describe('crypto (versioned key rotation)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Reset module cache so lazy key loading re-initializes.
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  async function loadCrypto() {
    return await import('@/lib/crypto');
  }

  // ------------------------------------------------------------------
  // Basic encrypt/decrypt round-trip
  // ------------------------------------------------------------------

  it('encrypts and decrypts a string with the current key', async () => {
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_A;
    delete process.env.TOTP_ENCRYPTION_KEY_PREV;
    const { encrypt, decrypt } = await loadCrypto();

    const plaintext = 'JBSWY3DPEHPK3PXP'; // typical TOTP secret
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('returns plaintext when no key is set (dev mode)', async () => {
    delete process.env.TOTP_ENCRYPTION_KEY;
    delete process.env.TOTP_ENCRYPTION_KEY_PREV;
    const { encrypt, decrypt } = await loadCrypto();

    const plaintext = 'my secret';
    expect(encrypt(plaintext)).toBe(plaintext);
    expect(decrypt(plaintext)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV)', async () => {
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_A;
    const { encrypt } = await loadCrypto();

    const a = encrypt('same input');
    const b = encrypt('same input');
    expect(a).not.toBe(b);
  });

  // ------------------------------------------------------------------
  // Versioned format
  // ------------------------------------------------------------------

  it('new encryptions use versioned format (v1: prefix)', async () => {
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_A;
    const { encrypt } = await loadCrypto();
    expect(encrypt('test')).toMatch(/^v1:/);
  });

  // ------------------------------------------------------------------
  // Key rotation: decrypt with previous key
  // ------------------------------------------------------------------

  it('decrypts data encrypted with the previous key', async () => {
    // Step 1: Encrypt with key A (as "current")
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_A;
    delete process.env.TOTP_ENCRYPTION_KEY_PREV;
    const crypto1 = await loadCrypto();
    const encryptedWithA = crypto1.encrypt('secret data');

    // Step 2: Rotate — key B is now current, key A is previous
    vi.resetModules();
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_B;
    process.env.TOTP_ENCRYPTION_KEY_PREV = TEST_KEY_A;
    const crypto2 = await loadCrypto();

    // Should decrypt old data using the previous key
    const decrypted = crypto2.decrypt(encryptedWithA);
    expect(decrypted).toBe('secret data');
  });

  it('prefers current key for decryption when both could work', async () => {
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_A;
    delete process.env.TOTP_ENCRYPTION_KEY_PREV;
    const { encrypt, decrypt } = await loadCrypto();

    const encrypted = encrypt('test');
    // Current key decrypts without needing previous key
    const result = decrypt(encrypted);
    expect(result).toBe('test');
  });

  it('new encryptions always use the current key', async () => {
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_B;
    process.env.TOTP_ENCRYPTION_KEY_PREV = TEST_KEY_A;
    const { encrypt, decrypt } = await loadCrypto();

    const encrypted = encrypt('new data');

    // Decrypt with only key B (no previous key) should work
    vi.resetModules();
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_B;
    delete process.env.TOTP_ENCRYPTION_KEY_PREV;
    const crypto2 = await loadCrypto();

    expect(crypto2.decrypt(encrypted)).toBe('new data');
  });

  it('throws when neither key can decrypt', async () => {
    // Encrypt with key A
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_A;
    delete process.env.TOTP_ENCRYPTION_KEY_PREV;
    const crypto1 = await loadCrypto();
    const encrypted = crypto1.encrypt('secret');

    // Try to decrypt with only key B (key A is gone)
    vi.resetModules();
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_B;
    delete process.env.TOTP_ENCRYPTION_KEY_PREV;
    const crypto2 = await loadCrypto();

    expect(() => crypto2.decrypt(encrypted)).toThrow('Decryption failed');
  });

  // ------------------------------------------------------------------
  // Legacy unversioned format
  // ------------------------------------------------------------------

  it('decrypts legacy unversioned format (pre-rotation)', async () => {
    // Simulate the old encrypt function (no version prefix)
    const { createCipheriv, randomBytes } = await import('crypto');
    const key = Buffer.from(TEST_KEY_A, 'hex');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update('legacy secret', 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const legacyCiphertext = `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;

    // Should NOT have v1: prefix
    expect(legacyCiphertext).not.toMatch(/^v/);

    // Should still decrypt with current key
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_A;
    delete process.env.TOTP_ENCRYPTION_KEY_PREV;
    const { decrypt } = await loadCrypto();
    expect(decrypt(legacyCiphertext)).toBe('legacy secret');
  });

  // ------------------------------------------------------------------
  // isCurrentKeyEncryption
  // ------------------------------------------------------------------

  it('isCurrentKeyEncryption returns true for current-key ciphertext', async () => {
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_A;
    delete process.env.TOTP_ENCRYPTION_KEY_PREV;
    const { encrypt, isCurrentKeyEncryption } = await loadCrypto();
    expect(isCurrentKeyEncryption(encrypt('test'))).toBe(true);
  });

  it('isCurrentKeyEncryption returns false for previous-key ciphertext', async () => {
    // Encrypt with key A
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_A;
    const crypto1 = await loadCrypto();
    const encrypted = crypto1.encrypt('test');

    // Switch to key B
    vi.resetModules();
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_B;
    process.env.TOTP_ENCRYPTION_KEY_PREV = TEST_KEY_A;
    const crypto2 = await loadCrypto();

    expect(crypto2.isCurrentKeyEncryption(encrypted)).toBe(false);
  });

  it('isCurrentKeyEncryption returns false for plaintext', async () => {
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_A;
    const { isCurrentKeyEncryption } = await loadCrypto();
    expect(isCurrentKeyEncryption('not encrypted')).toBe(false);
  });

  // ------------------------------------------------------------------
  // Key validation
  // ------------------------------------------------------------------

  it('throws on invalid key length', async () => {
    process.env.TOTP_ENCRYPTION_KEY = 'too-short';
    const { encrypt } = await loadCrypto();
    expect(() => encrypt('test')).toThrow('64-character hex string');
  });
});
