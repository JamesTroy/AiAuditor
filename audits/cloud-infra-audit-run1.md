I'll systematically enumerate every resource and trust boundary before writing the report.

**Resources inventoried:**
- Railway PaaS (Next.js 15, Node.js) — single environment, auto-deploy from GitHub main
- Supabase managed PostgreSQL (AWS-backed) — direct connection from app
- GitHub Actions CI/CD pipeline
- better-auth session/auth system with 2FA, admin plugin
- Anthropic Claude API (external, egress only)
- Resend email API (external, egress only)
- Drizzle ORM schema (user, session, account, verification, twoFactor, audit tables)
- Middleware.ts (CSP nonce, auth gate, security headers)
- In-memory rate limiting (referenced in context, not shown in files)
- URL allowlist proxy (urlAllowlist.ts)
- API headers config (apiHeaders.ts)
- Dependabot, npm audit in CI

**Blast radius assessment per domain:**
- IAM: No formal IAM (PaaS), but secrets in env vars, no rotation, GitHub Actions has dummy key in build env, OAuth secrets conditionally loaded
- Network: No VPC config visible (PaaS abstraction), CORS origins computed at module load, no WAF, no DDoS protection visible
- Data: SSL required on DB connection, no encryption-at-rest config visible (Supabase managed), TOTP secrets and backup codes stored plaintext in DB, OAuth tokens stored plaintext in account table, no field-level encryption
- Compute: PaaS (no EC2/container config visible), single environment, no staging
- Secrets: No hardcoded secrets found, but no rotation policy, no secrets manager, env vars only, HEALTH_SECRET/REVALIDATION_SECRET/API_ACCESS_TOKEN are optional (may be unset)
- Resilience: Single environment, single region (Railway default), in-memory rate limiting (lost on restart/scale), no backup strategy visible beyond Supabase managed backups
- Auth: requireEmailVerification: false, no account lockout visible, 2FA optional not enforced, admin plugin with no visible RBAC guards on routes beyond middleware prefix check

---

# Cloud Infrastructure Security Review
**Target:** Claudit — Next.js 15 / Railway (GCP PaaS) + Supabase PostgreSQL (AWS managed)
**IaC Tool:** None (dashboard + GitHub auto-deploy)
**Review Date:** 2025

---

## 1. Executive Summary

This review covers a Next.js 15 application deployed on Railway (GCP-backed PaaS) with a Supabase-managed PostgreSQL backend (AWS-backed), using no formal Infrastructure-as-Code tooling. The application handles user authentication data, OAuth tokens, TOTP secrets, 2FA backup codes, and proxies requests to the Anthropic Claude API. The overall risk posture is **High**, driven by a combination of sensitive cryptographic material stored in plaintext in the database, a single production environment with no staging isolation, in-memory rate limiting that evaporates on restart or horizontal scale-out, and the absence of email verification enforcement that allows unverified accounts to access authenticated features. A total of **2 Critical, 9 High, 11 Medium, and 7 Low** findings were identified. The single highest-risk misconfiguration is **CLOUD-007**: TOTP secrets and 2FA backup codes are stored as plaintext text columns in the `twoFactor` table — an attacker who achieves read access to the database (via SQL injection, a compromised Supabase service role key, or a Supabase breach) can immediately extract all second-factor credentials and bypass 2FA for every enrolled user, completely defeating the security control.

---

## 2. Severity Legend

| Severity | Meaning |
|---|---|
| Critical | Public exposure of sensitive data, wildcard IAM, or exploitable RCE path |
| High | Significant privilege escalation risk or data exfiltration surface |
| Medium | Deviation from Well-Architected best practices with measurable risk |
| Low | Hygiene improvement or cost optimization opportunity |

---

## 3. IAM & Access Control

Railway and Supabase are managed PaaS platforms; there are no customer-managed IAM roles, VPC policies, or service account keys visible in the submitted configuration. The relevant access control surface is therefore: GitHub Actions permissions, Supabase service role key exposure, optional API tokens, and application-layer role enforcement.

---

- **[High] CLOUD-001** — GitHub Actions build job uses a real-looking dummy Anthropic API key pattern with no secret scanning gate

  - Resource: `.github/workflows/ci.yml`, `Build` job, `env.ANTHROPIC_API_KEY: dummy_key_for_build`
  - Description: The build step injects `dummy_key_for_build` as a plaintext environment variable. While this specific value is inert, the pattern establishes a precedent where real secrets could be accidentally committed in the same position. More critically, there is no `gitleaks`, `trufflehog`, or GitHub secret scanning enforcement step in the CI pipeline. If a developer accidentally commits a real `sk-ant-*` key or `DATABASE_URL` with credentials, the pipeline will pass without alerting. The `npm audit --audit-level=high` step covers dependency vulnerabilities but not secret leakage. Railway auto-deploys from `main` on push, meaning a leaked `DATABASE_URL` in a commit would be live within minutes.
  - Remediation: Add a secret scanning step before the build step. Using `trufflehog` OSS:
    ```yaml
    - name: Secret scan
      uses: trufflesecurity/trufflehog@main
      with:
        path: ./
        base: ${{ github.event.repository.default_branch }}
        head: HEAD
        extra_args: --only-verified
    ```
    Additionally, enable GitHub's native secret scanning and push protection in repository Settings → Security → Secret scanning → Push protection. Replace the dummy key with a clearly non-key-shaped placeholder (e.g., `not-a-real-key`).

---

