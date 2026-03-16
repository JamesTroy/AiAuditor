// CLOUD-001/002: AES-256-GCM application-layer encryption for sensitive DB columns.
//
// Used by Drizzle custom column types to transparently encrypt TOTP secrets,
// backup codes, and OAuth tokens before writing to the database and decrypt
// on read. When TOTP_ENCRYPTION_KEY is not set (local development), functions
// are no-ops — data passes through unencrypted.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { customType } from 'drizzle-orm/pg-core';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

// Lazy-load key to avoid throwing at module init in dev without the key.
let _key: Buffer | null | undefined;
function getKey(): Buffer | null {
  if (_key !== undefined) return _key;
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex) {
    _key = null;
    return null;
  }
  if (hex.length !== 64) {
    throw new Error('TOTP_ENCRYPTION_KEY must be a 64-character hex string (256 bits). Generate with: openssl rand -hex 32');
  }
  _key = Buffer.from(hex, 'hex');
  return _key;
}

// Encrypted format: iv(24hex):tag(32hex):ciphertext(hex)
const ENCRYPTED_PATTERN = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  if (!key) return ciphertext;

  // Detect plaintext (not encrypted) — supports gradual migration.
  if (!ENCRYPTED_PATTERN.test(ciphertext)) return ciphertext;

  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
}

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
