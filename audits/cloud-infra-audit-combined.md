# Cloud Infrastructure Security & Architecture Report — Combined (5 runs)

**Codebase:** Next.js 15.5 + Railway (PaaS/GCP) + Supabase PostgreSQL (AWS)
**Consensus:** All 5 runs rated overall risk as **High**
**Severity counts:** Runs 1/2/5: 2 Critical, 9 High, 11 Medium, 7 Low (29 total) | Run 3: 2 Critical, 8 High, 12 Medium, 8 Low (30 total) | Run 4: 0 Critical, 7 High, 9 Medium, 8 Low (24 total)
**Runs:** 5 independent audits merged; consensus noted per finding

---

## 1. Executive Summary

The application handles sensitive authentication material (TOTP secrets, backup codes, OAuth tokens, password hashes) and proxies requests to the Anthropic Claude API. It is deployed on Railway with a Supabase-managed PostgreSQL backend and no formal Infrastructure-as-Code tooling.

The **highest-risk finding** across all 5 runs is the storage of TOTP secrets, 2FA backup codes, and OAuth tokens as plaintext text columns in the database. A single database credential leak — via SQL injection, compromised Supabase service role key, or Supabase breach — would expose all user authentication factors with no compensating encryption layer.

**Architecture summary:**
- Railway PaaS (Next.js 15, Node.js 20) — single environment, auto-deploy from GitHub `main`
- Supabase managed PostgreSQL (AWS-backed) — direct connection from app
- Anthropic Claude API + Resend email API (external, egress only)
- GitHub Actions CI/CD with Dependabot
- In-memory rate limiting (process-scoped, lost on restart/scale)
- better-auth session/auth system with 2FA and admin plugin

---

## 2. Severity Legend

| Severity | Meaning |
|---|---|
| Critical | Immediate exploitation path leading to full data compromise or service takeover |
| High | Significant security gap exploitable under realistic threat scenarios |
| Medium | Defense gap that increases attack surface or complicates incident response |
| Low | Hardening opportunity; low immediate risk but contributes to security debt |

---

## 3. Findings — Data Security & Encryption

### **[Critical] CLOUD-001** — TOTP secrets and 2FA backup codes stored in plaintext
*Consensus: 5/5 runs (highest-risk finding across all runs)*

- **Location:** `lib/auth-schema.ts` — `twoFactor` table: `secret text`, `backupCodes text`
- **Impact:** An attacker with any database read access (SQL injection, compromised Supabase service role key, Supabase breach, or leaked `DATABASE_URL`) can extract all TOTP seeds and generate valid codes indefinitely — completely defeating 2FA for every enrolled user. Backup codes allow immediate account takeover without the TOTP device.
- **Remediation:**
  1. Implement AES-256-GCM application-layer encryption with a dedicated `TOTP_ENCRYPTION_KEY` environment variable
  2. Encrypt `secret` and `backupCodes` before writing to DB; decrypt on read
  3. Run a one-time migration to encrypt existing plaintext values
  4. Add `TOTP_ENCRYPTION_KEY` to `.env.example` and Railway secrets
- **Effort:** 1–2 days (encryption logic + data migration)

---

### **[Critical] CLOUD-002** — OAuth tokens stored in plaintext
*Consensus: 5/5 runs*

- **Location:** `lib/auth-schema.ts` — `account` table: `accessToken text`, `refreshToken text`, `idToken text`
- **Impact:** Leaked DB credentials expose live OAuth tokens that grant access to users' GitHub repositories, Google Drive, Gmail, and other scoped resources — far beyond this application's scope. Refresh tokens may remain valid for months or years.
- **Remediation:**
  1. Apply same AES-256-GCM encryption as CLOUD-001 to all token columns
  2. Evaluate whether storing `refreshToken` and `idToken` is necessary — if the app only authenticates users (not acts on their behalf), discard after initial OAuth flow
  3. Implement token expiry enforcement: check `accessTokenExpiresAt` before use
  4. Add a cleanup job to purge tokens for accounts inactive >90 days
- **Effort:** Included in CLOUD-001 effort

---