- **[High] CLOUD-002** — Optional security secrets (`HEALTH_SECRET`, `REVALIDATION_SECRET`, `API_ACCESS_TOKEN`) may be unset in production, disabling their respective access controls

  - Resource: `.env.example` — `HEALTH_SECRET`, `REVALIDATION_SECRET`, `API_ACCESS_TOKEN` all marked optional
  - Description: The `.env.example` marks these three secrets as optional. If `HEALTH_SECRET` is unset, the `/api/health` endpoint is presumably unauthenticated, exposing internal health/diagnostic data. If `REVALIDATION_SECRET` is unset, the ISR revalidation endpoint can be triggered by any unauthenticated caller, enabling cache poisoning or denial-of-service against cached pages. If `API_ACCESS_TOKEN` is unset, the API access control layer it guards is bypassed entirely. The application code for these endpoints was not submitted, so the exact fallback behavior cannot be confirmed, but the pattern of optional secrets for security controls is architecturally unsound — a missing secret should fail closed, not open.
  - Remediation: In each endpoint handler, treat an unset or empty secret as a configuration error and return `503 Service Unavailable` at startup, or enforce the secret unconditionally:
    ```typescript
    const HEALTH_SECRET = process.env.HEALTH_SECRET;
    if (!HEALTH_SECRET) {
      throw new Error('HEALTH_SECRET must be set. Generate: openssl rand -hex 16');
    }
    ```
    Mirror the pattern already used for `BETTER_AUTH_SECRET` in `lib/auth.ts`. Mark all three as required in `.env.example` with a `# REQUIRED` annotation.

---

- **[Medium] CLOUD-003** — `admin()` plugin loaded unconditionally with no visible route-level RBAC enforcement beyond middleware prefix matching

  - Resource: `lib/auth.ts` — `plugins: [admin()]`; `middleware.ts` — `PROTECTED_PREFIXES = ['/dashboard', '/settings', '/admin']`
  - Description: The `better-auth` `admin()` plugin is enabled, which adds role-based capabilities (ban users, manage roles, etc.) keyed on `user.role`. The middleware protects `/admin` prefix routes from unauthenticated access, but it does not verify that the authenticated user has `role = 'admin'` — it only checks for the presence of a session cookie. Any authenticated user who navigates to `/admin/*` will pass the middleware gate. The actual role check depends entirely on whether individual `/admin` route handlers call `auth.api.getSession()` and verify the role. Since those handlers were not submitted, this cannot be confirmed, creating a potential horizontal privilege escalation path.
  - Remediation: Add an explicit role check in middleware for the `/admin` prefix, or create a dedicated admin middleware layer:
    ```typescript
    if (pathname.startsWith('/admin')) {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session || session.user.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    ```
    Alternatively, use `better-auth`'s `adminMiddleware` if available. Audit all `/admin` route handlers to confirm they independently verify role.

---

- **[Medium] CLOUD-004** — Dependabot configured to ignore all major version updates, potentially leaving critical security patches unapplied

  - Resource: `.github/dependabot.yml` — `ignore: update-types: ["version-update:semver-major"]`
  - Description: Major version bumps are globally suppressed. Several dependencies in this stack have historically shipped security fixes in major versions (e.g., Next.js, `better-auth`, `drizzle-orm`). If a critical CVE is fixed only in a new major version, Dependabot will not open a PR, and `npm audit` may not flag it if the advisory hasn't been backported. This creates a blind spot in the automated dependency security posture.
  - Remediation: Remove the blanket major-version ignore rule. Instead, configure Dependabot to open major-version PRs but apply a separate label (`major-update`) and require manual review:
    ```yaml
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
      major:
        update-types: ["major"]
    ```
    Subscribe to security advisories for `next`, `better-auth`, and `@anthropic-ai/sdk` via GitHub's watch feature.

---

- **[Low] CLOUD-005** — GitHub Actions workflow has no explicit `permissions` block, granting default broad token permissions

  - Resource: `.github/workflows/ci.yml` — no `permissions:` key
  - Description: Without an explicit `permissions` block, GitHub Actions grants the `GITHUB_TOKEN` its repository-default permissions (typically `read` on contents and `write` on several scopes depending on org settings). For a CI pipeline that only needs to check out code and run tests, this is broader than necessary. If a supply-chain attack compromises a third-party action (e.g., `actions/checkout`, `actions/setup-node`), the token could be used to write to the repository, create releases, or interact with the GitHub API.
  - Remediation: Add a minimal permissions block at the workflow level:
    ```yaml
    permissions:
      contents: read
    ```
    Pin all third-party actions to their full commit SHA rather than a mutable tag (e.g., `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` instead of `@v4`).

---

- **[Low] CLOUD-006** — `NEXT_PUBLIC_GITHUB_ENABLED` and `NEXT_PUBLIC_GOOGLE_ENABLED` flags are client-side booleans that could mislead security assumptions

  - Resource: `.env.example` — `NEXT_PUBLIC_GITHUB_ENABLED=false`, `NEXT_PUBLIC_GOOGLE_ENABLED=false`
  - Description: These `NEXT_PUBLIC_*` variables are embedded in the client bundle at build time. They control UI visibility of OAuth buttons, not server-side enablement. If `GITHUB_CLIENT_ID` is set but `NEXT_PUBLIC_GITHUB_ENABLED=false`, the OAuth endpoint is still active server-side — only the button is hidden. Conversely, if `NEXT_PUBLIC_GITHUB_ENABLED=true` but the credentials are missing, the server-side handler will fail with an unhandled error. This is a documentation/architecture clarity issue that could lead to misconfiguration.
  - Remediation: Document clearly in `.env.example` that `NEXT_PUBLIC_*_ENABLED` controls only UI visibility, not server-side availability. Add a startup assertion that if `NEXT_PUBLIC_GITHUB_ENABLED=true` then `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` must be non-empty.

---

## 4. Network Security

Railway is a PaaS platform; VPC configuration, security groups, NACLs, and transit gateways are fully managed by Railway and not customer-configurable. The relevant network security surface is: CORS policy, origin validation, CSP, HSTS, and the URL proxy allowlist.

---

