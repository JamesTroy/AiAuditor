# Database Infrastructure — Audit Input

## Database context
- **Database engine & version**: PostgreSQL (version managed by Supabase — likely 15.x)
- **Hosting**: Supabase (managed PostgreSQL on AWS)
- **ORM / driver**: Drizzle ORM v0.45.1 + `postgres` (postgres.js) v3.4.8
- **Size**: 6 tables, all new/low row count (app recently launched)
- **Traffic**: Low — single-digit QPS, mix of reads (session lookups) and writes (signups, audits)
- **Replication**: Single instance (Supabase free/pro tier, no read replicas configured)
- **Known concerns**:
  - Production DB connection failing from Railway (IPv4/IPv6 connectivity issue with Supabase)
  - No connection pooling configured (no PgBouncer, raw postgres.js connection)
  - Schema pushed via `drizzle-kit push` — no versioned migration files exist
  - No indexes beyond primary keys and one unique constraint on `user.email`
  - No backup verification process

---

## 1. Schema — Drizzle ORM (complete)

```
--- lib/auth-schema.ts ---
```

```typescript
import { pgTable, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';

// ─── Better Auth core tables ────────────────────────────────────

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  // admin plugin
  role: text('role').default('user'),
  banned: boolean('banned').default(false),
  banReason: text('banReason'),
  banExpires: timestamp('banExpires'),
  // 2FA plugin
  twoFactorEnabled: boolean('twoFactorEnabled').default(false),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expiresAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  idToken: text('idToken'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

// ─── 2FA plugin table ───────────────────────────────────────────

export const twoFactorTable = pgTable('twoFactor', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  secret: text('secret').notNull(),
  backupCodes: text('backupCodes').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

// ─── App-specific tables ────────────────────────────────────────

export const audit = pgTable('audit', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  agentId: text('agentId').notNull(),
  agentName: text('agentName').notNull(),
  input: text('input').notNull(),
  result: text('result'),
  status: text('status').notNull().default('pending'), // pending | running | completed | failed
  score: integer('score'),
  durationMs: integer('durationMs'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});
```

### Table summary

| Table | Purpose | Estimated rows | Key constraints |
|-------|---------|---------------|-----------------|
| `user` | User accounts | <50 | PK(`id`), UNIQUE(`email`) |
| `session` | Active sessions | <100 | PK(`id`), UNIQUE(`token`), FK→user(CASCADE) |
| `account` | OAuth provider links + password hash | <50 | PK(`id`), FK→user(CASCADE) |
| `verification` | Email verification tokens | <20 | PK(`id`) |
| `twoFactor` | 2FA secrets + backup codes | 0 | PK(`id`), FK→user(CASCADE) |
| `audit` | Audit run history | <200 | PK(`id`), FK→user(CASCADE) |

### Indexes
- Only **primary keys** and two **unique constraints** (`user.email`, `session.token`)
- **No secondary indexes** on: `session.userId`, `session.expiresAt`, `account.userId`, `account.providerId`, `audit.userId`, `audit.createdAt`, `audit.status`

---

## 2. Migration files

**None.** Schema is managed via `drizzle-kit push` which applies changes directly to the live database without generating migration files.

```
--- package.json (relevant scripts) ---
```

```json
{
  "scripts": {
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

```
--- drizzle.config.ts ---
```

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './lib/auth-schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Note:** The `./drizzle` output directory does not exist — no migration files have ever been generated.

---

## 3. Connection and pool configuration

```
--- lib/db.ts ---
```

```typescript
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/lib/auth-schema';

const client = postgres(process.env.DATABASE_URL!);

export const db = drizzle({ client, schema });
```

### Connection configuration notes
- **No pool settings configured** — uses postgres.js defaults (max 10 connections)
- **No idle timeout, connection timeout, or statement timeout**
- **No SSL mode** explicitly set (relies on Supabase default)
- **No retry/reconnection logic**
- **No read replica routing** — single connection to primary
- **No PgBouncer or proxy** — direct connection from Railway to Supabase
- **Known issue:** Railway (IPv6) cannot connect to Supabase direct connection; Supabase Session pooler (`aws-0-*.pooler.supabase.com:5432`) also failing; dedicated IPv4 add-on recently purchased but connection still not working

```
--- .env.example (connection string pattern) ---
```

```
DATABASE_URL=postgresql://...          # Supabase PostgreSQL connection string
```

**Production:** `postgresql://postgres.mtvkcwxussbllyesrhgw:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres`

---

## 4. Query patterns

### Signup flow (Better Auth internal)
- `INSERT INTO "user"` — create user record
- `INSERT INTO "account"` — create credential record with hashed password
- `INSERT INTO "session"` — create session

### Session validation (every authenticated request)
- `SELECT * FROM "session" WHERE "token" = $1` — validate session token
- `SELECT * FROM "user" WHERE "id" = $1` — fetch user for session

### Audit creation and update

```
--- app/api/audit/route.ts (relevant queries) ---
```

