// CLOUD-001/002: One-time migration script to encrypt existing plaintext values.
//
// Usage: TOTP_ENCRYPTION_KEY=<hex> DATABASE_URL=<url> npx tsx scripts/encrypt-sensitive-columns.ts
//
// Safe to run multiple times — detects already-encrypted values and skips them.

import postgres from 'postgres';
import { createCipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTED_PATTERN = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

const keyHex = process.env.TOTP_ENCRYPTION_KEY;
if (!keyHex || keyHex.length !== 64) {
  console.error('TOTP_ENCRYPTION_KEY must be a 64-char hex string. Generate: openssl rand -hex 32');
  process.exit(1);
}
const KEY = Buffer.from(keyHex, 'hex');

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function isEncrypted(value: string): boolean {
  return ENCRYPTED_PATTERN.test(value);
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

  console.log('--- Encrypting twoFactor table (secret, backupCodes) ---');
  const twoFactorRows = await sql`SELECT id, secret, "backupCodes" FROM "twoFactor"`;
  let tfEncrypted = 0;
  for (const row of twoFactorRows) {
    const updates: Record<string, string> = {};
    if (row.secret && !isEncrypted(row.secret)) updates.secret = encrypt(row.secret);
    if (row.backupCodes && !isEncrypted(row.backupCodes)) updates.backupCodes = encrypt(row.backupCodes);
    if (Object.keys(updates).length > 0) {
      await sql`UPDATE "twoFactor" SET
        secret = ${updates.secret ?? row.secret},
        "backupCodes" = ${updates.backupCodes ?? row.backupCodes},
        "updatedAt" = NOW()
        WHERE id = ${row.id}`;
      tfEncrypted++;
    }
  }
  console.log(`  Encrypted ${tfEncrypted}/${twoFactorRows.length} rows`);

  console.log('--- Encrypting account table (accessToken, refreshToken, idToken) ---');
  const accountRows = await sql`SELECT id, "accessToken", "refreshToken", "idToken" FROM account`;
  let acctEncrypted = 0;
  for (const row of accountRows) {
    const updates: Record<string, string | null> = {};
    if (row.accessToken && !isEncrypted(row.accessToken)) updates.accessToken = encrypt(row.accessToken);
    if (row.refreshToken && !isEncrypted(row.refreshToken)) updates.refreshToken = encrypt(row.refreshToken);
    if (row.idToken && !isEncrypted(row.idToken)) updates.idToken = encrypt(row.idToken);
    if (Object.keys(updates).length > 0) {
      await sql`UPDATE account SET
        "accessToken" = ${updates.accessToken ?? row.accessToken},
        "refreshToken" = ${updates.refreshToken ?? row.refreshToken},
        "idToken" = ${updates.idToken ?? row.idToken},
        "updatedAt" = NOW()
        WHERE id = ${row.id}`;
      acctEncrypted++;
    }
  }
  console.log(`  Encrypted ${acctEncrypted}/${accountRows.length} rows`);

  console.log('Done.');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