- **[Medium] CLOUD-008** — CORS `ALLOWED_ORIGINS` set is computed at module load time from environment variables; a missing `NEXT_PUBLIC_APP_URL` silently produces a smaller-than-intended allowlist with no error

  - Resource: `lib/config/apiHeaders.ts` — `ALLOWED_ORIGINS` construction
  - Description: The `ALLOWED_ORIGINS` set filters out falsy values with `.filter(Boolean)`. If `NEXT_PUBLIC_APP_URL` is unset (e.g., misconfigured deployment), the production origin is silently excluded from the allowlist. Depending on how API routes consume this set, legitimate requests from the production frontend could be rejected, or — if the consuming code fails open on an empty/missing origin match — cross-origin requests could be accepted without validation. The actual enforcement logic in API route handlers was not submitted, so the fail-open vs. fail-closed behavior cannot be confirmed.
  - Remediation: Add a startup assertion:
    ```typescript
    if (!process.env.NEXT_PUBLIC_APP_URL && process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_APP_URL must be set in production');
    }
    ```
    In API route handlers that consume `ALLOWED_ORIGINS`, ensure the check fails closed (reject the request) when the origin is not in the set, rather than allowing it through.

---

- **[Medium] CLOUD-009** — No WAF, DDoS protection, or bot mitigation layer is visible in front of the Railway deployment

  - Resource: Railway deployment — no WAF configuration submitted
  - Description: Railway does not provide a built-in WAF or Layer 7 DDoS protection. The application is directly internet-exposed. The in-memory rate limiter (referenced in the architecture context but not shown in submitted files) is the only visible abuse-prevention control, and it is ineffective against distributed attacks and resets on every deployment or restart. The Anthropic API proxy endpoints are particularly attractive targets: an attacker who can bypass rate limiting can exhaust the `ANTHROPIC_API_KEY` quota, incurring significant cost and denying service to legitimate users.
  - Remediation: Place Cloudflare (free tier sufficient for initial protection) in front of the Railway deployment. Enable Cloudflare's managed ruleset and rate limiting rules. Configure Railway to only accept traffic from Cloudflare IP ranges (set `RAILWAY_ALLOWED_IPS` or use Railway's private networking if available). For the Anthropic proxy endpoints specifically, implement server-side rate limiting backed by a persistent store (see CLOUD-015).

---

- **[Medium] CLOUD-010** — `next.config.ts` sets HSTS without `preload` directive; middleware sets HSTS with `preload` — inconsistency creates a gap window

  - Resource: `next.config.ts` — `Strict-Transport-Security: max-age=63072000; includeSubDomains` (no `preload`); `middleware.ts` — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - Description: `next.config.ts` headers are applied to all routes. `middleware.ts` headers are applied to routes matching the middleware matcher (all routes except `_next/static`, `_next/image`, `favicon.ico`). For static asset routes excluded from middleware, the HSTS header comes from `next.config.ts` and lacks `preload`. This is a minor inconsistency — `preload` is a browser-list submission directive, not a per-request enforcement mechanism — but it indicates the two header layers are not synchronized, which could cause confusion during future security header audits. More practically, if a CDN caches static asset responses and serves them to first-time visitors, those visitors receive an HSTS header without `preload`.
  - Remediation: Align both locations. Since `preload` requires submission to the HSTS preload list (hstspreload.org) and is a one-way commitment, decide on the intended policy and apply it consistently. If preload is desired, add it to `next.config.ts` as well. Remove the HSTS header from `middleware.ts` and rely solely on `next.config.ts` to avoid duplication and drift:
    ```typescript
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
    ```

---

- **[Low] CLOUD-011** — URL allowlist proxy (`urlAllowlist.ts`) does not enforce a maximum URL length, leaving a minor DoS vector via oversized input strings

  - Resource: `lib/config/urlAllowlist.ts` — `isAllowedUrl(rawUrl: string)`
  - Description: The `isAllowedUrl` function calls `rawUrl.trim()` and then `new URL(...)` without first checking string length. An attacker submitting a multi-megabyte string would cause the URL parser to allocate and process a large string before rejecting it. While not a critical issue given the other validation layers, it is a low-cost hardening opportunity.
  - Remediation:
    ```typescript
    export function isAllowedUrl(rawUrl: string): boolean {
      if (typeof rawUrl !== 'string' || rawUrl.length > 2048) return false;
      // ... rest of validation
    }
    ```

---

- **[Low] CLOUD-012** — CSP `report-uri` directive is deprecated in favor of `report-to`; both are set but `report-uri` will be used by older browsers that don't support `report-to`

  - Resource: `middleware.ts` — CSP string includes both `report-uri /api/csp-report` and `report-to csp-endpoint`
  - Description: This is correct belt-and-suspenders behavior for broad browser compatibility. The finding is informational: the `/api/csp-report` endpoint must be hardened to accept only POST requests with `Content-Type: application/csp-report` or `application/reports+json`, validate body size (CSP reports can be large), and not log or reflect user-controlled data from the report body without sanitization. The endpoint implementation was not submitted for review.
  - Remediation: Ensure `/api/csp-report` enforces: `POST` only, body size limit (e.g., 64 KB), rate limiting per IP, and structured logging that does not reflect raw report fields into error messages. Consider using a third-party CSP reporting service (e.g., report-uri.com) to offload this attack surface.

---

## 5. Data Storage Security

Supabase manages the PostgreSQL instance on AWS. Customer-configurable data security controls are limited to: connection security (SSL), schema-level encryption, application-layer encryption, and Supabase Row Level Security (RLS) policies.

---