```typescript
// Create audit record (on audit start, if user logged in)
await db.insert(auditTable).values({
  id,           // crypto.randomUUID()
  userId,
  agentId,
  agentName,
  input: data.input.slice(0, 10_000), // truncate to first 10K chars
  status: 'running',
});

// Update on completion (fire-and-forget, no await)
db.update(auditTable)
  .set({
    result: fullResult,       // full audit text (unbounded size)
    status: 'completed',
    score: score,             // parsed from "XX/100" pattern in result
    durationMs: Date.now() - auditRecord.startedAt,
    updatedAt: new Date(),
  })
  .where(eq(auditTable.id, auditRecord.id))
  .then(...)
  .catch(...);

// Update on failure (fire-and-forget)
db.update(auditTable)
  .set({ status: 'failed', durationMs: ..., updatedAt: new Date() })
  .where(eq(auditTable.id, auditRecord.id))
  .catch(() => {});
```

### Health check

```typescript
// Health check — SELECT 1
await db.execute(sql`SELECT 1 as ok`);
// Table listing
await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
```

### No N+1 patterns detected (simple insert/update/select-by-PK operations only)
### No full-text search
### No query caching layer

---

## 5. Backup and recovery

- **Supabase automated backups**: Enabled by default (daily for Pro plan, every 24h retention varies by plan)
- **Point-in-time recovery**: Available on Pro plan (7-day window)
- **No manual backup scripts** in the codebase
- **No backup verification** process documented or scripted
- **No cross-region replication**

---

## 6. Monitoring and maintenance

- **No slow query logging configured** in application code
- **No pg_stat_statements** setup
- **No VACUUM/ANALYZE scheduling** (relies on Supabase auto-vacuum)
- **No storage monitoring**
- **No alerting** on connection count, disk usage, or long-running queries
- **Health check endpoint exists** at `/api/health/db`:

```
--- app/api/health/db/route.ts ---
```

```typescript
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await db.execute(sql`SELECT 1 as ok`);
    const tables = await db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    return Response.json({
      db: 'connected',
      tables: tables.map((r: Record<string, unknown>) => r.tablename),
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    return Response.json(
      {
        db: 'error',
        message: e.message,
        code: 'code' in e ? (e as Record<string, unknown>).code : undefined,
        dbHost: (process.env.DATABASE_URL ?? '').replace(/\/\/.*:.*@/, '//***:***@'),
      },
      { status: 500 }
    );
  }
}
```

---

## 7. Security

### Database user roles
- Single connection user: `postgres.mtvkcwxussbllyesrhgw` (Supabase project-scoped user — has full access to project schema)
- No read-only users configured
- No separate application user with limited permissions

### Row-level security (RLS)
- **Not configured** — no RLS policies in the Drizzle schema
- Supabase RLS may be disabled on these tables (Better Auth requires direct access)

### Encryption at rest
- Supabase encrypts data at rest by default (AWS EBS encryption)

### SSL/TLS
- No explicit `sslmode` in connection string
- Supabase pooler connections use SSL by default

### Sensitive data stored in database
- `account.password` — hashed passwords (Better Auth uses bcrypt/argon2)
- `account.accessToken` / `account.refreshToken` — OAuth tokens (plaintext)
- `account.idToken` — OIDC identity token (plaintext)
- `twoFactor.secret` — TOTP secret key (plaintext)
- `twoFactor.backupCodes` — 2FA backup codes (plaintext)
- `session.ipAddress` — user IP addresses
- `audit.input` — user-submitted code/text (first 10K chars)
- `audit.result` — full audit output text

### Audit logging
- No database-level audit logging
- Application-level structured JSON logging for audit operations (start, complete, fail, save)

---

## Auth configuration (Better Auth)

```
--- lib/auth.ts ---
```

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/lib/db';
import * as schema from '@/lib/auth-schema';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'Claudit <noreply@claudit.consulting>';

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[email] To: ${to} | Subject: ${subject}`);
    console.log(`[email] (No RESEND_API_KEY — email not sent)`);
    return;
  }
  await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
}

export const auth = betterAuth({
  appName: 'Claudit',

  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    ...(process.env.NEXT_PUBLIC_APP_URL &&
    process.env.NEXT_PUBLIC_APP_URL !== process.env.BETTER_AUTH_URL
      ? [process.env.NEXT_PUBLIC_APP_URL]
      : []),
    ...(process.env.RAILWAY_PUBLIC_DOMAIN
      ? [`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`]
      : []),
  ],

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { ...schema },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        'Reset your Claudit password',
        `<p>Hi ${user.name},</p>
         <p>Click the link below to reset your password:</p>
         <p><a href="${url}">Reset password</a></p>
         <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
      );
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        'Verify your Claudit email',
        `<p>Hi ${user.name},</p>
         <p>Click below to verify your email address:</p>
         <p><a href="${url}">Verify email</a></p>`,
      );
    },
  },

  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID && {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    }),
  },

  plugins: [
    nextCookies(),
    admin(),
    twoFactor({
      issuer: 'Claudit',
      otpOptions: {
        async sendOTP({ user, otp }) {
          await sendEmail(
            user.email,
            'Your Claudit verification code',
            `<p>Hi ${user.name},</p>
             <p>Your two-factor code is: <strong>${otp}</strong></p>
             <p>This code expires in 5 minutes.</p>`,
          );
        },
      },
    }),
  ],
});
```

---

## Dependencies

```json
{
  "drizzle-orm": "0.45.1",
  "drizzle-kit": "^0.31.9",
  "postgres": "3.4.8",
  "better-auth": "1.5.5"
}
```