### **[High] CLOUD-003** — Supabase Row Level Security (RLS) not confirmed enabled
*Consensus: 5/5 runs*

- **Location:** Supabase project configuration (not visible in codebase)
- **Impact:** Default Supabase behavior may expose all tables via the PostgREST API if RLS is not explicitly enabled. Any client with the Supabase anon key could query all tables directly, bypassing application-level access controls.
- **Remediation:**
  1. Enable RLS on ALL tables in Supabase dashboard
  2. Add `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` to Drizzle migration files
  3. Add RLS verification to CI pipeline
- **Effort:** 2 hours

---

### **[High] CLOUD-004** — No database backup verification or PITR configuration
*Consensus: 5/5 runs*

- **Location:** Supabase project settings
- **Impact:** Reliance on Supabase default backup behavior without verified restore procedures. If data is corrupted or deleted, recovery capability is unknown.
- **Remediation:**
  1. Verify PITR is enabled in Supabase project settings (requires Pro plan)
  2. Document and test restore procedure quarterly
  3. Define RPO/RTO targets
- **Effort:** 4 hours (verification + documentation)

---

### **[Medium] CLOUD-005** — `audit.input` column stores raw user code with no DB-level size constraint
*Consensus: 5/5 runs*

- **Location:** `lib/auth-schema.ts` — `audit` table: `input text`
- **Impact:** Application-level cap is 60K chars, but no DB-level constraint prevents larger values from being inserted via direct DB access or a bug.
- **Remediation:** Add `CHECK (length(input) <= 100000)` constraint to the table definition.
- **Effort:** 30 minutes

---

### **[Medium] CLOUD-006** — No audit table row cleanup policy
*Consensus: 5/5 runs*

- **Location:** `audit` table — completed/failed audits accumulate indefinitely
- **Impact:** Unbounded storage growth increases Supabase costs and slows queries over time.
- **Remediation:** Add pg_cron job or GitHub Actions scheduled workflow to archive/delete audits older than 90 days.
- **Effort:** 2 hours

---

## 4. Findings — Secrets Management

### **[High] CLOUD-007** — No secrets rotation policy for any credential
*Consensus: 5/5 runs*