- **[Critical] CLOUD-007** — TOTP secrets and 2FA backup codes stored as plaintext `text` columns in the database

  - Resource: `lib/auth-schema.ts` — `twoFactor` table: `secret: text('secret').notNull()`, `backupCodes: text('backupCodes').notNull()`; `drizzle/0000_cute_wrecker.sql` — same columns
  - Description: The `twoFactor` table stores TOTP secrets and backup codes as unencrypted text. These are the most sensitive credentials in the system — they are the second factor that protects accounts even after a password compromise. If an attacker gains read access to the database (via a SQL injection vulnerability, a compromised Supabase service role key, a Supabase platform breach, a database backup leak, or a misconfigured Supabase RLS policy), they can extract every user's TOTP secret and immediately generate valid TOTP codes, or use backup codes directly to bypass 2FA. This completely defeats the purpose of the 2FA control. The `account` table also stores `accessToken`, `refreshToken`, and `idToken` as plaintext, which are OAuth tokens that could be used to impersonate users on GitHub/Google.
  - Remediation: Encrypt sensitive fields at the application layer before writing to the database, using a KMS-managed or envelope-encrypted key:
    ```typescript
    // Use Node.js crypto with AES-256-GCM
    import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

    const ENCRYPTION_KEY = Buffer.from(process.env.DB_ENCRYPTION_KEY!, 'base64'); // 32 bytes

    export function encryptField(plaintext: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return Buffer.concat([iv, tag, encrypted]).toString('base64');
    }

    export function decryptField(ciphertext: string): string {
      const buf = Buffer.from(ciphertext, 'base64');
      const iv = buf.subarray(0, 12);
      const tag = buf.subarray(12, 28);
      const encrypted = buf.subarray(28);
      const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted) + decipher.final('utf8');
    }
    ```
    Apply this to `twoFactor.secret`, `twoFactor.backupCodes`, `account.accessToken`, `account.refreshToken`, and `account.idToken`. Store `DB_ENCRYPTION_KEY` in Railway's secret environment variables. Add a migration to re-encrypt existing rows.

---

- **[High] CLOUD-013** — Supabase Row Level Security (RLS) policy configuration not visible; default Supabase behavior may expose tables via the PostgREST API

  - Resource: Supabase PostgreSQL — RLS configuration not submitted; `lib/auth-schema.ts` tables: `user`, `session`, `account`, `verification`, `twoFactor`, `audit`
  - Description: Supabase exposes all PostgreSQL tables via a PostgREST REST API by default. If RLS is not enabled on the `user`, `session`, `account`, `twoFactor`, and `audit` tables, any holder of the Supabase `anon` key (which is embedded in the client-side Supabase JS SDK and is effectively public) can query these tables directly, bypassing the application layer entirely. The application uses Drizzle ORM with a direct `DATABASE_URL` connection (not the Supabase JS client), so the application itself is not affected — but if the Supabase project's PostgREST API is enabled and RLS is off, the tables are publicly queryable. This is a common Supabase misconfiguration.
  - Remediation: In the Supabase dashboard, enable RLS on every table:
    ```sql
    ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "twoFactor" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "audit" ENABLE ROW LEVEL SECURITY;
    ```
    Since the application uses a direct connection with the service role (via `DATABASE_URL`), add a `BYPASSRLS` grant to the service role user so application queries are unaffected. Add `CREATE POLICY` statements that deny all access via the `anon` and `authenticated` roles for these tables (they should only be accessible via the service role). Add these statements to the Drizzle migration files so they are version-controlled.

---

- **[High] CLOUD-014** — OAuth tokens (`accessToken`, `refreshToken`, `idToken`) stored as plaintext in the `account` table

  - Resource: `lib/auth-schema.ts` — `account` table: `accessToken: text`, `refreshToken: text`, `idToken: text`; `drizzle/0000_cute_wrecker.sql` — same
  - Description: OAuth access and refresh tokens for GitHub and Google are stored as plaintext text columns. A refresh token for Google OAuth has a long lifetime (until revoked) and can be used to obtain new access tokens, effectively providing persistent access to the user's Google account. A GitHub OAuth token can be used to access the user's GitHub repositories, read private code, and perform actions on their behalf. These tokens are high-value targets in a database breach. This is a separate finding from CLOUD-007 because the remediation scope and token sensitivity differ.
  - Remediation: Apply the same application-layer encryption described in CLOUD-007 to `account.accessToken`, `account.refreshToken`, and `account.idToken`. Additionally, implement token refresh on use and store only the minimum required scopes. Consider whether storing refresh tokens is necessary for the application's functionality — if the app only needs to authenticate users (not act on their behalf), refresh tokens can be discarded after the initial OAuth flow.

---

- **[Medium] CLOUD-015** — No visible database backup verification or point-in-time recovery (PITR) configuration; reliance on Supabase default backup behavior

  - Resource: Supabase PostgreSQL — backup configuration not submitted
  - Description: Supabase provides automated daily backups on paid plans and PITR on Pro/Team plans. The free tier provides only daily backups with a 7-day retention window and no PITR. If the application is on the free tier, a data corruption event or accidental deletion could result in up to 24 hours of data loss. There is no evidence of backup restoration testing, which means the RTO/RPO assumptions are unverified. The `audit` table stores user-submitted code and audit results, which may be difficult to reconstruct.
  - Remediation: Confirm the Supabase plan tier. If on free tier, upgrade to Pro for PITR (5-minute RPO). Enable PITR in the Supabase dashboard. Schedule quarterly backup restoration drills to a separate Supabase project to verify RTO. Document the target RTO/RPO in a runbook. Consider supplementing with `pg_dump` exports to an S3 bucket via a scheduled GitHub Actions workflow for an additional backup copy.

---

- **[Low] CLOUD-016** — `audit.input` column stores raw user-submitted code/text with no size constraint at the database level

  - Resource: `lib/auth-schema.ts` — `audit` table: `input: text('input').notNull()`
  - Description: The `input` column is an unbounded `text` type. PostgreSQL `text` has no inherent size limit. If the application-layer validation (not submitted) does not enforce a maximum input size, a user could submit very large inputs that consume significant database storage and slow down queries that scan the `audit` table. The `result` column has the same issue.
  - Remediation: Add a database-level check constraint and an application-layer validation:
    ```typescript
    // In auth-schema.ts
    check('audit_input_length_check', sql`length(${t.input}) <= 500000`) // 500 KB
    ```
    Enforce the same limit in the API route handler before writing to the database.

---

## 6. Compute & Container Security

Railway is a fully managed PaaS; there is no customer access to container configuration, host networking, instance metadata service, or privileged flags. The relevant compute security surface is: the Node.js runtime configuration, the in-memory rate limiter, and the application's handling of the Anthropic API proxy.

---

