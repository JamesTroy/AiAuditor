I'll systematically enumerate every resource and trust boundary before writing the report.

**Resources identified:**
- Railway PaaS (Next.js 15, Node.js) — single environment, auto-deploy from GitHub main
- Supabase PostgreSQL (managed, AWS-backed)
- Anthropic Claude API (external, key-authenticated)
- Resend email API (external, key-authenticated)
- GitHub Actions CI/CD
- better-auth session/auth system
- Drizzle ORM + postgres.js connection pool
- In-memory rate limiting (referenced in context, not shown in files)
- Upstash Redis (@upstash/redis in package.json)

**Blast radius assessment:**
- ANTHROPIC_API_KEY: full API spend exposure if leaked; no budget cap visible
- DATABASE_URL: full DB read/write if leaked; contains credentials
- BETTER_AUTH_SECRET: session forgery for all users if leaked
- OAuth secrets: account takeover vector
- Single environment: any exploit hits production directly
- No IaC: no drift detection, no audit trail for config changes
- In-memory rate limiting: bypassed on restart/scale-out
- Direct DB connection from app: no connection proxy/PgBouncer beyond Supabase pooler
- account table stores OAuth access/refresh tokens in plaintext
- twoFactor table stores TOTP secret + backup codes in plaintext
- Email verification disabled (requireEmailVerification: false)
- No CORS enforcement visible in API route handlers (only origin list defined)
- No API route files shown — rate limiting implementation unknown
- Dependabot ignores major versions
- No staging environment — PRs deploy to production context
- HSTS set in both next.config.ts (no preload) and middleware.ts (with preload) — duplicate/inconsistent
- SRI enabled for sha256 — good
- CSP report-uri endpoint exists but no handler shown
- Health/revalidation/API_ACCESS_TOKEN secrets are optional with no enforcement shown

---

## 1. Executive Summary

This assessment covers a Next.js 15 application deployed on Railway (PaaS on GCP) with a Supabase-managed PostgreSQL backend (AWS), using the Anthropic Claude API for AI proxying and Resend for transactional email. No IaC tooling is in use; infrastructure is managed entirely through platform dashboards and GitHub-triggered auto-deployment. The overall risk posture is **High**, driven by 0 Critical, 7 High, 11 Medium, and 8 Low findings (26 total). The single highest-risk misconfiguration is the storage of TOTP secrets and OAuth access/refresh tokens in plaintext database columns with no application-layer encryption — a database read (via SQL injection, a compromised migration, a Supabase dashboard credential, or a database backup leak) directly yields account-takeover material for every user who has enabled 2FA or linked a social provider.

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

*Railway and Supabase are managed PaaS platforms; traditional IAM roles/policies are not user-configurable. This section evaluates the application-layer access control equivalents: API key scoping, secret management, admin privilege boundaries, and service-to-service authentication.*

---