- **Location:** All environment variables: `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, `DATABASE_URL`, OAuth client secrets
- **Impact:** If any credential is compromised, there is no rotation runbook, no automation, and no audit trail for when secrets were last changed.
- **Remediation:**
  1. Document rotation runbook for each credential
  2. Schedule quarterly rotation with calendar reminders
  3. Migrate to a secrets manager (Doppler, Infisical) for audit trail
- **Effort:** 4 hours (runbook) + ongoing

---

### **[High] CLOUD-008** — Optional security secrets may be unset in production
*Consensus: 5/5 runs*

- **Location:** `.env.example` — `HEALTH_SECRET`, `REVALIDATION_SECRET`, `API_ACCESS_TOKEN` marked as optional
- **Impact:** If unset, their respective access control checks are silently disabled, leaving the health endpoint, ISR revalidation, and API access unprotected.
- **Remediation:** Add startup assertions that fail-fast in production if these are not set:
  ```typescript
  if (process.env.NODE_ENV === 'production' && !process.env.HEALTH_SECRET) {
    throw new Error('HEALTH_SECRET must be set in production');
  }
  ```
- **Effort:** 1 hour

---

### **[High] CLOUD-009** — `BETTER_AUTH_SECRET` validation only at runtime, not CI
*Consensus: 4/5 runs*

- **Location:** `lib/auth.ts` — runtime check for 32+ char secret
- **Impact:** A weak or missing secret can reach production undetected until the first request hits the auth module. Railway's health check may not trigger this code path.
- **Remediation:** Add a CI step that validates the secret strength, or add a Railway health check that triggers auth module initialization.
- **Effort:** 1 hour

---

### **[Medium] CLOUD-010** — `RESEND_API_KEY` absence silently disables email sending
*Consensus: 5/5 runs*

- **Location:** `lib/auth.ts` — `const resend = process.env.RESEND_API_KEY ? new Resend(...) : null`
- **Impact:** In production without Resend configured, password reset emails, 2FA OTP emails, and verification emails silently fail. Users receive no error feedback.
- **Remediation:** Log a warning at startup if `RESEND_API_KEY` is unset in production; consider failing fast for critical email flows.
- **Effort:** 30 minutes

---

### **[Medium] CLOUD-011** — Upstash Redis credentials undocumented
*Consensus: 4/5 runs*

- **Location:** `@upstash/redis` in `package.json` but `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` not in `.env.example`
- **Impact:** If Upstash is intended for production rate limiting, the missing env vars mean it's likely unused. If unused, the dependency is dead weight.
- **Remediation:** Add Upstash env vars to `.env.example` with documentation, or remove the dependency if not in use.
- **Effort:** 30 minutes

---

### **[Low] CLOUD-012** — `ANTHROPIC_API_KEY: dummy_key_for_build` in CI
*Consensus: 4/5 runs*

- **Location:** `.github/workflows/ci.yml`
- **Impact:** Low — the dummy key cannot be used for API calls. However, no secret scanning gate (TruffleHog, GitHub push protection) verifies that real keys don't get committed.
- **Remediation:** Enable GitHub push protection and add a `trufflehog` action to CI.
- **Effort:** 1 hour

---

## 5. Findings — Authentication & Access Control

### **[High] CLOUD-013** — Email verification disabled in production
*Consensus: 5/5 runs*

- **Location:** `lib/auth.ts` — `requireEmailVerification: false`
- **Impact:** Unverified email addresses can access authenticated features. Attackers can create accounts with victim email addresses for impersonation or abuse of per-user rate limits.
- **Remediation:** Set `requireEmailVerification: !!process.env.RESEND_API_KEY` so verification is automatically enabled when email sending is configured.
- **Effort:** 30 minutes

---

### **[High] CLOUD-014** — No account lockout on brute-force login attempts
*Consensus: 4/5 runs*

- **Location:** Email/password authentication endpoint
- **Impact:** The in-memory IP-based rate limiter (`authLoginLimiter`: 5 attempts per 15 min) does not protect against distributed attacks or credential stuffing from multiple IPs.
- **Remediation:** Implement per-email rate limiting using Redis (Upstash). Lock accounts after 10 failed attempts; require CAPTCHA or email verification to unlock.
- **Effort:** 3 hours

---

### **[Medium] CLOUD-015** — `admin()` plugin loaded with no visible RBAC enforcement
*Consensus: 5/5 runs*

- **Location:** `lib/auth.ts` — `plugins: [admin(), ...]`; middleware only checks prefix `/admin`
- **Impact:** The admin plugin grants elevated capabilities. Without explicit role checks in API handlers, any authenticated user who discovers admin endpoints could potentially access them.
- **Remediation:** Add role-based middleware checks on all admin API routes, not just prefix-based routing.
- **Effort:** 2 hours

---

### **[Medium] CLOUD-016** — Session cookie cache allows 5-minute stale sessions
*Consensus: 4/5 runs*

- **Location:** `lib/auth.ts` — `cookieCache: { enabled: true, maxAge: 5 * 60 }`
- **Impact:** A revoked or banned session remains valid for up to 5 minutes after revocation. In an active incident, this delays containment.
- **Remediation:** Consider reducing to 60 seconds, or implement a Redis-backed session revocation list for immediate invalidation.
- **Effort:** 1 hour

---

### **[Low] CLOUD-017** — Expired sessions never purged
*Consensus: 5/5 runs*

- **Location:** `session` table — no cleanup mechanism visible
- **Impact:** Expired sessions accumulate indefinitely, growing the table and slowing queries.
- **Remediation:** Add pg_cron or GitHub Actions scheduled job: `DELETE FROM session WHERE "expiresAt" < NOW()`.
- **Effort:** 1 hour

---

## 6. Findings — Network & Infrastructure

### **[High] CLOUD-018** — No WAF or DDoS protection
*Consensus: 5/5 runs*

- **Location:** Railway deployment configuration
- **Impact:** No infrastructure-layer protection against application-level DDoS, bot traffic, or web attacks. In-memory rate limiting is the only defense and does not survive restarts or horizontal scaling.
- **Remediation:** Add Cloudflare (free tier) or similar WAF/CDN in front of Railway. This also provides DDoS protection, bot management, and a CDN for static assets.
- **Effort:** 2–4 hours

---

### **[High] CLOUD-019** — In-memory rate limiting ineffective across replicas
*Consensus: 5/5 runs*

- **Location:** `lib/rateLimit.ts` — process-scoped `Map`-based store
- **Impact:** Each Railway replica maintains its own counter. The effective limit is `N × maxRequests` across N replicas. On restart, all counters reset. This is the primary abuse vector for Anthropic API cost exposure.
- **Remediation:** Migrate to Upstash Redis sliding window rate limiter (dependency already in `package.json`). Add `UPSTASH_REDIS_REST_URL`/`TOKEN` to env.
- **Effort:** 4 hours

---

### **[Medium] CLOUD-020** — Database not network-restricted to Railway egress
*Consensus: 3/5 runs*

- **Location:** Supabase project network settings
- **Impact:** The database accepts connections from any IP that has the connection string. A leaked `DATABASE_URL` allows direct access from any network.
- **Remediation:** Enable Railway static IP add-on; configure Supabase network restrictions to allowlist only Railway egress IPs.
- **Effort:** 2 hours

---

### **[Medium] CLOUD-021** — HSTS header inconsistency
*Consensus: 5/5 runs*

- **Location:** `next.config.ts` sets HSTS without `preload`; `middleware.ts` sets HSTS with `preload` and `includeSubDomains`
- **Impact:** Depending on header precedence, browsers may see an inconsistent HSTS policy. The `next.config.ts` header lacks `preload`, creating a potential gap.
- **Remediation:** Remove HSTS from `next.config.ts` (middleware handles it with the stronger policy).
- **Effort:** 10 minutes

---

### **[Medium] CLOUD-022** — CORS origin allowlist computed at module load
*Consensus: 4/5 runs*

- **Location:** `lib/config/apiHeaders.ts`
- **Impact:** If `NEXT_PUBLIC_APP_URL` is unset, the allowlist silently omits the app origin with no error. CORS is also only checked in some route handlers, not all.
- **Remediation:** Add a startup assertion for `NEXT_PUBLIC_APP_URL`; ensure all POST API routes validate the `Origin` header.
- **Effort:** 1 hour

---

### **[Low] CLOUD-023** — No CDN in front of Railway
*Consensus: 3/5 runs*

- **Impact:** All traffic (including static assets) hits the origin server directly. Adding Cloudflare (per CLOUD-018) solves both WAF and CDN.
- **Effort:** Included in CLOUD-018

---

## 7. Findings — CI/CD & Supply Chain

### **[High] CLOUD-024** — Dependabot ignores all major version updates
*Consensus: 5/5 runs*

- **Location:** `.github/dependabot.yml` — `ignore: [{ dependency-name: "*", update-types: ["version-update:semver-major"] }]`
- **Impact:** Critical security patches that require major version bumps (e.g., breaking API changes in `better-auth`, `react-markdown`) are never surfaced by Dependabot.
- **Remediation:** Remove the blanket major version ignore; instead, ignore specific packages that are known to have intentionally deferred major upgrades.
- **Effort:** 30 minutes

---

### **[Medium] CLOUD-025** — GitHub Actions has no explicit `permissions` block
*Consensus: 4/5 runs*

- **Location:** `.github/workflows/ci.yml`
- **Impact:** Default token permissions may be broader than needed. If a compromised dependency runs in CI, it has unnecessary access.
- **Remediation:** Add `permissions: { contents: read }` at the workflow level.
- **Effort:** 10 minutes

---

### **[Medium] CLOUD-026** — GitHub Actions uses unpinned action versions
*Consensus: 3/5 runs*

- **Location:** `.github/workflows/ci.yml` — `actions/checkout@v4`, `actions/setup-node@v4`
- **Impact:** Tag-based references (`@v4`) can be force-pushed by action maintainers. A compromised action tag could inject malicious code into CI.
- **Remediation:** Pin actions to full SHA hashes: `actions/checkout@<sha>`.
- **Effort:** 30 minutes

---

### **[Low] CLOUD-027** — `npm audit --audit-level=high` misses moderate CVEs
*Consensus: 5/5 runs*

- **Location:** `.github/workflows/ci.yml`
- **Impact:** Moderate-severity vulnerabilities (SSRF, info disclosure, ReDoS) in dependencies like `react-markdown` or `better-auth` are reported but don't block the build.
- **Remediation:** Lower to `--audit-level=moderate`, or add a separate non-blocking step that reports moderate findings to a Slack channel.
- **Effort:** 10 minutes

---

## 8. Findings — Compute & Resilience

### **[High] CLOUD-028** — Single production environment, no staging
*Consensus: 5/5 runs*

- **Location:** Railway project configuration
- **Impact:** Every deployment goes directly to production. A bad deploy affects all users with no rollback capability or canary testing.
- **Remediation:**
  1. Create a Railway staging environment with separate Supabase project
  2. Configure PR preview deployments
  3. Add manual approval gate in CI before production deploy
- **Effort:** 1–2 days

---

### **[Medium] CLOUD-029** — Single-region deployment, no failover
*Consensus: 5/5 runs*

- **Location:** Railway deployment (single region)
- **Impact:** A Railway region failure causes complete service outage. No automated failover.
- **Remediation:**
  1. Enable Railway health checks and "Always On"
  2. Document manual failover runbook
  3. Long-term: evaluate multi-region deployment
- **Effort:** 2 hours (health checks); future (multi-region)

---

### **[Medium] CLOUD-030** — No application-level circuit breaker for Anthropic API
*Consensus: 4/5 runs*

- **Location:** `lib/ai/anthropicProvider.ts` — retry logic exists but no circuit breaker
- **Impact:** A slow or unresponsive Anthropic API will cause all audit requests to queue, exhausting Railway's request concurrency. The 5-minute hard timeout (STREAM_TIMEOUT_MS) is the only protection.
- **Remediation:** Implement a circuit breaker that opens after N consecutive failures, returning an immediate error instead of queuing more requests.
- **Effort:** 3 hours

---

### **[Medium] CLOUD-031** — Connection pool configuration may cause cascading failures
*Consensus: 4/5 runs*

- **Location:** `lib/db.ts` — `max: isPooler ? 5 : 10`
- **Impact:** Direct PostgreSQL connections (non-pooler) with `max: 10` can exhaust Supabase's connection limit under load. The `connect_timeout: 10` and `statement_timeout: 30000` are good, but there's no connection pool exhaustion monitoring.
- **Remediation:** Use Supabase's PgBouncer pooler endpoint for all production connections; set `max: 1` per serverless function if deployed on Vercel/serverless.
- **Effort:** 1 hour

---

### **[Low] CLOUD-032** — No database migration rollback strategy
*Consensus: 3/5 runs*

- **Impact:** If a migration breaks production, there is no documented rollback procedure.
- **Remediation:** Document rollback steps for each migration; keep reverse migration scripts.
- **Effort:** Ongoing

---

### **[Low] CLOUD-033** — Node.js 20 approaching end-of-life
*Consensus: 4/5 runs*

- **Location:** `package.json` — `"engines": { "node": ">=20.0.0 <21.0.0" }`
- **Impact:** Node.js 20 LTS reaches end-of-life April 2026. After that date, no security patches will be released.
- **Remediation:** Plan upgrade to Node.js 22 LTS before April 2026.
- **Effort:** 2–4 hours (test + deploy)

---

## 9. Prioritized Remediation Roadmap

| # | Finding | Action | Effort | Priority |
|---|---|---|---|---|
| 1 | **CLOUD-001/002** | Encrypt TOTP secrets, backup codes, and OAuth tokens with AES-256-GCM at the application layer | 1–2 days | **Immediate** |
| 2 | **CLOUD-003** | Enable Supabase RLS on all tables; add to migration files | 2 hours | **Immediate** |
| 3 | **CLOUD-013** | Enable email verification when Resend is configured | 30 minutes | **Immediate** |
| 4 | **CLOUD-019** | Migrate rate limiting to Upstash Redis | 4 hours | **Immediate** |
| 5 | **CLOUD-018** | Add Cloudflare WAF/CDN in front of Railway | 2–4 hours | **Immediate** |
| 6 | **CLOUD-007** | Document + execute secrets rotation; adopt secrets manager | 4 hours + ongoing | **Immediate** |
| 7 | **CLOUD-008** | Add production startup assertions for security secrets | 1 hour | **Immediate** |
| 8 | **CLOUD-024** | Remove blanket Dependabot major version ignore | 30 minutes | **Immediate** |
| 9 | **CLOUD-028** | Create staging environment on Railway + Supabase | 1–2 days | **Immediate** |
| 10 | **CLOUD-014** | Implement per-email login rate limiting with Redis | 3 hours | **Scheduled** |
| 11 | **CLOUD-021** | Remove duplicate HSTS from next.config.ts | 10 minutes | **Scheduled** |
| 12 | **CLOUD-025** | Add `permissions: { contents: read }` to CI workflow | 10 minutes | **Scheduled** |
| 13 | **CLOUD-020** | Restrict Supabase network access to Railway IPs | 2 hours | **Scheduled** |
| 14 | **CLOUD-004** | Verify Supabase PITR; document restore procedure | 4 hours | **Scheduled** |
| 15 | **CLOUD-017** | Add session/audit row cleanup jobs | 2 hours | **Scheduled** |

---

## 10. Overall Risk Score

| Domain | Rating | Key Finding |
|---|---|---|
| IAM & Access | **High** | PaaS abstracts traditional IAM, but overprivileged DB credential + no RLS confirmation + no secrets rotation are significant gaps |
| Network Exposure | **High** | No WAF, no DDoS protection, DB not network-restricted, in-memory rate limiting ineffective at scale |
| Data Security | **Critical** | TOTP secrets and OAuth tokens in plaintext DB columns; a single DB credential leak = full user credential exposure |
| Compute Security | **Medium** | PaaS handles container security; single environment, no staging, no circuit breaker are the primary gaps |
| Secrets Management | **High** | No rotation policy, optional secrets may be unset, no secrets audit trail, no scanning in CI |
| Resilience | **Medium** | Single region, no verified backups, no staging, no migration rollback strategy |
| CI/CD & Supply Chain | **Medium** | Dependabot ignores major versions, unpinned action SHAs, no container scanning |
| **Net Risk Posture** | **High** | Two independent Critical data exposure paths (plaintext TOTP storage + plaintext OAuth token storage) in a production auth system, combined with no staging safety net and in-memory-only rate limiting. A single point of compromise (leaked `DATABASE_URL`) results in irrecoverable exposure of all user authentication factors. |

**Composite Score: 4/10**

The application has a solid security-aware codebase (nonce-based CSP, CSRF protection, input escaping, structured logging, SSL-required DB connections) but the infrastructure layer has critical gaps. The path to 7/10 requires: (1) encrypt sensitive DB columns, (2) enable Supabase RLS, (3) migrate rate limiting to Redis, (4) add WAF/CDN, and (5) create a staging environment — all achievable in 1 week of focused work.

---

## Appendix: What's Already Done Well

All 5 runs consistently praised these patterns:

- **Nonce-based CSP** in middleware — eliminates `unsafe-inline` for script-src in modern browsers
- **CSRF origin validation** on API routes
- **XML escape on user input** before prompt injection (`escapeUserInput()`)
- **Custom prompt preamble** for jailbreak resistance (VULN-003)
- **SSL required** on all database connections (`ssl: 'require'`)
- **HSTS with preload** in middleware (despite duplication in next.config.ts)
- **SRI enabled** (`sri: { algorithm: 'sha256' }`)
- **Structured JSON logging** with anonymized IPs (GDPR-aware)
- **Input size validation** via Zod schemas with hard character limits
- **`BETTER_AUTH_SECRET` minimum length enforcement** (32+ chars at startup)
- **Session expiry configuration** with sliding window renewal
- **Dependabot enabled** for automated dependency updates
- **Security audit in CI** (`npm audit --audit-level=high`)
- **URL allowlist proxy** — only permits GitHub raw/gist URLs via WHATWG URL parser
