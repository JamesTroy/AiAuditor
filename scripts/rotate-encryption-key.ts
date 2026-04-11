// CRYPTO-ROTATE: Re-encrypt all sensitive columns with the current key.
//
// Run this AFTER rotating the key:
//   1. Generate a new key: openssl rand -hex 32
//   2. Set TOTP_ENCRYPTION_KEY_PREV to the old key value
//   3. Set TOTP_ENCRYPTION_KEY to the new key value
//   4. Deploy (app can now decrypt with both keys)
//   5. Run this script to re-encrypt everything with the new key:
//      TOTP_ENCRYPTION_KEY=<new> TOTP_ENCRYPTION_KEY_PREV=<old> DATABASE_URL=<url> npx tsx scripts/rotate-encryption-key.ts
//   6. After verifying, remove TOTP_ENCRYPTION_KEY_PREV from the environment.
//
// Safe to run multiple times — detects rows already encrypted with the current key and skips them.
// Performs a dry run by default — pass --commit to actually write changes.

import postgres from 'postgres';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const UNVERSIONED_PATTERN = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;
const VERSIONED_PATTERN = /^v\d+:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;
const CURRENT_VERSION = 'v1';

// ── Key setup ───────────────────────────────────────────────────────

const currentKeyHex = process.env.TOTP_ENCRYPTION_KEY;
const previousKeyHex = process.env.TOTP_ENCRYPTION_KEY_PREV;

if (!currentKeyHex || currentKeyHex.length !== 64) {
  console.error('TOTP_ENCRYPTION_KEY must be a 64-char hex string. Generate: openssl rand -hex 32');
  process.exit(1);
}
if (!previousKeyHex || previousKeyHex.length !== 64) {
  console.error('TOTP_ENCRYPTION_KEY_PREV must be set to the old key for rotation.');
  process.exit(1);
}
if (currentKeyHex === previousKeyHex) {
  console.error('TOTP_ENCRYPTION_KEY and TOTP_ENCRYPTION_KEY_PREV are identical — no rotation needed.');
  process.exit(1);
}

const CURRENT_KEY = Buffer.from(currentKeyHex, 'hex');
const PREVIOUS_KEY = Buffer.from(previousKeyHex, 'hex');
const ALL_KEYS = [CURRENT_KEY, PREVIOUS_KEY];

const isDryRun = !process.argv.includes('--commit');

// ── Crypto helpers ──────────────────────────────────────────────────

function encryptWithCurrent(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, CURRENT_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${CURRENT_VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptWithAnyKey(ciphertext: string): string | null {
  if (!VERSIONED_PATTERN.test(ciphertext) && !UNVERSIONED_PATTERN.test(ciphertext)) {
    return ciphertext; // plaintext
  }

  let ivHex: string, tagHex: string, dataHex: string;
  if (ciphertext.startsWith('v')) {
    const parts = ciphertext.split(':');
    ivHex = parts[1]; tagHex = parts[2]; dataHex = parts[3];
  } else {
    const parts = ciphertext.split(':');
    ivHex = parts[0]; tagHex = parts[1]; dataHex = parts[2];
  }

  for (const key of ALL_KEYS) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      return decipher.update(Buffer.from(dataHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
    } catch {
      continue;
    }
  }
  return null; // Could not decrypt with any key
}

function isEncryptedWithCurrentKey(ciphertext: string): boolean {
  if (!VERSIONED_PATTERN.test(ciphertext) && !UNVERSIONED_PATTERN.test(ciphertext)) {
    return false;
  }

  let ivHex: string, tagHex: string, dataHex: string;
  if (ciphertext.startsWith('v')) {
    const parts = ciphertext.split(':');
    ivHex = parts[1]; tagHex = parts[2]; dataHex = parts[3];
  } else {
    const parts = ciphertext.split(':');
    ivHex = parts[0]; tagHex = parts[1]; dataHex = parts[2];
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, CURRENT_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    decipher.update(Buffer.from(dataHex, 'hex'));
    decipher.final();
    return true;
  } catch {
    return false;
  }
}

// ── Re-encryption logic ─────────────────────────────────────────────

async function reEncryptColumn(
  sql: postgres.Sql,
  table: string,
  column: string,
  label: string,
): Promise<{ total: number; rotated: number; skipped: number; failed: number }> {
  const rows = await sql.unsafe(`SELECT id, "${column}" FROM "${table}" WHERE "${column}" IS NOT NULL`);
  let rotated = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    const value = row[column] as string;
    if (!value) { skipped++; continue; }

    // Already encrypted with current key — skip.
    if (isEncryptedWithCurrentKey(value)) {
      skipped++;
      continue;
    }

    // Decrypt with any available key, then re-encrypt with current.
    const plaintext = decryptWithAnyKey(value);
    if (plaintext === null) {
      console.error(`  FAILED: ${table}.${column} id=${row.id} — could not decrypt with any key`);
      failed++;
      continue;
    }

    const reEncrypted = encryptWithCurrent(plaintext);

    if (!isDryRun) {
      await sql.unsafe(
        `UPDATE "${table}" SET "${column}" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [reEncrypted, row.id],
      );
    }
    rotated++;
  }

  console.log(`  ${label}: ${rotated} rotated, ${skipped} already current, ${failed} failed (${rows.length} total)`);
  return { total: rows.length, rotated, skipped, failed };
}

async function main() {
  if (isDryRun) {
    console.log('=== DRY RUN — pass --commit to apply changes ===\n');
  } else {
    console.log('=== COMMITTING CHANGES ===\n');
  }

  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

  console.log('--- twoFactor table ---');
  await reEncryptColumn(sql, 'twoFactor', 'secret', 'secret');
  await reEncryptColumn(sql, 'twoFactor', 'backupCodes', 'backupCodes');

  console.log('\n--- account table ---');
  await reEncryptColumn(sql, 'account', 'accessToken', 'accessToken');
  await reEncryptColumn(sql, 'account', 'refreshToken', 'refreshToken');
  await reEncryptColumn(sql, 'account', 'idToken', 'idToken');

  if (isDryRun) {
    console.log('\n=== DRY RUN COMPLETE — no changes written. Run with --commit to apply. ===');
  } else {
    console.log('\n=== ROTATION COMPLETE ===');
    console.log('Next steps:');
    console.log('  1. Verify the app works correctly with the new key.');
    console.log('  2. Remove TOTP_ENCRYPTION_KEY_PREV from the environment.');
  }

  await sql.end();
}

main().catch((err) => {
  console.error('Rotation failed:', err);
  process.exit(1);
});