- **[High] CLOUD-001** — TOTP secrets and OAuth tokens stored in plaintext database columns
  - Resource: PostgreSQL tables `twoFactor` (columns `secret`, `backupCodes`) and `account` (columns `accessToken`, `refreshToken`, `idToken`)
  - Description: The `twoFactor.secret` column holds the raw TOTP seed; `twoFactor.backupCodes` holds plaintext recovery codes; `account.accessToken` and `refreshToken` hold live OAuth bearer tokens. Any party with read access to the database — a compromised Supabase dashboard credential, a SQL injection vulnerability, a leaked backup, or a rogue migration — can immediately derive valid TOTP codes, exhaust backup codes, and replay OAuth tokens to impersonate users on GitHub/Google. This is a direct account-takeover path that bypasses the application authentication layer entirely.
  - Remediation: Encrypt these columns at the application layer before writing to the database. Use a KMS-backed symmetric key (e.g., AWS KMS via Supabase's AWS substrate, or a Vault transit engine) or at minimum AES-256-GCM with a key stored in Railway's secret store (not in `DATABASE_URL`). For backup codes specifically, store bcrypt/argon2 hashes rather than plaintext or reversible ciphertext, since they are one-time-use verifiers. Better-auth does not currently perform this encryption automatically — it must be implemented in a custom adapter wrapper or a Drizzle `$type` transformer.

---

- **[High] CLOUD-002** — Email verification disabled in production
  - Resource: `lib/auth.ts` → `emailAndPassword.requireEmailVerification: false`
  - Description: The comment `// AUTH-004: Enable when Resend is confirmed in prod` indicates this is a known deferral, but in the current production deployment any actor can register an account with an arbitrary email address they do not control. This enables: (1) account squatting on victim email addresses before the legitimate owner registers, followed by a password-reset attack once the victim tries to register; (2) spam/abuse of the platform under someone else's identity; (3) bypassing email-based 2FA OTP delivery assumptions. Because the platform proxies Anthropic API calls, unverified accounts can consume API quota.
  - Remediation: Set `requireEmailVerification: true` immediately once `RESEND_API_KEY` is confirmed in the Railway environment. Add a CI/CD check (similar to the existing `unsafe-eval` assertion) that fails the build if `requireEmailVerification` is `false` and `NODE_ENV` is not `development`. As an interim measure, add rate limiting on the `/api/auth/sign-up` endpoint specifically.

---

- **[High] CLOUD-003** — `API_ACCESS_TOKEN`, `HEALTH_SECRET`, and `REVALIDATION_SECRET` are optional with no enforcement visible
  - Resource: `.env.example` — `API_ACCESS_TOKEN`, `HEALTH_SECRET`, `REVALIDATION_SECRET` all blank/optional
  - Description: The `.env.example` marks these as optional. If the corresponding API route handlers do not enforce their presence (i.e., they fall through to unauthenticated access when the variable is unset), then `/api/health`, ISR revalidation endpoints, and any bearer-token-gated API routes are publicly accessible in production if the operator simply never sets these values. The health endpoint in particular may expose internal state (DB connectivity, version strings, dependency status) useful for reconnaissance. No route handler code was provided to confirm enforcement, which itself is a finding — the security contract is implicit.
  - Remediation: In each handler, add a startup assertion (similar to the `BETTER_AUTH_SECRET` length check in `lib/auth.ts`) that throws if the secret is absent in non-development environments. Example pattern: `if (!process.env.HEALTH_SECRET && process.env.NODE_ENV === 'production') throw new Error('HEALTH_SECRET must be set in production')`. Add these checks to a `lib/config/assertEnv.ts` module imported at app startup. Document the security contract explicitly in the `.env.example` comments.

---

- **[Medium] CLOUD-004** — Admin plugin enabled with no visible role-enforcement middleware on admin routes
  - Resource: `lib/auth.ts` → `plugins: [admin()]`; `middleware.ts` → `PROTECTED_PREFIXES = ['/dashboard', '/settings', '/admin']`
  - Description: The `admin()` plugin is registered, and `/admin` is listed as a protected prefix (requiring any valid session). However, the middleware only checks for the presence of a session cookie — it does not verify that the session belongs to a user with `role = 'admin'`. Role enforcement must happen inside each `/admin/**` route handler or in a dedicated middleware branch. If any `/admin` route handler omits the role check, any authenticated user can access admin functionality. The `role` column defaults to `'user'` and is a free-text field with no database-level constraint (no `CHECK` constraint limiting values to `'user' | 'admin'`).
  - Remediation: Add a middleware branch that checks `role === 'admin'` for all `/admin` prefixed routes using better-auth's session API. Add a database `CHECK` constraint: `CHECK (role IN ('user', 'admin'))`. Audit every `/admin/**` route handler to confirm server-side role verification is present independently of middleware (defense in depth).

---

- **[Medium] CLOUD-005** — Dependabot configured to ignore all major version updates
  - Resource: `.github/dependabot.yml` → `ignore: update-types: ["version-update:semver-major"]`
  - Description: Major version updates are silently suppressed. Security patches are sometimes released only as major versions (e.g., a breaking-change fix in `next`, `better-auth`, or `@anthropic-ai/sdk`). This creates a systematic blind spot where CVEs fixed in major releases will never surface as Dependabot PRs, and `npm audit --audit-level=high` in CI may not catch them if the advisory references the new major version as the fix target.
  - Remediation: Remove the major-version ignore rule, or replace it with a separate Dependabot group for major updates with a human-review label and a longer schedule (e.g., monthly). At minimum, subscribe to security advisories for `next`, `better-auth`, `drizzle-orm`, and `postgres` directly via GitHub's advisory watch feature.

---

- **[Medium] CLOUD-006** — OAuth client secrets loaded via non-null assertion without runtime validation
  - Resource: `lib/auth.ts` → `clientSecret: process.env.GITHUB_CLIENT_SECRET!` and `process.env.GOOGLE_CLIENT_SECRET!`
  - Description: The outer `if (process.env.GITHUB_CLIENT_ID)` guard checks only the client ID. If `GITHUB_CLIENT_ID` is set but `GITHUB_CLIENT_SECRET` is accidentally left blank, the TypeScript non-null assertion (`!`) suppresses the compile-time warning and the runtime value is `undefined`, which better-auth will pass to the OAuth provider as a literal `undefined`-coerced string or empty value. Depending on the OAuth library's behavior, this could result in silent auth failures or, in edge cases, accepting any secret.
  - Remediation: Add paired validation: `if (process.env.GITHUB_CLIENT_ID && !process.env.GITHUB_CLIENT_SECRET) throw new Error('GITHUB_CLIENT_SECRET must be set when GITHUB_CLIENT_ID is configured')`. Apply the same pattern for Google. This mirrors the existing `BETTER_AUTH_SECRET` length check.

---

- **[Low] CLOUD-007** — No Supabase Row-Level Security (RLS) policy verification in CI
  - Resource: Supabase PostgreSQL — RLS policy configuration (dashboard-managed, not in repo)
  - Description: Supabase enables RLS on tables by default but policies must be explicitly authored. Since there is no IaC for the database, there is no CI assertion that RLS is enabled and correctly scoped on the `audit`, `session`, `account`, `twoFactor`, and `user` tables. A misconfigured or missing RLS policy could allow the Supabase anon/service-role key (if ever used client-side) to read all rows across all users.
  - Remediation: Add RLS policies for all tables via a migration file tracked in the repository (e.g., `drizzle/0001_rls_policies.sql`). Add a CI step that connects to the database and asserts `SELECT relrowsecurity FROM pg_class WHERE relname = 'audit'` returns `true` for each sensitive table. Since the app uses the `DATABASE_URL` (service-role equivalent) exclusively from the server, RLS is not the primary defense here, but it provides defense-in-depth against Supabase dashboard misuse.

---

- **[Low] CLOUD-008** — No explicit Anthropic API key scope or spend limit visible
  - Resource: Anthropic Console — `ANTHROPIC_API_KEY` configuration
  - Description: The Anthropic API key is a single credential with no visible workspace-level spend cap or key-level usage restriction in the submitted configuration. If the key is leaked (e.g., via a log line, an error response, or a compromised Railway environment), an attacker can run unbounded inference requests until the key is manually revoked, potentially incurring significant cost.
  - Remediation: Set a monthly spend limit in the Anthropic Console. Create a dedicated API key scoped to this project (not a shared workspace key). Implement server-side per-user token budget tracking (the Upstash Redis dependency already present is suitable for this). Rotate the key on a scheduled basis (quarterly minimum).

---

## 4. Network Security

*Railway manages all network infrastructure (GCP load balancers, TLS termination, internal routing). No VPC, security group, or NACL configuration is user-accessible. This section evaluates the application-layer network security controls that are within scope.*

---

- **[High] CLOUD-009** — CORS origin allowlist defined but no evidence of enforcement in API route handlers
  - Resource: `lib/config/apiHeaders.ts` → `ALLOWED_ORIGINS` set; API route handlers (not provided)
  - Description: `ALLOWED_ORIGINS` is correctly constructed (production URL + Railway domain + localhost in dev only). However, defining an allowlist in a config module has no security effect unless every API route handler that accepts cross-origin requests explicitly reads this set and returns the appropriate `Access-Control-Allow-Origin` header — and, critically, rejects requests from unlisted origins. Next.js App Router does not apply CORS headers automatically. If route handlers simply export `STREAM_RESPONSE_HEADERS` (which contains no CORS headers), the browser's same-origin policy is the only enforcement, which does not protect server-side resources from direct (non-browser) callers. The audit/AI proxy endpoints are the highest-risk targets.
  - Remediation: Create a `lib/config/cors.ts` utility that validates `request.headers.get('origin')` against `ALLOWED_ORIGINS` and returns a `403` for unlisted origins on state-mutating endpoints. Apply this check as the first statement in every POST/streaming API handler. For the streaming audit endpoint specifically, also validate the `Authorization` or session cookie before processing any Claude API call.

---

- **[Medium] CLOUD-010** — HSTS header set inconsistently between `next.config.ts` and `middleware.ts`
  - Resource: `next.config.ts` → `Strict-Transport-Security: max-age=63072000; includeSubDomains` (no `preload`); `middleware.ts` → `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - Description: Two different HSTS values are set on the same responses. `next.config.ts` headers are applied first by the Next.js server; `middleware.ts` then overwrites the header (in non-dev environments) with the `preload` variant. The effective header depends on which layer wins — in Next.js 15, middleware headers generally take precedence for matched routes, but static asset routes that bypass middleware (per the matcher exclusion) will receive only the `next.config.ts` value without `preload`. This inconsistency creates confusion about the intended policy and could cause `preload` submission to fail validation (hstspreload.org requires the `preload` directive to be present on all responses, including static assets).
  - Remediation: Remove the HSTS entry from `next.config.ts` entirely and rely solely on the middleware-set value (which correctly gates on `!isDev` and includes `preload`). Alternatively, if static assets must also carry HSTS, add `preload` to the `next.config.ts` value and remove the middleware duplication. Choose one authoritative location.

---

- **[Medium] CLOUD-011** — In-memory rate limiting does not survive process restarts or horizontal scale-out
  - Resource: Application runtime — rate limiting implementation (referenced in context; Upstash Redis present in `package.json` but implementation not shown)
  - Description: The architecture description explicitly notes "in-memory rate limiting" as a known concern. Railway can restart containers on deploy or crash, resetting all in-memory counters. If Railway scales to multiple instances (even temporarily), each instance maintains independent counters, allowing an attacker to multiply their effective rate limit by the number of instances. The AI proxy endpoint is the highest-value target: an attacker who bypasses rate limiting can exhaust the Anthropic API key budget.
  - Remediation: Migrate rate limiting to Upstash Redis (already a declared dependency — `@upstash/redis: ^1.37.0`). Use a sliding window counter keyed on `userId` (authenticated) or `ip + fingerprint` (unauthenticated). Apply limits at two levels: per-user per-minute (burst) and per-user per-day (budget). The Upstash `@upstash/ratelimit` package provides a ready-made sliding window implementation compatible with Edge/Node runtimes.

---

- **[Medium] CLOUD-012** — CSP `report-uri` endpoint (`/api/csp-report`) has no visible handler or rate limiting
  - Resource: `middleware.ts` → `report-uri /api/csp-report`; no corresponding route file provided
  - Description: The CSP `report-uri` directive instructs browsers to POST violation reports to `/api/csp-report`. If this endpoint does not exist, browsers receive 404s silently (no security impact, but the monitoring value is lost). If it does exist but lacks rate limiting, it is a potential DoS vector: an attacker can flood the endpoint with synthetic CSP reports, consuming Railway compute and potentially filling logs. The `report-to` header references the same endpoint via the Reporting API.
  - Remediation: Implement `/api/csp-report` as a POST handler that: (1) validates `Content-Type: application/csp-report` or `application/reports+json`; (2) applies strict rate limiting (e.g., 10 req/min per IP via Upstash); (3) logs the report body to a structured logging sink (not to stdout in production); (4) returns `204 No Content`. If CSP reporting is not actively monitored, consider removing `report-uri` from the CSP until a monitoring pipeline is in place.

---

- **[Low] CLOUD-013** — No explicit `X-Forwarded-For` / real-IP trust configuration visible
  - Resource: Application runtime — IP-based rate limiting and session `ipAddress` logging
  - Description: Railway sits behind a GCP load balancer that injects `X-Forwarded-For`. If the application reads `request.headers.get('x-forwarded-for')` for rate limiting or audit logging without validating that the request came through Railway's trusted proxy, a client can spoof their IP by prepending a fake address to the header. This is relevant for IP-based rate limiting and for the `ipAddress` field stored in the `session` table.
  - Remediation: When reading client IP for rate limiting, use only the rightmost IP in `X-Forwarded-For` (the one appended by Railway's load balancer, which cannot be spoofed by the client) or use Railway's `X-Real-IP` header if available. Document the trusted proxy assumption explicitly in the rate-limiting utility.

---

## 5. Data Storage Security

*Supabase manages PostgreSQL on AWS RDS. Storage-layer encryption (AES-256 at rest) and TLS in transit are provided by Supabase by default and are not user-configurable. This section evaluates application-layer data security decisions.*

---

- **[High] CLOUD-014** — TOTP secrets and backup codes stored without application-layer encryption (duplicate of CLOUD-001 from data perspective)
  - Resource: PostgreSQL table `twoFactor`, columns `secret` (TEXT) and `backupCodes` (TEXT)
  - Description: See CLOUD-001. From a data storage perspective: Supabase's at-rest encryption protects against physical disk theft but not against logical access (SQL queries, backups, replication streams, Supabase dashboard). The `secret` column contains the raw TOTP seed in a format that allows generating valid current codes. The `backupCodes` column contains recovery codes that permanently bypass 2FA. Both should be treated as credentials, not data.
  - Remediation: As described in CLOUD-001. Additionally, consider storing backup codes as individual hashed rows in a separate `twoFactorBackupCode` table (one row per code, with a `usedAt` timestamp) rather than a serialized list in a single TEXT column, which makes atomic single-use enforcement easier and avoids deserializing the entire list on each verification attempt.

---

- **[High] CLOUD-015** — OAuth access tokens and refresh tokens stored in plaintext
  - Resource: PostgreSQL table `account`, columns `accessToken` (TEXT), `refreshToken` (TEXT), `idToken` (TEXT)
  - Description: Live OAuth bearer tokens for GitHub and Google are stored in plaintext. A refresh token in particular is long-lived (GitHub refresh tokens are valid for 6 months; Google refresh tokens are indefinite until revoked). An attacker with database read access can use these tokens to access the user's GitHub or Google account directly, independent of the application. The `idToken` (a JWT) may contain PII (name, email, profile picture URL) that should not be persisted longer than necessary.
  - Remediation: Encrypt `accessToken` and `refreshToken` at the application layer using AES-256-GCM with a key stored in Railway's secret store. For `idToken`, evaluate whether persistence is required at all — if it is only needed during the OAuth callback flow, store it transiently (in the session) rather than in the database. Implement a background job to purge expired tokens (where `accessTokenExpiresAt < NOW()`).

---

- **[Medium] CLOUD-016** — No database backup or point-in-time recovery configuration visible
  - Resource: Supabase PostgreSQL — backup configuration (dashboard-managed)
  - Description: Supabase Free and Pro tiers provide daily backups with 7-day retention (Pro) or no PITR (Free). The current tier is not specified. If the application is on the Free tier, there are no automated backups, meaning a destructive event (accidental `DROP TABLE`, ransomware via a compromised DB credential, or a Supabase incident) results in total data loss. Even on Pro, 7-day daily backups may not meet the implicit RPO for a production auth system.
  - Remediation: Confirm the Supabase tier and enable PITR (available on Pro tier, providing 1-second granularity up to 7 days). For additional protection, implement a daily `pg_dump` export to an S3 bucket (or GCS, to stay on GCP) via a Railway cron job or GitHub Actions scheduled workflow. Test restore procedures quarterly.

---

- **[Medium] CLOUD-017** — `audit.input` and `audit.result` store user-submitted code and AI responses in plaintext
  - Resource: PostgreSQL table `audit`, columns `input` (TEXT) and `result` (TEXT)
  - Description: The `input` column stores the code submitted for audit (which may contain secrets, API keys, or proprietary business logic from the user's codebase). The `result` column stores the full AI-generated audit report. These are stored indefinitely with no visible retention policy or TTL. A database read exposes potentially sensitive user code to anyone with DB access. This is particularly relevant given the platform's purpose (auditing code that may itself contain credentials).
  - Remediation: Implement a data retention policy: automatically delete or archive `audit` rows older than a configurable period (e.g., 90 days) via a scheduled job. Consider encrypting `input` and `result` at the application layer, or at minimum truncating/redacting the `input` field after the audit completes. Add a user-facing data deletion endpoint (`DELETE /api/audits/:id`) so users can remove their own audit history.

---

- **[Low] CLOUD-018** — No object versioning or soft-delete on audit records
  - Resource: PostgreSQL table `audit`
  - Description: Audit records have no `deletedAt` soft-delete column and no versioning. A bug or malicious request that triggers a `DELETE` or `UPDATE` on audit rows results in permanent, unrecoverable data loss (absent a database backup). The `status` field transitions are also not logged, making it impossible to reconstruct the audit lifecycle after the fact.
  - Remediation: Add a `deletedAt TIMESTAMP WITH TIME ZONE` column and implement soft-delete semantics. Add an `audit_log` table (or use a PostgreSQL trigger) to record status transitions with timestamps. This also supports compliance requirements if they are introduced later.

---

- **[Low] CLOUD-019** — `drizzle.config.ts` uses `DATABASE_URL!` non-null assertion with no local validation
  - Resource: `drizzle.config.ts` → `url: process.env.DATABASE_URL!`
  - Description: The Drizzle Kit configuration uses a non-null assertion. If `DATABASE_URL` is unset when running `db:migrate` or `db:push` locally, the error message will be a cryptic connection failure rather than a clear "DATABASE_URL is required" message. More importantly, if a developer runs `db:push` against a misconfigured environment (e.g., accidentally pointing at production), there is no confirmation prompt or environment guard.
  - Remediation: Add an explicit check: `if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')`. Consider adding an environment guard that requires a `--force` flag or an explicit `ALLOW_PRODUCTION_MIGRATION=true` env var when `DATABASE_URL` contains the production Supabase hostname.

---

## 6. Compute & Container Security

*Railway manages all container infrastructure (GCP Cloud Run or equivalent). Users cannot configure privileged flags, host networking, or IMDSv2. This section evaluates application-level compute security: runtime behavior, dependency supply chain, and deployment pipeline integrity.*

---

- **[Medium] CLOUD-020** — No environment separation: PRs and production share the same secrets context
  - Resource: Railway deployment — single environment; GitHub Actions CI
  - Description: There is no staging or development environment. Pull requests are type-checked and built against a `dummy_key_for_build` for `ANTHROPIC_API_KEY`, but there is no integration test environment with real (non-production) credentials. This means: (1) any bug introduced in a PR is not caught until it hits production; (2) developers who need to test against real APIs must use production credentials locally, increasing the risk of credential exposure; (3) a compromised GitHub Actions runner (e.g., via a malicious dependency in `npm ci`) has no production secrets to steal only because the build step uses a dummy key — but if Railway auto-deploys on merge to `main`, the production environment is one merged PR away from any CI compromise.
  - Remediation: Create a Railway staging environment with separate credentials (separate Anthropic key with a low spend limit, separate Supabase project, separate OAuth apps). Configure Railway's GitHub integration to deploy PRs to staging and `main` to production. This is the single highest-leverage architectural improvement available.

---

- **[Medium] CLOUD-021** — SRI (`sri: { algorithm: 'sha256' }`) enabled but effectiveness depends on CDN configuration
  - Resource: `next.config.ts` → `experimental.sri.algorithm: 'sha256'`
  - Description: Next.js SRI injects `integrity` attributes on `<script>` and `<link>` tags for statically known chunks. However, if Railway serves assets through a CDN or reverse proxy that modifies response bodies (e.g., minification, compression header injection, or HTML rewriting), SRI hashes will fail and the page will break. Additionally, SRI does not protect dynamically loaded chunks that are fetched at runtime via `import()` unless those chunks are also covered by the nonce/hash CSP policy. The interaction between SRI and the nonce-based CSP needs explicit verification.
  - Remediation: Verify SRI is functioning correctly in production by inspecting the rendered HTML for `integrity` attributes on script tags. Confirm that Railway's proxy layer does not modify asset content. Test that the nonce-based CSP and SRI do not conflict (a script tag should have either a valid nonce or a valid integrity hash, not both required simultaneously by the browser).

---

- **[Medium] CLOUD-022** — GitHub Actions workflow has no pinned action SHA hashes
  - Resource: `.github/workflows/ci.yml` → `actions/checkout@v4`, `actions/setup-node@v4`
  - Description: Actions are pinned to mutable version tags (`@v4`) rather than immutable commit SHAs. A compromised or malicious update to `actions/checkout` or `actions/setup-node` at the `v4` tag would execute in the CI pipeline with access to all secrets injected into the workflow. While GitHub-owned actions are relatively low risk, this is a supply chain attack surface that is trivially mitigated.
  - Remediation: Pin all actions to their full commit SHA: e.g., `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2). Use a tool like `pin-github-action` or Dependabot's `github-actions` ecosystem support to keep SHAs updated automatically.

---

- **[Low] CLOUD-023** — Node.js version pinned to `>=20.0.0 <21.0.0` (Node 20 LTS) — approaching end of active LTS
  - Resource: `package.json` → `engines.node: ">=20.0.0 <21.0.0"`; `.nvmrc` (referenced but not shown)
  - Description: Node.js 20 LTS enters maintenance mode in October 2025 and reaches end-of-life in April 2026. Security patches will be less frequent during maintenance mode. Node.js 22 is the current active LTS.
  - Remediation: Plan migration to Node.js 22 LTS. Update `package.json` engines, `.nvmrc`, and the Railway runtime configuration. Test for compatibility with `next@15`, `better-auth`, and `drizzle-orm` on Node 22 before promoting to production.

---

- **[Low] CLOUD-024** — No container image vulnerability scanning in CI pipeline
  - Resource: `.github/workflows/ci.yml` — no image scanning step
  - Description: The CI pipeline runs `npm audit` for JavaScript dependencies but does not scan the Railway-provided base container image for OS-level vulnerabilities. Railway uses a managed base image that may contain outdated system packages (OpenSSL, glibc, curl) with known CVEs.
  - Remediation: Since Railway manages the base image, subscribe to Railway's security advisory channel and monitor their changelog for base image updates. As a compensating control, add `npm audit --audit-level=moderate` (currently `--audit-level=high`) to catch medium-severity JS vulnerabilities that could be chained with OS-level issues.

---

## 7. Secrets & Configuration Management

---

- **[High] CLOUD-025** — No secret rotation mechanism or rotation schedule defined for any credential
  - Resource: All secrets: `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, OAuth secrets, `HEALTH_SECRET`, `REVALIDATION_SECRET`, `API_ACCESS_TOKEN`
  - Description: None of the application secrets have a defined rotation schedule or automated rotation mechanism. `BETTER_AUTH_SECRET` is particularly sensitive: rotating it invalidates all active sessions (acceptable) but there is no documented procedure for doing so safely (e.g., dual-key overlap period). `DATABASE_URL` contains the Supabase database password, which Supabase does not rotate automatically. If any secret is leaked (e.g., via a log line, a compromised developer machine, or a Railway environment variable export), there is no detection mechanism and no rotation playbook.
  - Remediation: Document a rotation runbook for each secret class. For `ANTHROPIC_API_KEY` and `RESEND_API_KEY`: rotate quarterly via their respective consoles. For `BETTER_AUTH_SECRET`: implement a key versioning scheme (store `BETTER_AUTH_SECRET_v2` alongside `v1` during a transition window). For `DATABASE_URL`: use Supabase's "Reset database password" feature on a scheduled basis and update Railway's environment variables atomically. Consider integrating with a secrets manager (HashiCorp Vault, AWS Secrets Manager via Supabase's AWS substrate) for automated rotation.

---

- **[Medium] CLOUD-026** — `BETTER_AUTH_URL` defaults to `http://localhost:3000` in `.env.example` with no production override enforcement
  - Resource: `.env.example` → `BETTER_AUTH_URL=http://localhost:3000`; `lib/auth.ts` → `trustedOrigins`
  - Description: If `BETTER_AUTH_URL` is not set in the Railway production environment, the `trustedOrigins` array will include `http://localhost:3000` as a trusted CSRF origin. An attacker who can make requests appear to originate from `localhost:3000` (e.g., via a server-side request forgery on the same host, or if Railway's internal routing ever resolves localhost) could bypass CSRF validation. The `NEXT_PUBLIC_APP_URL` fallback partially mitigates this, but the root cause is the insecure default.
  - Remediation: Add a startup assertion: `if (process.env.BETTER_AUTH_URL === 'http://localhost:3000' && process.env.NODE_ENV === 'production') throw new Error('BETTER_AUTH_URL must be set to the production URL')`. Remove `http://localhost:3000` from the `trustedOrigins` fallback in production. Add `BETTER_AUTH_URL` to a required-in-production environment variable checklist.

---

- **[Medium] CLOUD-027** — Railway environment variables are the sole secrets store with no audit trail
  - Resource: Railway dashboard — environment variable management
  - Description: All application secrets are stored as Railway environment variables, which are accessible to any team member with Railway project access. There is no audit log of who viewed or modified a secret, no approval workflow for secret changes, and no detection if a secret is exfiltrated via the Railway dashboard. Railway does not currently offer secret versioning or access-scoped secret views.
  - Remediation: Restrict Railway project access to the minimum necessary team members. Enable Railway's audit log feature (available on Team plan) to track environment variable changes. For the highest-sensitivity secrets (`BETTER_AUTH_SECRET`, `DATABASE_URL`), consider storing them in a dedicated secrets manager (e.g., Doppler, Infisical, or HashiCorp Vault) and injecting them into Railway at deploy time via Railway's secret reference feature, rather than storing them directly in Railway's environment variable store.

---

- **[Low] CLOUD-028** — `ANTHROPIC_API_KEY: dummy_key_for_build` hardcoded in CI workflow
  - Resource: `.github/workflows/ci.yml` → `env: ANTHROPIC_API_KEY: dummy_key_for_build`
  - Description: The dummy key is intentional and non-functional, but hardcoding it in the workflow file establishes a pattern that could be accidentally replicated with a real key. It also means the build step does not validate that the real key format is correct (the Anthropic SDK may accept any string at initialization time and only fail at the first API call).
  - Remediation: Replace the hardcoded dummy with a GitHub Actions secret (`${{ secrets.ANTHROPIC_API_KEY_BUILD_DUMMY }}`) set to a known-invalid value. This enforces the pattern of never hardcoding credentials in workflow files, even dummy ones. Alternatively, refactor the build to not require `ANTHROPIC_API_KEY` at build time (lazy initialization of the Anthropic client).

---

- **[Low] CLOUD-029** — No KMS encryption on Supabase database (application-managed encryption only at Supabase Enterprise tier)
  - Resource: Supabase PostgreSQL — encryption configuration
  - Description: Supabase provides AES-256 encryption at rest on all tiers, but customer-managed KMS keys (CMEK) are only available on the Enterprise tier. On Free/Pro tiers, Supabase holds the encryption keys. This means Supabase (and by extension AWS) can theoretically decrypt the database. For a platform handling user auth data and potentially sensitive code submissions, this is a relevant trust boundary.
  - Remediation: For the current scale, this is an accepted risk given the cost of Enterprise tier. Mitigate by implementing application-layer encryption for the most sensitive columns (CLOUD-001, CLOUD-014, CLOUD-015), which provides protection independent of the storage-layer key holder. Document this as an accepted risk with a review trigger (e.g., "revisit when ARR exceeds $X or when compliance requirements are introduced").

---

## 8. Resilience & Disaster Recovery

---

- **[High] CLOUD-030** — Single production environment with no staging: any deployment failure hits production directly
  - Resource: Railway deployment — single environment; GitHub Actions → Railway auto-deploy on `main` push
  - Description: Every merge to `main` triggers an immediate production deployment. The CI pipeline catches type errors, lint issues, and build failures, but does not catch runtime errors, database migration failures, or behavioral regressions. A failed migration (e.g., a `NOT NULL` column added without a default on a table with existing rows) will cause the application to crash on startup, resulting in a production outage with no fallback environment. Railway's rollback capability requires manual intervention.
  - Remediation: As noted in CLOUD-020, create a staging environment. Additionally, implement Railway's health check configuration so that a deployment that fails its health check is automatically rolled back rather than replacing the running instance. Add a post-deploy smoke test step in CI that hits `/api/health` on the staging deployment before promoting to production.

---

- **[Medium] CLOUD-031** — No multi-region or multi-AZ configuration; single Railway region
  - Resource: Railway deployment — single region (GCP region, unspecified)
  - Description: The application runs in a single Railway region with no failover. A GCP regional outage or a Railway platform incident results in complete unavailability. Supabase is also deployed in a single AWS region (unspecified). There is no read replica, no cross-region replication, and no DNS failover configuration.
  - Remediation: For the current scale, full multi-region active-active is likely over-engineered. Minimum viable resilience: (1) document the Railway region and Supabase region, and ensure they are geographically co-located to minimize latency; (2) enable Supabase's read replica feature (Pro tier) in a second region for DR; (3) configure Railway's restart policy to automatically restart crashed containers; (4) set up an external uptime monitor (e.g., Better Uptime, Checkly) with alerting to detect regional outages.

---

- **[Medium] CLOUD-032** — No database migration rollback strategy
  - Resource: `drizzle/0000_cute_wrecker.sql` — forward-only migration; no down migration files
  - Description: The Drizzle migration directory contains only forward migrations. There are no `down` migration files and no documented rollback procedure. If a migration introduces a breaking schema change (e.g., dropping a column, adding a non-nullable constraint), rolling back the application code without rolling back the schema will cause runtime errors. Drizzle Kit does not generate down migrations by default.
  - Remediation: For each forward migration, author a corresponding rollback script (e.g., `drizzle/0000_rollback.sql`) and store it in the repository. Before applying any migration to production, test the rollback script in the staging environment. Consider using a migration tool that supports transactional DDL (PostgreSQL supports this) so that a failed migration is automatically rolled back rather than leaving the schema in a partial state.

---

- **[Low] CLOUD-033** — No defined RTO/RPO targets
  - Resource: Architecture documentation — none present
  - Description: There are no documented Recovery Time Objective (RTO) or Recovery Point Objective (RPO) targets. Without these, it is impossible to evaluate whether the current backup strategy (Supabase daily backups, if on Pro tier) is adequate, or to prioritize resilience investments.
  - Remediation: Define RTO and RPO targets appropriate for the business (e.g., RTO: 4 hours, RPO: 24 hours as a starting point). Document them in a runbook. Validate that the current Supabase backup configuration meets the RPO target. Test a full restore from backup to validate the RTO target.

---

## 9. Cost Optimization

*Railway and Supabase are consumption-based PaaS platforms. Traditional cloud cost optimization (reserved instances, right-sizing EC2) does not apply. This section covers application-level cost drivers.*

---

- **[Medium] CLOUD-034** — No per-user Anthropic API token budget enforcement
  - Resource: Application runtime — Anthropic API proxy; `@upstash/redis` (declared but rate limiting implementation not shown)
  - Description: Without per-user token budget tracking, a single user (or an attacker who bypasses rate limiting) can consume the entire Anthropic API budget. Claude 3.x models are priced per input/output token; a single large code submission can cost $0.10–$1.00 depending on the model and context length. Without a hard cap, a malicious or abusive user can generate significant unexpected costs.
  - Remediation: Track cumulative token usage per user per billing period in Upstash Redis (increment on each API response using the `usage` field returned by the Anthropic SDK). Enforce a hard monthly token budget per user tier (e.g., free tier: 100K tokens/month, paid tier: 1M tokens/month). Return a `429 Too Many Requests` with a `Retry-After` header when the budget is exhausted. Set an Anthropic Console spend alert at 80% of the monthly budget.

---

- **[Low] CLOUD-035** — No lifecycle policy on `audit` table rows; unbounded storage growth
  - Resource: PostgreSQL table `audit` — no TTL or archival policy
  - Description: The `audit` table stores full code submissions (`input`) and full AI responses (`result`) indefinitely. As the user base grows, this table will become the dominant storage cost driver. Supabase charges for database storage above the free tier limit (500MB free, then $0.125/GB/month on Pro).
  - Remediation: Implement a scheduled cleanup job (Railway cron or GitHub Actions scheduled workflow) that deletes or archives `audit` rows older than 90 days (or a user-configurable retention period). Add a `VACUUM ANALYZE` step after bulk deletes to reclaim storage. Consider moving old audit results to a cheaper object store (S3/GCS) and storing only a reference URL in the database.

---

- **[Low] CLOUD-036** — Dependabot `open-pull-requests-limit: 10` may create PR noise without a triage process
  - Resource: `.github/dependabot.yml` → `open-pull-requests-limit: 10`
  - Description: Without a defined triage process, Dependabot PRs accumulate and are often ignored, defeating the purpose of automated dependency updates. Stale Dependabot PRs also create merge conflicts that increase the cost of eventually merging them.
  - Remediation: Assign a team member as the weekly Dependabot PR reviewer. Configure auto-merge for patch updates that pass CI (GitHub's `dependabot auto-merge` feature). Set `open-pull-requests-limit: 5` to reduce noise. Add a weekly reminder in the team's communication channel.

---

- **[Low] CLOUD-037** — `max_lifetime: 60 * 30` (30 minutes) on database connections may cause unnecessary reconnection overhead
  - Resource: `lib/db.ts` → `max_lifetime: 60 * 30`
  - Description: A 30-minute connection lifetime means connections are recycled every 30 minutes regardless of activity. On Railway, where the application may handle bursty traffic, this can cause connection churn during high-traffic periods. Supabase's connection pooler (PgBouncer) already manages connection lifecycle; setting `max_lifetime` too low in the application layer adds overhead without benefit.
  - Remediation: If using Supabase's connection pooler (`pooler.supabase.com` in `DATABASE_URL`), the `max_lifetime` in the application pool is largely redundant — PgBouncer manages the server-side connections. Consider increasing `max_lifetime` to 3600 seconds (1 hour) or removing it entirely when using the pooler. If using a direct connection, keep `max_lifetime` but increase it to 3600 seconds to reduce churn.

---

- **[Low] CLOUD-038** — No CDN in front of Railway; all traffic hits the origin server
  - Resource: Railway deployment — no CDN configuration visible
  - Description: The `next.config.ts` includes `Cache-Control` headers for ISR pages (`/audit/:agent`, `/privacy`, `/how-it-works`) with `s-maxage` values, indicating CDN caching is intended. However, without a CDN (Cloudflare, Fastly, or Vercel's edge network) in front of Railway, these headers have no effect — all requests hit the Railway origin. This means: (1) static and ISR pages are not cached at the edge, increasing Railway compute costs and latency; (2) there is no DDoS mitigation layer.
  - Remediation: Place Cloudflare (free tier) or a similar CDN in front of Railway. Configure Railway's custom domain to point to Cloudflare, and Cloudflare's origin to point to Railway. Enable Cloudflare's caching for the routes with `s-maxage` headers. This also provides DDoS protection, bot mitigation, and TLS termination at the edge.

---

## 10. Prioritized Remediation Roadmap

| # | Finding | One-Line Fix | Effort | Timing |
|---|---|---|---|---|
| 1 | **CLOUD-001/014** — TOTP secrets & backup codes in plaintext | Implement AES-256-GCM application-layer encryption on `twoFactor.secret`, `twoFactor.backupCodes`; hash backup codes with argon2 | 3–5 days | Immediate |
| 2 | **CLOUD-015** — OAuth tokens in plaintext | Encrypt `account.accessToken`, `account.refreshToken` at application layer; evaluate dropping `idToken` persistence | 2–3 days | Immediate |
| 3 | **CLOUD-002** — Email verification disabled | Set `requireEmailVerification: true` and confirm `RESEND_API_KEY` is set in Railway production environment | 2 hours | Immediate |
| 4 | **CLOUD-009** — CORS not enforced in API handlers | Implement `validateOrigin()` utility and apply as first check in all POST/streaming API route handlers | 1 day | Immediate |
| 5 | **CLOUD-011** — In-memory rate limiting | Migrate to Upstash Redis sliding window rate limiter using the already-declared `@upstash/ratelimit` package | 1–2 days | Immediate |
| 6 | **CLOUD-025** — No secret rotation schedule | Document and execute rotation runbook for all credentials; set calendar reminders for quarterly rotation | 4 hours | Immediate |
| 7 | **CLOUD-030** — No staging environment | Create Railway staging environment with separate credentials; configure PR preview deployments | 1–2 days | Scheduled (next sprint) |
| 8 | **CLOUD-003** — Optional secrets with no enforcement | Add startup assertions for `HEALTH_SECRET`, `REVALIDATION_SECRET`, `API_ACCESS_TOKEN` in production | 2 hours | Scheduled (next sprint) |
| 9 | **CLOUD-034** — No per-user Anthropic token budget | Implement Redis-backed per-user token counter with hard monthly cap | 1–2 days | Scheduled (next sprint) |
| 10 | **CLOUD-026** — `BETTER_AUTH_URL` insecure default | Add startup assertion rejecting `localhost` value in production | 30 minutes | Immediate |

---

## 11. Overall Risk Score

| Domain | Rating | Key Finding |
|---|---|---|
| IAM & Access | **High** | TOTP secrets and OAuth tokens in plaintext DB columns enable account takeover from any DB read access (CLOUD-001, CLOUD-015) |
| Network Exposure | **Medium** | CORS allowlist defined but not enforced in handlers; in-memory rate limiting bypassable at scale (CLOUD-009, CLOUD-011) |
| Data Security | **High** | Sensitive credentials (TOTP seeds, OAuth tokens, user code submissions) stored without application-layer encryption or retention policy (CLOUD-014, CLOUD-015, CLOUD-017) |
| Compute Security | **Medium** | No staging environment; GitHub Actions actions unpinned; no container image scanning (CLOUD-020, CLOUD-022) |
| Resilience | **Medium** | Single environment with no rollback automation; no defined RTO/RPO; no migration rollback strategy (CLOUD-030, CLOUD-032) |
| **Net Risk Posture** | **High** | Two independent High-severity data exposure paths (plaintext credential storage + disabled email verification) in a production auth system with no staging safety net |