- **[High] CLOUD-017** — In-memory rate limiting resets on every deployment and does not work across multiple Railway replicas

  - Resource: Architecture context — "in-memory rate limiting"; `package.json` — `@upstash/redis` is listed as a dependency, suggesting Redis-backed rate limiting may be partially implemented but not confirmed as the active path
  - Description: The architecture context explicitly calls out "in-memory rate limiting" as a known concern. If the active rate limiter stores counters in Node.js process memory, every Railway deployment (which triggers a process restart) resets all rate limit counters. Railway can run multiple replicas of the same service; each replica maintains independent counters, so a user can multiply their effective rate limit by the number of replicas. The Anthropic API proxy endpoints are the highest-risk target: an attacker who identifies the rate limit window can distribute requests across replicas to exhaust the API key quota. The presence of `@upstash/redis` in `package.json` suggests the intent to use Redis-backed rate limiting, but the actual implementation was not submitted.
  - Remediation: Confirm that all rate-limited endpoints use the Upstash Redis client, not in-process counters. A minimal Upstash rate limiter:
    ```typescript
    import { Redis } from '@upstash/redis';
    import { Ratelimit } from '@upstash/ratelimit';

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    export const rateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
    });
    ```
    Apply this to all AI proxy endpoints. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to the required environment variables list.

---

- **[Medium] CLOUD-018** — `requireEmailVerification: false` allows unverified email addresses to access authenticated features

  - Resource: `lib/auth.ts` — `emailAndPassword: { requireEmailVerification: false }` with comment `// AUTH-004: Enable when Resend is confirmed in prod`
  - Description: Email verification is disabled. Any user can register with an arbitrary email address (including one they do not own) and immediately access all authenticated features. This enables: (1) account enumeration via registration attempts, (2) impersonation — registering with someone else's email address to access features under their identity, (3) spam/abuse — creating accounts with disposable email addresses at scale. The comment indicates this is a known temporary state, but it has been left in the production configuration.
  - Remediation: Enable email verification immediately if `RESEND_API_KEY` is configured in production:
    ```typescript
    requireEmailVerification: !!process.env.RESEND_API_KEY,
    ```
    This conditionally enables verification when the email provider is available. Add a startup warning log if `RESEND_API_KEY` is unset in production. Separately, implement account enumeration protection by returning identical responses for "email not found" and "wrong password" cases.

---

- **[Medium] CLOUD-019** — No visible account lockout or brute-force protection on the email/password authentication endpoint

  - Resource: `lib/auth.ts` — `emailAndPassword` configuration; no `rateLimit` or `lockout` configuration visible
  - Description: The `better-auth` configuration does not show any account lockout policy (e.g., lock after N failed attempts) or per-account rate limiting on the login endpoint. The global rate limiter (CLOUD-017) may provide some protection, but if it is in-memory and per-replica, it is insufficient. An attacker can perform credential stuffing or password spraying against the login endpoint. The minimum password length of 8 characters means a significant portion of user passwords may be weak and susceptible to dictionary attacks.
  - Remediation: Configure `better-auth`'s built-in rate limiting for authentication endpoints if available, or implement a Redis-backed per-email rate limiter on the `/api/auth/sign-in` endpoint:
    ```typescript
    // In the auth route handler or middleware
    const key = `login:${email}`;
    const attempts = await redis.incr(key);
    if (attempts === 1) await redis.expire(key, 900); // 15-minute window
    if (attempts > 5) {
      return Response.json({ error: 'Too many attempts' }, { status: 429 });
    }
    ```
    Consider increasing `minPasswordLength` to 12 and adding a `zxcvbn`-based strength check on the client side.

---

- **[Medium] CLOUD-020** — Single production environment with no staging or development environment isolation

  - Resource: Architecture context — "Single environment (production). No separate dev/staging accounts."
  - Description: All development, testing, and production traffic shares the same Railway project and Supabase database. A developer running `npm run dev` locally connects to the production database via `DATABASE_URL`. Schema migrations (`drizzle-kit push` or `drizzle-kit migrate`) run directly against production. A failed migration, a `db:push` that drops a column, or a developer accidentally running a destructive query will affect production data immediately. The CI pipeline runs against the production database if `DATABASE_URL` is set in GitHub Actions secrets.
  - Remediation: Create a separate Supabase project for development/staging. Use Railway environments (Railway supports multiple environments per project) to maintain separate `DATABASE_URL` values per environment. Add a guard in `drizzle.config.ts` to prevent accidental production migrations:
    ```typescript
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_MIGRATION !== 'true') {
      throw new Error('Set ALLOW_PROD_MIGRATION=true to run migrations against production');
    }
    ```
    Update the CI pipeline to use a staging database URL from a separate GitHub Actions secret.

---

- **[Low] CLOUD-021** — Node.js engine pinned to `>=20.0.0 <21.0.0` (Node 20 LTS); Node 20 reaches end-of-life April 2026

  - Resource: `package.json` — `"engines": { "node": ">=20.0.0 <21.0.0" }`
  - Description: Node.js 20 LTS is currently in maintenance mode and reaches end-of-life in April 2026. Node.js 22 LTS is the current active LTS release. Staying on Node 20 means missing security patches after EOL. The `.nvmrc` file (referenced in CI but not submitted) likely pins to a specific Node 20 patch version.
  - Remediation: Plan migration to Node.js 22 LTS. Update `package.json` engines, `.nvmrc`, and Railway's Node version setting. Test for compatibility with `next@15`, `better-auth`, and `drizzle-orm` on Node 22 before deploying.

---

## 7. Secrets & Configuration Management

---

