// CLOUD-001/002: AES-256-GCM application-layer encryption for sensitive DB columns.
//
// Used by Drizzle custom column types to transparently encrypt TOTP secrets,
// backup codes, and OAuth tokens before writing to the database and decrypt
// on read. When TOTP_ENCRYPTION_KEY is not set (local development), functions
// are no-ops — data passes through unencrypted.
//
// CRYPTO-ROTATE: Versioned ciphertext format supports key rotation:
//   - New encryptions always use the current key with a version prefix.
//   - Decryption tries the current key, then falls back to the previous key.
//   - Old unversioned format (pre-rotation) is handled transparently.
//   - Run `scripts/rotate-encryption-key.ts` to re-encrypt all rows after rotation.
//
// Environment variables:
//   TOTP_ENCRYPTION_KEY       — Current key (64-char hex = 256 bits). Used for all new encryptions.
//   TOTP_ENCRYPTION_KEY_PREV  — Previous key (optional). Used only for decryption fallback during rotation.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { customType } from 'drizzle-orm/pg-core';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

// Current version tag prepended to new ciphertext.
const CURRENT_VERSION = 'v1';

// Matches the OLD unversioned format: iv(24hex):tag(32hex):ciphertext(hex)
const UNVERSIONED_PATTERN = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

// Matches the NEW versioned format: v1:iv(24hex):tag(32hex):ciphertext(hex)
const VERSIONED_PATTERN = /^v\d+:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

// eslint-disable-next-line no-console
const log = (level: 'info' | 'warn', event: string, data?: Record<string, unknown>) =>
  console[level === 'warn' ? 'warn' : 'log'](JSON.stringify({
    ts: new Date().toISOString(), level, event, ...data,
  }));

// ── Key management ──────────────────────────────────────────────────

function parseKey(hex: string | undefined, name: string): Buffer | null {
  if (!hex) return null;
  if (hex.length !== 64) {
    throw new Error(`${name} must be a 64-character hex string (256 bits). Generate with: openssl rand -hex 32`);
  }
  return Buffer.from(hex, 'hex');
}

// Lazy-load keys to avoid throwing at module init in dev without the key.
let _currentKey: Buffer | null | undefined;
let _previousKey: Buffer | null | undefined;

function getCurrentKey(): Buffer | null {
  if (_currentKey !== undefined) return _currentKey;
  _currentKey = parseKey(process.env.TOTP_ENCRYPTION_KEY, 'TOTP_ENCRYPTION_KEY');
  return _currentKey;
}

function getPreviousKey(): Buffer | null {
  if (_previousKey !== undefined) return _previousKey;
  _previousKey = parseKey(process.env.TOTP_ENCRYPTION_KEY_PREV, 'TOTP_ENCRYPTION_KEY_PREV');
  return _previousKey;
}

/** Returns all available decryption keys in priority order (current first). */
function getDecryptionKeys(): Buffer[] {
  const keys: Buffer[] = [];
  const current = getCurrentKey();
  if (current) keys.push(current);
  const previous = getPreviousKey();
  if (previous) keys.push(previous);
  return keys;
}

// ── Encrypt / Decrypt ───────────────────────────────────────────────

/**
 * Encrypt plaintext using the current key.
 * Output format: `v1:iv(24hex):tag(32hex):ciphertext(hex)`
 */
export function encrypt(plaintext: string): string {
  const key = getCurrentKey();
  if (!key) return plaintext; // No-op in dev without key

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${CURRENT_VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt ciphertext. Tries the current key first, then the previous key.
 * Supports both versioned (`v1:...`) and unversioned (legacy) formats.
 */
export function decrypt(ciphertext: string): string {
  const keys = getDecryptionKeys();
  if (keys.length === 0) return ciphertext; // No-op in dev without key

  // Detect plaintext (not encrypted) — supports gradual migration.
  if (!VERSIONED_PATTERN.test(ciphertext) && !UNVERSIONED_PATTERN.test(ciphertext)) {
    return ciphertext;
  }

  // Parse versioned vs. unversioned format.
  let ivHex: string, tagHex: string, dataHex: string;

  if (ciphertext.startsWith('v')) {
    // Versioned: v1:iv:tag:data
    const parts = ciphertext.split(':');
    // parts[0] = version tag (e.g., 'v1')
    ivHex = parts[1];
    tagHex = parts[2];
    dataHex = parts[3];
  } else {
    // Unversioned (legacy): iv:tag:data
    const parts = ciphertext.split(':');
    ivHex = parts[0];
    tagHex = parts[1];
    dataHex = parts[2];
  }

  // Try each key in priority order.
  for (let i = 0; i < keys.length; i++) {
    try {
      const decipher = createDecipheriv(ALGORITHM, keys[i], Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      const result = decipher.update(Buffer.from(dataHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
      // If we decrypted with the previous key, log it so operators know
      // rotation is incomplete — re-encryption script should be run.
      if (i > 0) {
        log('info', 'decrypted_with_previous_key', { keyIndex: i });
      }
      return result;
    } catch {
      // Auth tag mismatch — this key didn't encrypt this value. Try next.
      continue;
    }
  }

  // All keys failed. This shouldn't happen unless keys were lost.
  log('warn', 'decryption_failed_all_keys', {
    keysAttempted: keys.length,
    ciphertextPrefix: ciphertext.slice(0, 30),
  });
  throw new Error('Decryption failed: no available key could decrypt this value. Was the encryption key rotated without running the re-encryption script?');
}

/**
 * Check whether a ciphertext string was encrypted with the current key.
 * Used by the rotation script to identify rows that need re-encryption.
 */
export function isCurrentKeyEncryption(ciphertext: string): boolean {
  const key = getCurrentKey();
  if (!key) return false;

  if (!VERSIONED_PATTERN.test(ciphertext) && !UNVERSIONED_PATTERN.test(ciphertext)) {
    return false; // plaintext
  }

  // Try decrypting with just the current key.
  let ivHex: string, tagHex: string, dataHex: string;
  if (ciphertext.startsWith('v')) {
    const parts = ciphertext.split(':');
    ivHex = parts[1]; tagHex = parts[2]; dataHex = parts[3];
  } else {
    const parts = ciphertext.split(':');
    ivHex = parts[0]; tagHex = parts[1]; dataHex = parts[2];
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    decipher.update(Buffer.from(dataHex, 'hex'));
    decipher.final();
    return true;
  } catch {
    return false; // Encrypted with a different key
  }
}

// ── Drizzle custom column type ──────────────────────────────────────

// Drizzle custom column type: transparently encrypts/decrypts text columns.
// PostgreSQL column type remains `text` — no migration needed for the column itself.
export const encryptedText = customType<{ data: string }>({
  dataType() {
    return 'text';
  },
  toDriver(value: string): string {
    return encrypt(value);
  },
  fromDriver(value: unknown): string {
    return decrypt(value as string);
  },
});