- **[Critical] CLOUD-022** — No secrets rotation policy or mechanism for any credential (`ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, `DATABASE_URL`, OAuth secrets)

  - Resource: `.env.example` — all secrets; Railway environment variables (managed via dashboard)
  - Description: There is no evidence of any secret rotation policy, rotation automation, or rotation schedule for any of the application's credentials. `BETTER_AUTH_SECRET` is used to sign session tokens — if it is compromised, all existing sessions can be forged. `ANTHROPIC_API_KEY` has no rotation mechanism visible. `DATABASE_URL` contains the Supabase database password, which is set once and never rotated. OAuth client secrets for GitHub and Google are static. If any of these secrets are leaked (e.g., via a Railway dashboard breach, a developer's compromised machine, or a git history exposure), there is no automated detection or rotation response. Railway does not provide a secrets manager with rotation capabilities — secrets are stored as plain environment variables.
  - Remediation: Implement a rotation schedule and runbook for each secret class:
    - `BETTER_AUTH_SECRET`: Rotate quarterly. Rotation requires invalidating all active sessions (acceptable security trade-off). Store in Railway as an environment variable; update requires a Railway redeploy.
    - `ANTHROPIC_API_KEY`: Rotate monthly or on any suspected exposure. Enable Anthropic console alerts for unusual usage spikes.
    - `DATABASE_URL` password: Rotate via Supabase dashboard quarterly. Update Railway environment variable and trigger redeploy.
    - OAuth secrets: Rotate annually or on suspected exposure via GitHub/Google developer consoles.
    - Consider migrating to a secrets manager (HashiCorp Vault Cloud, AWS Secrets Manager via a sidecar, or Doppler) that supports automated rotation and audit logging of secret access.

---

- **[High] CLOUD-023** — `BETTER_AUTH_SECRET` minimum length check (32 chars) is enforced at runtime startup but not in CI, allowing a weak secret to reach production undetected until first request

  - Resource: `lib/auth.ts` — `if (!authSecret || authSecret.length < 32) { throw new Error(...) }`
  - Description: The length check in `lib/auth.ts` is correct and will prevent the application from starting with a weak secret. However, the CI build step sets `ANTHROPIC_API_KEY: dummy_key_for_build` but does not set `BETTER_AUTH_SECRET`, meaning the build step either skips the auth module initialization or the check is not triggered during `next build`. If the check is not triggered at build time, a deployment with a missing or weak `BETTER_AUTH_SECRET` will only fail at the first request that initializes the auth module, not at deploy time. This creates a window where the application appears deployed but is non-functional or insecure.
  - Remediation: Add a startup health check that exercises the auth module initialization path. In Railway, configure a health check endpoint (`/api/health`) that is called immediately after deployment; if it fails (because `BETTER_AUTH_SECRET` is missing), Railway will roll back the deployment. Alternatively, add a CI step that validates required environment variables are set to non-trivial values before the build:
    ```yaml
    - name: Validate required env vars
      run: |
        [ -n "$BETTER_AUTH_SECRET" ] && [ ${#BETTER_AUTH_SECRET} -ge 32 ] || \
          (echo "BETTER_AUTH_SECRET missing or too short" && exit 1)
      env:
        BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
    ```

---

- **[Medium] CLOUD-024** — `DATABASE_URL` passed directly to `drizzle-kit` in `drizzle.config.ts` with `!` non-null assertion; no validation before use

  - Resource: `drizzle.config.ts` — `url: process.env.DATABASE_URL!`
  - Description: The non-null assertion `!` suppresses TypeScript's undefined check. If `DATABASE_URL` is unset when `drizzle-kit` commands are run, the postgres client will receive `undefined` cast to string (`"undefined"`), which will produce a confusing connection error rather than a clear configuration error. More importantly, `drizzle.config.ts` is used for migration commands that run against the live database — a misconfigured `DATABASE_URL` pointing to the wrong environment could cause migrations to run against an unintended database.
  - Remediation:
    ```typescript
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is required for drizzle-kit');

    export default defineConfig({
      out: './drizzle',
      schema: './lib/auth-schema.ts',
      dialect: 'postgresql',
      dbCredentials: { url: databaseUrl },
    });
    ```

---

- **[Low] CLOUD-025** — `RESEND_API_KEY` absence silently disables email sending in production without any alerting

  - Resource: `lib/auth.ts` — `const resend = process.env.RESEND_API_KEY ? new Resend(...) : null`; `sendEmail` function returns silently if `resend` is null and `NODE_ENV !== 'development'`
  - Description: If `RESEND_API_KEY` is unset in production, password reset emails, email verification emails, and 2FA OTP emails are silently dropped. The `sendEmail` function only logs to console in development mode. In production with a missing key, the function returns `undefined` without any error, log entry, or metric. A user who requests a password reset will receive no email and no error message, creating a confusing UX and a potential support burden. More critically, if 2FA OTP delivery fails silently, users with email-based 2FA will be locked out of their accounts.
  - Remediation: Add a production warning at startup and a non-silent failure path:
    ```typescript
    if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === 'production') {
      console.error('[email] RESEND_API_KEY is not set — all transactional emails will be dropped');
    }
    ```
    In the `sendEmail` function, log a warning (not just in dev) when `resend` is null:
    ```typescript
    if (!resend) {
      console.warn(`[email] Dropped email to ${to}: RESEND_API_KEY not configured`);
      return;
    }
    ```
    Consider making `RESEND_API_KEY` required in production via a startup assertion.

---

## 8. Resilience & Disaster Recovery

---

- **[High] CLOUD-026** — Single Railway deployment with no multi-region failover; Railway region failure causes complete service outage

  - Resource: Railway deployment — single environment, single region
  - Description: Railway deploys to a single GCP region (typically `us-west1` or `us-east4` depending on project configuration). There is no multi-region deployment, no failover routing, and no health-check-based traffic shifting. A Railway region outage, a GCP zone failure, or a Railway platform incident causes complete application unavailability. The Supabase PostgreSQL instance is similarly single-region (AWS region determined by Supabase project configuration). There is no read replica, no standby, and no cross-region replication visible. For a production application handling user data and paid API calls, this represents an unacceptable single point of failure.
  - Remediation: Short-term: Configure Railway's health check and automatic restart policy to minimize recovery time from process crashes. Enable Railway's "Always On" setting to prevent cold starts. Medium-term: Evaluate Railway's multi-region deployment feature (if available on the current plan) or consider migrating to a platform with native multi-region support (Fly.io, Vercel, Cloudflare Workers). For Supabase, enable PITR and document the manual failover procedure. Long-term: Define explicit RTO (target: <5 minutes) and RPO (target: <1 hour) SLAs and architect to meet them.

---

- **[High] CLOUD-027** — No visible stale session cleanup job; expired sessions accumulate in the `session` table indefinitely

  - Resource: `lib/auth-schema.ts` — `session` table with `expiresAt` column and `idx_session_expiresAt` index; no cleanup job visible in CI or application code
  - Description: Sessions expire after 7 days (`expiresIn: 60 * 60 * 24 * 7`), but expired session rows are not deleted from the database. Over time, the `session` table will accumulate millions of expired rows. This has several consequences: (1) table bloat increases storage costs and slows down queries that scan the table, (2) the `idx_session_expiresAt` index grows proportionally, (3) if `better-auth` performs a full-table scan for session validation (rather than a point lookup by token), performance degrades. The `idx_audit_status_updated` index comment mentions "stale audit cleanup query," suggesting cleanup was considered for audits but not sessions.
  - Remediation: Add a scheduled cleanup job. Using a GitHub Actions scheduled workflow:
    ```yaml
    # .github/workflows/cleanup.yml
    on:
      schedule:
        - cron: '0 3 * * *'  # Daily at 3 AM UTC
    jobs:
      cleanup:
        runs-on: ubuntu-latest
        steps:
          - run: |
              psql "$DATABASE_URL" -c \
                "DELETE FROM session WHERE \"expiresAt\" < NOW() - INTERVAL '1 day';"
            env:
              DATABASE_URL: ${{ secrets.DATABASE_URL }}
    ```
    Alternatively, implement a Supabase Edge Function or a pg_cron job (available on Supabase Pro):
    ```sql
    SELECT cron.schedule('cleanup-sessions', '0 3 * * *',
      $$DELETE FROM session WHERE "expiresAt" < NOW() - INTERVAL '1 day'$$);
    ```

---

- **[Medium] CLOUD-028** — No application-level circuit breaker or timeout for Anthropic API calls; a slow/unresponsive Anthropic API will exhaust Railway's request concurrency

  - Resource: `package.json` — `@anthropic-ai/sdk: 0.78.0`; architecture context — "proxies AI requests"
  - Description: The Anthropic SDK's default timeout behavior was not visible in the submitted files. If the Anthropic API becomes slow or unresponsive, streaming requests will hold open Railway connections for the duration of the SDK's timeout (potentially minutes). Railway has a concurrency limit per deployment; if all connections are held by slow Anthropic requests, new user requests will queue or be rejected. There is no visible circuit breaker, fallback response, or timeout configuration in the submitted code.
  - Remediation: Configure explicit timeouts on the Anthropic client:
    ```typescript
    import Anthropic from '@anthropic-ai/sdk';
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30 * 1000, // 30 seconds
      maxRetries: 1,
    });
    ```
    Implement a circuit breaker pattern (e.g., using `opossum`) that opens after N consecutive Anthropic failures and returns a graceful error response. Set Railway's request timeout to slightly above the Anthropic timeout to ensure clean connection teardown.

---

- **[Medium] CLOUD-029** — `better-auth` session `cookieCache` set to 5 minutes; a revoked/banned session remains valid for up to 5 minutes after revocation

  - Resource: `lib/auth.ts` — `cookieCache: { enabled: true, maxAge: 5 * 60 }`
  - Description: The cookie cache avoids a database round-trip on every request by caching session validity in the cookie itself for 5 minutes. This is a deliberate performance trade-off documented in `better-auth`. The consequence is that if an admin bans a user or revokes a session, the user's requests will continue to succeed for up to 5 minutes until the cache expires. For a security incident response scenario (e.g., a compromised account), this 5-minute window is a meaningful delay. The `admin()` plugin's ban functionality is similarly delayed.
  - Remediation: This is an accepted trade-off in `better-auth`'s design. Document the 5-minute revocation lag in the security runbook. For high-severity revocations (admin bans, suspected compromise), implement a Redis-based session blocklist that is checked before the cookie cache:
    ```typescript
    // In middleware, before the session cookie check
    const sessionId = getSessionCookie(request)?.value;
    if (sessionId && await redis.sismember('revoked_sessions', sessionId)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    ```
    Reduce `maxAge` to 60 seconds if the performance impact is acceptable.

---

- **[Low] CLOUD-030** — No `audit` table row cleanup policy; completed/failed audits accumulate indefinitely

  - Resource: `lib/auth-schema.ts` — `audit` table; `idx_audit_status_updated` index comment references "stale audit cleanup query" but no cleanup implementation is visible
  - Description: The `idx_audit_status_updated` index was created specifically for a stale audit cleanup query, but no cleanup job implementation was submitted. Audit rows (which include the full `input` text and `result` text) will accumulate indefinitely, growing storage costs and degrading query performance on the `audit` table over time.
  - Remediation: Implement a cleanup policy. For example, delete `failed` audits older than 7 days and `completed` audits older than 90 days (or implement soft-delete with archival to cold storage):
    ```sql
    DELETE FROM audit
    WHERE status = 'failed' AND "updatedAt" < NOW() - INTERVAL '7 days';

    DELETE FROM audit
    WHERE status = 'completed' AND "updatedAt" < NOW() - INTERVAL '90 days';
    ```
    Schedule via the same mechanism as CLOUD-027. Consider adding a user-facing "delete my audit history" feature for GDPR compliance.

---

## 9. Cost Optimization

Railway and Supabase are consumption-based PaaS platforms. Cost optimization focuses on: API call efficiency, database connection pooling, storage growth, and Railway compute utilization.

---

- **[Medium] CLOUD-031** — Direct PostgreSQL connection (`postgres` client) without PgBouncer pooling on Railway; connection exhaustion risk under load

  - Resource: `lib/db.ts` — `max: isPooler ? 5 : 10` connections; Supabase connection limits vary by plan (free: 60, pro: 120)
  - Description: The application detects Supabase's connection pooler by hostname and adjusts `max` connections accordingly. However, Railway can run multiple replicas, each with up to 10 connections. With 3 replicas, that's 30 connections consumed by the application alone, leaving limited headroom for Supabase's own internal connections and other tools (Drizzle Studio, monitoring). On the free plan (60 connection limit), this is tight. More importantly, Next.js serverless-style deployments can spawn multiple Node.js processes per replica, each initializing the connection pool independently, potentially multiplying connection consumption.
  - Remediation: Use Supabase's built-in connection pooler (Supabase Pooler, which uses PgBouncer) by using the pooler connection string (`pooler.supabase.com`) as `DATABASE_URL`. The code already handles this case (`isPooler` detection). Ensure the Railway deployment uses the pooler URL. Set `max: 3` for pooler connections (PgBouncer handles the actual pool). This reduces per-replica connection consumption from 10 to 3.

---

- **[Low] CLOUD-032** — `@upstash/redis` dependency present but Upstash credentials not listed in `.env.example`; if unused, it is dead weight; if used, it is undocumented

  - Resource: `package.json` — `@upstash/redis: ^1.37.0`; `.env.example` — no `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN`
  - Description: The Upstash Redis client is listed as a production dependency but its required environment variables (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are absent from `.env.example`. Either: (a) the Redis client is imported but not actively used (dead dependency, adding ~50 KB to the bundle), or (b) it is used but the credentials are undocumented, meaning a new deployment will silently fail to connect to Redis (falling back to in-memory rate limiting per CLOUD-017).
  - Remediation: If Redis is actively used, add to `.env.example`:
    ```
    UPSTASH_REDIS_REST_URL=https://...  # Upstash Redis REST URL
    UPSTASH_REDIS_REST_TOKEN=...        # Upstash Redis REST token
    ```
    If Redis is not yet actively used, remove `@upstash/redis` from `package.json` until it is needed to keep the dependency surface minimal.

---

- **[Low] CLOUD-033** — `lenis` (smooth scroll library, ~15 KB gzipped) and `qrcode.react` (~30 KB gzipped) are production dependencies; verify they are tree-shaken and not loaded on all routes

  - Resource: `package.json` — `lenis: ^1.3.18`, `qrcode.react: ^4.2.0`
  - Description: `lenis` is a smooth scrolling library that attaches to the global scroll event. If imported at the root layout level, it adds JavaScript execution cost to every page. `qrcode.react` is used for 2FA QR code display — it should only be loaded on the 2FA setup page. If either library is imported in a shared layout or `_app` equivalent, it increases the initial bundle size for all routes unnecessarily.
  - Remediation: Use Next.js dynamic imports with `ssr: false` for both libraries:
    ```typescript
    const QRCodeSVG = dynamic(() => import('qrcode.react').then(m => m.QRCodeSVG), { ssr: false });
    ```
    Use Next.js bundle analyzer (`@next/bundle-analyzer`) to verify these libraries are not included in the main bundle.

---

- **[Low] CLOUD-034** — `npm audit --audit-level=high` in CI does not fail on moderate vulnerabilities; moderate CVEs in transitive dependencies may go unaddressed

  - Resource: `.github/workflows/ci.yml` — `npm audit --audit-level=high`
  - Description: The `--audit-level=high` flag means the CI step only fails on high and critical severity vulnerabilities. Moderate severity vulnerabilities (which can include SSRF, information disclosure, and ReDoS issues) are reported but do not block the build. Given that this application handles authentication data and proxies AI requests, moderate vulnerabilities in dependencies like `react-markdown` (which renders user-controlled content) or `better-auth` deserve attention.
  - Remediation: Consider lowering the audit level to `moderate` for this application's risk profile:
    ```yaml
    - name: Security audit
      run: npm audit --audit-level=moderate
    ```
    Alternatively, use `npm audit --audit-level=high` for blocking but add a separate non-blocking step that reports moderate findings to a Slack channel or GitHub issue for triage.

---

## 10. Prioritized Remediation Roadmap

| # | Finding | One-Line Fix | Effort | Timing |
|---|---|---|---|---|
| 1 | **CLOUD-007** — TOTP secrets & backup codes in plaintext | Implement AES-256-GCM application-layer encryption for `twoFactor.secret`, `twoFactor.backupCodes`, and OAuth tokens before DB write | 1–2 days (encryption + migration) | **Immediate** |
| 2 | **CLOUD-022** — No secrets rotation policy | Document and schedule rotation for all credentials; migrate to Doppler or similar for audit trail | 4 hours (runbook) + ongoing | **Immediate** (runbook); Scheduled (tooling) |
| 3 | **CLOUD-013** — Supabase RLS not confirmed enabled | Enable RLS on all tables in Supabase dashboard; add `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` to migration files | 2 hours | **Immediate** |
| 4 | **CLOUD-014** — OAuth tokens stored plaintext | Apply same encryption as CLOUD-007 to `account.accessToken`, `account.refreshToken`, `account.idToken` | Included in CLOUD-007 effort | **Immediate** |
| 5 | **CLOUD-017** — In-memory rate limiting ineffective across replicas | Confirm all rate-limited endpoints use Upstash Redis; add `UPSTASH_REDIS_REST_URL/TOKEN` to env and `.env.example` | 4 hours | **Immediate** |
| 6 | **CLOUD-026** — Single-region deployment, no failover | Enable Railway health checks and "Always On"; document manual failover runbook for Supabase | 2 hours | **Immediate** (health checks); Scheduled (multi-region) |
| 7 | **CLOUD-027** — Expired sessions never purged | Add pg_cron or GitHub Actions scheduled job to delete expired sessions daily | 2 hours | **Scheduled** |
| 8 | **CLOUD-002** — Optional security secrets may be unset | Add startup assertions for `HEALTH_SECRET`, `REVALIDATION_SECRET`, `API_ACCESS_TOKEN` | 1 hour | **Immediate** |
| 9 | **CLOUD-001** — No secret scanning in CI | Add `trufflehog` action and enable GitHub push protection | 1 hour | **Immediate** |
| 10 | **CLOUD-023** — Auth secret weakness not caught at build time | Add Railway