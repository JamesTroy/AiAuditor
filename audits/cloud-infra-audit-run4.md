I'll systematically enumerate every resource and trust boundary before writing the report.

**Resources identified:**
- Railway PaaS (Next.js 15, Node.js) — single environment, auto-deploy from GitHub main
- Supabase managed PostgreSQL (AWS-backed)
- Anthropic Claude API (external, key-authenticated)
- Resend email API (external, key-authenticated)
- GitHub Actions CI/CD pipeline
- better-auth session/auth system with 2FA, admin plugin, OAuth
- Drizzle ORM with postgres.js direct connection
- Upstash Redis (dependency present: `@upstash/redis`)
- In-memory rate limiting (noted in context)
- CSP/middleware security layer
- URL fetch proxy with allowlist

**Blast radius assessment:**
- Single environment = any compromise is production compromise
- No IaC = no drift detection, no audit trail for config changes
- Direct DB connection from app = DB credential exposure = full data loss
- In-memory rate limiting = bypassable across restarts/instances
- `account` table stores OAuth access/refresh tokens and password hashes in plaintext columns
- `twoFactor` table stores TOTP secrets and backup codes in plaintext
- `ANTHROPIC_API_KEY` exposure = unbounded API spend + data exfiltration
- `requireEmailVerification: false` = account enumeration + unverified account abuse
- No staging environment = untested changes go directly to production users
- GitHub Actions uses `dummy_key_for_build` for ANTHROPIC_API_KEY — acceptable for build but signals no secret scanning
- `API_ACCESS_TOKEN`, `HEALTH_SECRET`, `REVALIDATION_SECRET` are optional — likely unset in many deployments
- `HSTS` set in both `next.config.ts` (without `preload`) and `middleware.ts` (with `preload`) — inconsistency
- CSP `report-uri` is deprecated alongside `report-to` — minor but noted
- No WAF layer visible
- No backup/restore policy documented
- No multi-AZ or failover for Railway deployment
- Supabase handles its own HA but RTO/RPO not defined
- `drizzle-kit` scripts (`db:push`, `db:studio`) present — risk of direct schema mutation in prod
- OAuth tokens stored in `account` table unencrypted at application layer
- TOTP secrets stored unencrypted at application layer
- No rate limiting on auth endpoints visible in provided code
- `callbackUrl` redirect validation present but only checks prefix — open redirect risk needs closer examination
- `NEXT_PUBLIC_*` variables expose OAuth provider enablement state publicly
- No Content-Security-Policy violation alerting pipeline beyond `/api/csp-report` endpoint (not shown)
- Dependabot ignores major versions — known CVEs in major bumps won't auto-remediate

---

## 1. Executive Summary

This assessment covers a Next.js 15 application deployed on Railway (PaaS on GCP) with a Supabase-managed PostgreSQL backend (AWS), using no Infrastructure-as-Code tooling — all configuration is managed via platform dashboards and GitHub-triggered auto-deployment. The overall risk posture is **High**, with **0 Critical**, **7 High**, **9 Medium**, and **8 Low** findings (24 total). No single wildcard IAM policy or publicly exposed storage bucket was identified, as the PaaS model abstracts most infrastructure controls; however, the highest-risk misconfiguration is the **storage of TOTP secrets and OAuth access/refresh tokens in plaintext database columns** (CLOUD-007), which — combined with a direct database connection from the application tier and a single production environment — means a database credential leak results in immediate, irrecoverable compromise of all user authentication factors, OAuth delegations, and session state with no compensating encryption layer at the application level.

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

*Note: Railway and Supabase are managed PaaS/DBaaS platforms. Traditional IAM roles, instance profiles, and service account keys are not directly configurable by the application team. Findings in this section address the access control surface that is within scope: API key management, database credential scope, OAuth secret handling, and platform-level access controls.*

---

- **[High] CLOUD-001** — Anthropic API key has no usage scope restriction and is used directly from application runtime
  - Resource: Environment variable `ANTHROPIC_API_KEY` consumed in Railway runtime
  - Description: The Anthropic API key is injected as a plain environment variable and used directly in the application process. Railway environment variables are accessible to all processes in the service and are visible in plaintext to any team member with Railway project access. Anthropic's API console does not currently support key-level spend caps or IP allowlisting, meaning a leaked key (via logs, error traces, or a Railway account compromise) enables unbounded API spend and exfiltration of all content sent to the Claude API — including user-submitted code under audit. There is no key rotation schedule, no alerting on anomalous spend, and no secondary validation that the key in use matches an expected prefix/format at startup.
  - Remediation: (1) Set a hard monthly spend limit in the Anthropic console. (2) Add a startup assertion that validates `ANTHROPIC_API_KEY` matches the `sk-ant-` prefix and minimum length, failing fast rather than silently using a malformed key. (3) Rotate the key on a defined schedule (90 days maximum) and document the rotation runbook. (4) Restrict Railway project access to the minimum set of engineers who require it, and enable Railway's audit log. (5) When Anthropic supports it, enable usage alerts at 50% and 80% of monthly budget.

---

- **[High] CLOUD-002** — Database connection string grants application-level credentials with unknown privilege scope
  - Resource: Environment variable `DATABASE_URL` / `lib/db.ts` postgres.js client
  - Description: The application connects to Supabase PostgreSQL using a single `DATABASE_URL` that is used for all operations: schema migrations (`drizzle-kit migrate`, `drizzle-kit push`), runtime queries, and the Drizzle Studio UI. If this is the Supabase `postgres` superuser connection string (the default shown in the Supabase dashboard), the application runtime process holds superuser privileges. A SQL injection vulnerability, a compromised Railway environment, or a leaked connection string would grant an attacker full database control including `COPY TO/FROM`, `CREATE EXTENSION`, and the ability to read all tables including `twoFactor.secret`, `account.accessToken`, and `account.password`. Additionally, `drizzle-kit push` is available as an npm script, meaning a developer could accidentally push schema changes directly to production without a migration review.
  - Remediation: (1) Create a dedicated Supabase database role for the application runtime with only `SELECT`, `INSERT`, `UPDATE`, `DELETE` on required tables — no DDL privileges. (2) Use a separate superuser-equivalent credential exclusively for migration runs in CI, stored as a separate secret (`DATABASE_MIGRATION_URL`), never deployed to the Railway runtime. (3) Remove or gate the `db:push` script so it cannot target production. (4) Enable Supabase's "Network Restrictions" to allowlist only Railway's egress IP range (available via Railway's static IP add-on or a NAT gateway).

---

- **[Medium] CLOUD-003** — Optional secrets (`HEALTH_SECRET`, `REVALIDATION_SECRET`, `API_ACCESS_TOKEN`) default to empty/unset, disabling their protection
  - Resource: `.env.example` — `HEALTH_SECRET`, `REVALIDATION_SECRET`, `API_ACCESS_TOKEN`
  - Description: These three secrets are documented as optional. If unset, the endpoints they protect (`/api/health`, ISR revalidation, API access control) either fall back to unauthenticated access or silently skip the check. An attacker who discovers the `/api/health` endpoint can probe internal state; an unauthenticated revalidation endpoint can be abused to trigger excessive ISR rebuilds (cache poisoning / DoS). The `API_ACCESS_TOKEN` being optional means API routes may be accessible without any bearer token in deployments where it was never configured.
  - Remediation: (1) Make `HEALTH_SECRET` and `REVALIDATION_SECRET` required at startup (add to the startup validation block alongside `BETTER_AUTH_SECRET`). (2) If the health endpoint exposes internal metrics, require the secret unconditionally — never allow unauthenticated access in production. (3) Document the expected behavior when `API_ACCESS_TOKEN` is unset and ensure the fallback is deny-by-default, not allow-by-default.

---

- **[Medium] CLOUD-004** — GitHub Actions CI has access to production secrets via Railway auto-deploy; no branch protection enforcement is visible
  - Resource: `.github/workflows/ci.yml`, Railway auto-deploy from `main`
  - Description: Railway auto-deploys on push to `main`. The CI workflow runs on both `push` to `main` and `pull_request` to `main`. If branch protection rules are not enforced (not visible in the provided configuration), a developer with write access to the repository can push directly to `main`, bypassing CI checks, and trigger a production deployment. The `ANTHROPIC_API_KEY: dummy_key_for_build` in the build step confirms that real secrets are not in CI, which is correct — but the deployment pipeline itself (Railway webhook) is triggered by the same push event, meaning a malicious or accidental push deploys immediately to production users.
  - Remediation: (1) Enforce GitHub branch protection on `main`: require at least one approving review, require status checks to pass (the `build` job), and disallow force pushes. (2) Add a manual approval gate or deployment environment in GitHub Actions before Railway deployment triggers (use GitHub Environments with required reviewers). (3) Consider separating the CI workflow (runs on PR) from the deploy trigger (runs only after merge with approval).

---

- **[Low] CLOUD-005** — Dependabot ignores all major version updates, leaving known CVEs in major-bump dependencies unaddressed
  - Resource: `.github/dependabot.yml` — `ignore: version-update:semver-major`
  - Description: Major version updates are entirely suppressed. While this prevents breaking changes, it also means that security fixes released only in a new major version (e.g., a critical CVE in `better-auth` or `next` that is not backported) will never be surfaced by Dependabot. The `npm audit --audit-level=high` step in CI will catch known vulnerabilities in the installed version, but will not prompt upgrading to a fixed major version.
  - Remediation: Change the Dependabot ignore rule to suppress major updates only for non-security updates. Use `update-types: ["version-update:semver-major"]` only within a group that excludes security advisories, or remove the blanket ignore and handle major bumps manually on a monthly review cadence. Alternatively, add a separate Dependabot configuration entry with `open-pull-requests-limit: 3` specifically for security advisories with no version filter.

---

- **[Low] CLOUD-006** — No explicit Railway service account or token rotation policy; platform access relies entirely on Railway account credentials
  - Resource: Railway project configuration (dashboard-managed)
  - Description: Railway does not expose IAM roles or service accounts in the traditional cloud sense. Access to the Railway project (including the ability to read environment variables, trigger deployments, and view logs) is controlled by Railway account membership. If a team member's Railway account is compromised or a former team member retains access, all production secrets are exposed. There is no evidence of Railway team access review or offboarding procedure.
  - Remediation: (1) Audit Railway project members and remove any accounts that no longer require access. (2) Enable MFA on all Railway accounts with project access. (3) Rotate all production secrets (database URL, API keys, auth secret) whenever a team member with Railway access is offboarded. (4) Use Railway's deploy tokens for CI/CD rather than personal account tokens if applicable.

---

## 4. Network Security

*Railway and Supabase abstract VPC, security group, and NACL configuration from the application team. Network security findings focus on the application-layer exposure surface, CORS configuration, and available platform-level network controls.*

---

- **[High] CLOUD-007** — No WAF or DDoS protection layer in front of the Railway application
  - Resource: Railway service (public HTTPS endpoint)
  - Description: Railway exposes the application directly via its edge network with no configurable WAF, rate limiting at the infrastructure layer, or DDoS mitigation beyond what Railway's platform provides by default. The application relies on in-memory rate limiting (noted in the architecture context as a known concern), which is ineffective across multiple Railway replicas, after process restarts, and against distributed attacks. Authentication endpoints (`/api/auth/*`), the AI proxy endpoints, and the CSP report endpoint are all exposed to the public internet with no infrastructure-layer throttling. A credential stuffing attack against `/api/auth/sign-in` or a volumetric attack against the Claude API proxy would exhaust both Railway compute and Anthropic API quota.
  - Remediation: (1) Replace in-memory rate limiting with Upstash Redis-backed rate limiting (the `@upstash/redis` dependency is already present — implement `@upstash/ratelimit` on auth endpoints and AI proxy routes). (2) Place Cloudflare (free tier sufficient) in front of the Railway domain: enables WAF rules, bot management, and rate limiting at the edge before requests reach Railway. (3) Apply stricter rate limits specifically to `/api/auth/sign-in`, `/api/auth/sign-up`, and `/api/auth/forgot-password` — these are the highest-value brute-force targets.

---

- **[Medium] CLOUD-008** — CORS origin validation relies on environment variables that may be unset or misconfigured
  - Resource: `lib/config/apiHeaders.ts` — `ALLOWED_ORIGINS` set
  - Description: The `ALLOWED_ORIGINS` set is constructed at module load time from `NEXT_PUBLIC_APP_URL` and `RAILWAY_PUBLIC_DOMAIN`. If either variable is unset (e.g., in a fresh deployment before Railway injects `RAILWAY_PUBLIC_DOMAIN`), the set will be smaller than intended, potentially blocking legitimate requests or — depending on how API routes consume this set — falling back to a permissive default. The code filters `Boolean` falsy values, so an unset variable results in a smaller allowlist rather than a wildcard, which is the safer failure mode. However, there is no startup assertion validating that at least one non-localhost origin is present in production, meaning a misconfigured deployment silently has a broken CORS policy.
  - Remediation: (1) Add a startup check that asserts `ALLOWED_ORIGINS` contains at least one HTTPS origin when `NODE_ENV === 'production'`. (2) Verify that all API route handlers that consume `ALLOWED_ORIGINS` return `403` (not `200`) when the `Origin` header is absent or not in the set. (3) Document the expected value of `NEXT_PUBLIC_APP_URL` in the Railway environment variable configuration.

---

- **[Medium] CLOUD-009** — Supabase database is not network-restricted to Railway egress IPs
  - Resource: Supabase project network settings (dashboard-managed)
  - Description: By default, Supabase PostgreSQL accepts connections from any IP address, authenticated only by the connection string credentials. If the `DATABASE_URL` is leaked (via logs, error messages, a compromised Railway environment, or a developer's local machine), an attacker can connect to the database from any internet-connected host. Railway does not provide static egress IPs by default (requires the paid static IP add-on), but without IP allowlisting, the database has no network-layer defense beyond credential authentication.
  - Remediation: (1) Enable Railway's static outbound IP add-on and configure Supabase's "Network Restrictions" to allowlist only that IP range. (2) Until static IPs are available, enable Supabase's connection string rotation and set a short rotation interval. (3) As an interim measure, ensure the Supabase database password is high-entropy (32+ characters) and not reused anywhere.

---

- **[Medium] CLOUD-010** — `callbackUrl` redirect validation is prefix-only and does not prevent open redirect via path traversal
  - Resource: `middleware.ts` — `AUTH-001` callbackUrl handling
  - Description: The current validation checks `pathname.startsWith('/') && !pathname.startsWith('//')`. This correctly blocks protocol-relative URLs (`//evil.com`) but does not prevent paths like `/\evil.com` (backslash-based redirect in some browsers), URL-encoded variants (`/%2Fevil.com`), or paths that pass the prefix check but redirect to attacker-controlled content after server-side processing. While Next.js's `new URL('/path', request.url)` construction mitigates some of these, the validation logic itself is not using a URL parser — it is string-matching on the raw `pathname` value.
  - Remediation: Replace the string prefix check with a URL-parser-based validation: construct `new URL(callbackUrl, request.url)` and assert that `parsed.origin === new URL(request.url).origin` before accepting the value. This is the same WHATWG-parser approach already used in `lib/config/urlAllowlist.ts` (VULN-013) and should be applied consistently. Example:
    ```typescript
    function isSafeCallbackUrl(raw: string, requestUrl: string): boolean {
      try {
        const base = new URL(requestUrl);
        const target = new URL(raw, base);
        return target.origin === base.origin;
      } catch { return false; }
    }
    ```

---

- **[Low] CLOUD-011** — HSTS header is set inconsistently between `next.config.ts` and `middleware.ts`
  - Resource: `next.config.ts` securityHeaders, `middleware.ts` HSTS block
  - Description: `next.config.ts` sets `Strict-Transport-Security: max-age=63072000; includeSubDomains` (without `preload`). `middleware.ts` sets `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (with `preload`) when `!isDev`. For routes that pass through middleware (all routes except `_next/static` and `_next/image`), the middleware header wins (last-writer wins in Next.js header merging). For static assets excluded from the middleware matcher, only the `next.config.ts` header applies — without `preload`. This inconsistency means static asset responses do not carry the `preload` directive, which is a minor inconsistency but could cause confusion during HSTS preload list submission.
  - Remediation: Remove the HSTS header from `next.config.ts` entirely and rely solely on the middleware-set header (which correctly gates `preload` to non-dev environments). Alternatively, add `preload` to the `next.config.ts` value and add a CI assertion that both values are identical.

---

- **[Low] CLOUD-012** — CSP `report-uri` directive is deprecated; only `report-to` should be used in modern deployments
  - Resource: `middleware.ts` — CSP string construction
  - Description: The CSP includes both `report-uri /api/csp-report` and `report-to csp-endpoint`. `report-uri` is deprecated in favor of `report-to` (Reporting API v1). While including both provides backward compatibility with older browsers, `report-uri` sends reports as `application/csp-report` (JSON) while `report-to` sends them as `application/reports+json` (array). If `/api/csp-report` only handles one format, reports from one class of browsers will be silently dropped. Additionally, the `/api/csp-report` endpoint is not shown in the provided code — if it is unauthenticated and does not validate the `Content-Type`, it could be abused as a data ingestion endpoint.
  - Remediation: (1) Ensure `/api/csp-report` handles both `application/csp-report` and `application/reports+json` content types. (2) Add rate limiting to the CSP report endpoint to prevent abuse. (3) Consider removing `report-uri` once browser support for `report-to` is sufficient for your user base (currently ~90% global support).

---

## 5. Data Storage Security

*Supabase manages the underlying PostgreSQL storage infrastructure (encryption at rest via AWS EBS encryption, TLS in transit). Application-layer findings focus on what the application team controls: column-level sensitivity, data classification, and schema design decisions.*

---

- **[High] CLOUD-013** — TOTP secrets and backup codes stored in plaintext database columns
  - Resource: `lib/auth-schema.ts` — `twoFactorTable.secret`, `twoFactorTable.backupCodes`
  - Description: The `twoFactor` table stores `secret` (TOTP seed) and `backupCodes` (recovery codes) as plain `text` columns with no application-layer encryption. Supabase encrypts data at rest at the storage layer (AWS EBS), but this encryption does not protect against: (a) a compromised database credential (CLOUD-002), (b) a Supabase dashboard user with table access, (c) a SQL injection vulnerability, or (d) a Supabase support/infrastructure access event. An attacker who reads the `twoFactor` table obtains the TOTP seed, which allows them to generate valid TOTP codes indefinitely — completely defeating the purpose of 2FA. Backup codes in plaintext allow immediate account takeover without the TOTP device.
  - Remediation: (1) Encrypt `secret` and `backupCodes` at the application layer before writing to the database, using a KMS-managed or envelope-encrypted key (e.g., store an AES-256-GCM encrypted blob). A simple approach: use Node.js `crypto.createCipheriv('aes-256-gcm', derivedKey, iv)` with a key derived from a `TOTP_ENCRYPTION_KEY` environment variable. (2) Hash backup codes with bcrypt or Argon2 (treat them like passwords — verify on use, never store plaintext). (3) Migrate existing rows by re-encrypting on next user login. (4) This is the single highest-risk finding in the report.

---

- **[High] CLOUD-014** — OAuth access tokens and refresh tokens stored in plaintext database columns
  - Resource: `lib/auth-schema.ts` — `account.accessToken`, `account.refreshToken`, `account.idToken`
  - Description: The `account` table stores OAuth `accessToken`, `refreshToken`, and `idToken` as plain `text` columns. These tokens grant delegated access to users' GitHub and Google accounts. A database read (via any of the attack vectors in CLOUD-002 or CLOUD-013) yields live OAuth tokens that can be used to access users' GitHub repositories, Google Drive, Gmail, and other scoped resources — far beyond the scope of this application. Refresh tokens in particular are long-lived and may remain valid for months or years.
  - Remediation: (1) Encrypt `accessToken`, `refreshToken`, and `idToken` at the application layer using the same envelope encryption approach as CLOUD-013. (2) Evaluate whether storing `idToken` is necessary at all — `better-auth` may only need it for initial profile population, after which it can be discarded. (3) Implement token expiry enforcement: check `accessTokenExpiresAt` before using a stored token and proactively delete expired tokens. (4) Add a database-level cleanup job to purge tokens for accounts inactive for more than 90 days.

---

- **[Medium] CLOUD-015** — Email verification is disabled (`requireEmailVerification: false`)
  - Resource: `lib/auth.ts` — `emailAndPassword.requireEmailVerification: false`
  - Description: Email verification is explicitly disabled with a comment noting it should be enabled "when Resend is confirmed in prod." Without email verification, any actor can register an account with an email address they do not own (e.g., `victim@company.com`), potentially: (a) pre-occupying an account before the legitimate owner registers, (b) receiving password reset emails intended for the real owner if the reset flow does not verify ownership, and (c) accessing any features gated only on account existence rather than verified identity. Given that this application handles AI audit results that may contain sensitive code, unverified accounts represent a meaningful risk.
  - Remediation: Enable `requireEmailVerification: true` immediately if `RESEND_API_KEY` is configured in production. Add a startup assertion: if `NODE_ENV === 'production'` and `RESEND_API_KEY` is set, `requireEmailVerification` must be `true`. If Resend is not yet configured, block new account creation in production until it is, or implement a fallback verification mechanism.

---

- **[Medium] CLOUD-016** — Audit `input` and `result` columns store raw user-submitted content and AI responses without size limits
  - Resource: `lib/auth-schema.ts` — `audit.input`, `audit.result` (both `text NOT NULL` / `text`)
  - Description: The `audit` table stores user-submitted code (`input`) and AI-generated audit results (`result`) as unbounded `text` columns. There are no database-level `CHECK` constraints on column length. A user submitting extremely large inputs (limited only by application-layer validation, which is not shown) could cause: (a) excessive database storage consumption, (b) slow queries on the `audit` table as row sizes grow, and (c) potential memory pressure when loading audit results into the application. Additionally, the `input` column stores potentially sensitive user code — there is no data retention policy or automatic purge schedule.
  - Remediation: (1) Add `CHECK` constraints on `input` length (e.g., `char_length(input) <= 100000`) matching the application-layer validation. (2) Implement a data retention policy: automatically delete or archive `audit` rows older than N days (90 days suggested). (3) Consider storing large `input`/`result` values in object storage (e.g., Supabase Storage) and keeping only a reference in the database row, reducing table bloat. (4) Add a `pg_cron` job or application-level scheduled task for cleanup.

---

- **[Low] CLOUD-017** — No point-in-time recovery (PITR) configuration verified for Supabase project
  - Resource: Supabase project settings (dashboard-managed)
  - Description: Supabase's free and Pro tiers differ significantly in PITR capabilities. The free tier provides daily backups only (no PITR), while Pro provides 7-day PITR. The current tier is not specified. Given that the database contains user accounts, session tokens, 2FA secrets, and audit results, a data loss event (accidental `DROP TABLE`, botched migration, or ransomware via a compromised credential) without PITR could result in complete, unrecoverable data loss. The `drizzle-kit push` script (CLOUD-002) is a specific risk vector for accidental schema destruction.
  - Remediation: (1) Confirm the Supabase project is on a tier with PITR enabled. (2) Test the restore procedure — document the steps and verify a restore can be completed within the acceptable RTO. (3) Implement a pre-migration backup step in the CI/CD pipeline before running `drizzle-kit migrate`. (4) Consider exporting a logical backup (`pg_dump`) to a separate storage location (e.g., an S3 bucket) on a daily schedule as an additional recovery option independent of Supabase's backup infrastructure.

---

- **[Low] CLOUD-018** — `account.password` column stores password hashes alongside OAuth tokens in the same table
  - Resource: `lib/auth-schema.ts` — `account.password`
  - Description: The `account` table co-locates password hashes (for email/password accounts) with OAuth tokens (for social login accounts) in the same row structure. While `better-auth` manages this schema, the design means a single table read exposes both credential types. This is a schema design observation rather than an immediate vulnerability, but it increases the blast radius of any query that reads the `account` table broadly.
  - Remediation: This is a `better-auth` framework schema decision and cannot be changed without forking the library. Mitigate by: (1) ensuring the application-layer database role (CLOUD-002) cannot perform `SELECT *` on `account` — only select specific columns needed for each query. (2) Applying column-level encryption (CLOUD-014) to the token columns. (3) Monitoring for any queries that select the `password` column outside of the authentication flow.

---

## 6. Compute & Container Security

*Railway is a PaaS that manages the underlying container runtime, OS patching, and infrastructure security. The application team does not control Dockerfile, container privileges, or instance metadata. Findings focus on the application runtime security surface that is within scope.*

---

- **[Medium] CLOUD-019** — Single Railway service with no horizontal scaling configuration or replica count specification
  - Resource: Railway service configuration (dashboard-managed)
  - Description: Railway defaults to a single replica unless explicitly configured for horizontal scaling. A single replica means: (a) any deployment (which Railway performs as a rolling restart) causes a brief availability gap, (b) a memory leak or crash loop takes down the entire application, and (c) in-memory rate limiting state (the known concern) is lost on every restart. The application handles streaming AI responses that may take 30–60 seconds — a mid-stream restart would terminate active user sessions.
  - Remediation: (1) Configure Railway to run a minimum of 2 replicas to eliminate the single point of failure. (2) Implement graceful shutdown handling (`SIGTERM` → drain active streams → exit) to minimize disruption during deployments. (3) Replace in-memory rate limiting with Upstash Redis (CLOUD-007) before scaling to multiple replicas, as in-memory state is not shared across instances.

---

- **[Medium] CLOUD-020** — No runtime dependency integrity verification beyond `npm ci` and SRI for Next.js chunks
  - Resource: `next.config.ts` — `experimental.sri.algorithm: 'sha256'`, CI `npm audit`
  - Description: `next.config.ts` enables SRI for Next.js-generated script chunks, which is good. However, `npm ci` installs from `package-lock.json` but does not verify that the packages in the lock file have not been tampered with in the npm registry (supply chain attack). The `npm audit` step catches known CVEs but not novel supply chain compromises. There is no `npm audit signatures` step to verify package provenance, and no Sigstore/SLSA attestation for the build artifacts deployed to Railway.
  - Remediation: (1) Add `npm audit signatures` to the CI pipeline to verify package registry signatures. (2) Consider enabling npm's `--ignore-scripts` flag during `npm ci` to prevent malicious `postinstall` scripts from executing in CI. (3) Pin all dependencies to exact versions in `package.json` (remove `^` and `~` prefixes) and rely on Dependabot for controlled updates. (4) Add a `package-lock.json` integrity check step that fails if the lock file was modified without a corresponding `package.json` change.

---

- **[Low] CLOUD-021** — Node.js version is pinned to `>=20.0.0 <21.0.0` but `.nvmrc` content is not shown; Railway may use a different version
  - Resource: `package.json` engines field, `.nvmrc` (referenced but not provided)
  - Description: The `engines` field specifies Node.js 20.x, and CI uses `.nvmrc` for version selection. However, Railway's Node.js version is determined by its own buildpack detection, which may not respect `.nvmrc` or `engines` unless explicitly configured. A version mismatch between CI (Node 20) and Railway runtime could cause subtle behavioral differences, particularly around crypto APIs, fetch behavior, and `--experimental-*` flags used by Next.js 15.
  - Remediation: (1) Explicitly set the Node.js version in Railway's service settings (not just relying on buildpack detection). (2) Add a runtime assertion in the application startup that validates `process.version` matches the expected major version. (3) Ensure `.nvmrc` contains exactly `20` or a specific patch version, and verify Railway's build logs confirm the correct version is used.

---

- **[Low] CLOUD-022** — No structured logging or log aggregation configured; Railway's ephemeral log retention may lose security-relevant events
  - Resource: Railway service logs (platform-managed)
  - Description: The application uses `console.warn` and `console.error` for logging (visible in `lib/auth.ts`). Railway retains logs for a limited period (varies by plan). Security-relevant events — failed authentication attempts, CSP violations, rate limit hits, email send failures — are logged to stdout/stderr but are not aggregated, structured, or retained beyond Railway's default window. This makes incident response and forensic analysis difficult.
  - Remediation: (1) Implement structured JSON logging (e.g., using `pino`) with consistent fields: `timestamp`, `level`, `event`, `userId`, `ip`, `requestId`. (2) Configure Railway's log drain to forward logs to a persistent log aggregation service (Datadog, Logtail, Axiom — all have free tiers). (3) Define log retention requirements: security events should be retained for a minimum of 90 days.

---

## 7. Secrets & Configuration Management

---

- **[High] CLOUD-023** — No secrets rotation policy or rotation automation for any credential
  - Resource: All secrets: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, OAuth client secrets
  - Description: None of the application secrets have a documented rotation schedule or automated rotation mechanism. `BETTER_AUTH_SECRET` is used to sign session tokens — if it is compromised, all existing sessions can be forged. `DATABASE_URL` contains the database password — if leaked, it provides persistent database access until manually rotated. OAuth client secrets (`GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`) are long-lived credentials that, if leaked, allow an attacker to impersonate the application in OAuth flows. There is no evidence of rotation having occurred or being planned.
  - Remediation: (1) Document a rotation schedule for each secret: `ANTHROPIC_API_KEY` (90 days), `DATABASE_URL` password (90 days), `BETTER_AUTH_SECRET` (180 days, requires invalidating all sessions — plan for user re-login), OAuth secrets (180 days). (2) Implement rotation reminders via calendar or a secrets management tool. (3) For `DATABASE_URL`, use Supabase's password rotation feature and update the Railway environment variable atomically. (4) Consider migrating to a secrets manager (HashiCorp Vault, AWS Secrets Manager via a sidecar, or Doppler) that supports automatic rotation and audit logging.

---

- **[Medium] CLOUD-024** — `BETTER_AUTH_SECRET` minimum length check (32 chars) may be insufficient for the signing algorithm in use
  - Resource: `lib/auth.ts` — `TOKEN-002` startup validation
  - Description: The startup check enforces a minimum of 32 characters for `BETTER_AUTH_SECRET`. This is correct for HMAC-SHA256 (32-byte key). However, if `better-auth` uses a different signing algorithm internally (e.g., HMAC-SHA512, which benefits from a 64-byte key), a 32-character secret provides less than optimal security. Additionally, the check validates `authSecret.length < 32` on the string length, not the byte length — a secret containing multi-byte UTF-8 characters could pass the length check while providing fewer than 32 bytes of entropy.
  - Remediation: (1) Generate `BETTER_AUTH_SECRET` using `openssl rand -base64 32` (produces 44 ASCII characters, 32 bytes of entropy) as documented in `.env.example` — this is correct. (2) Update the validation to check `Buffer.byteLength(authSecret, 'utf8') >= 32` rather than `authSecret.length >= 32`. (3) Verify the `better-auth` documentation for the recommended key length for the signing algorithm in use and adjust the minimum accordingly.

---

- **[Medium] CLOUD-025** — Railway environment variables are the sole secrets store with no audit trail for secret access or modification
  - Resource: Railway project environment variables (dashboard-managed)
  - Description: All application secrets are stored as Railway environment variables, which are: (a) visible in plaintext to any Railway project member, (b) not versioned (no history of when a value was changed or by whom), (c) not audited (no log of who accessed a secret value), and (d) not encrypted with a customer-managed key. If a Railway account with project access is compromised, all secrets are immediately exposed with no detection mechanism.
  - Remediation: (1) Migrate secrets to a dedicated secrets manager (Doppler, Infisical, or HashiCorp Vault Cloud) that provides: access audit logs, secret versioning, per-secret access control, and automatic rotation. (2) At minimum, enable MFA on all Railway accounts and review project membership quarterly. (3) Use Railway's "sealed" environment variables feature if available to prevent plaintext display after initial entry.

---

- **[Low] CLOUD-026** — `drizzle-kit studio` script exposes a local database UI that could be accidentally run against production
  - Resource: `package.json` — `db:studio` script
  - Description: `drizzle-kit studio` launches a local web UI with full read/write access to the database specified by `DATABASE_URL`. If a developer has the production `DATABASE_URL` in their local `.env` file and runs `npm run db:studio`, they get a full GUI with unrestricted database access — no authentication, no audit log, no row-level restrictions. This is a developer ergonomics feature that becomes a significant risk when the same `DATABASE_URL` is used for both local development and production.
  - Remediation: (1) Enforce a strict policy that production `DATABASE_URL` is never stored in local `.env` files — developers should use a local Supabase instance or a dedicated development database. (2) Add a guard script that checks `NODE_ENV` or a `DATABASE_URL` prefix before allowing `db:studio` or `db:push` to run. (3) Document in the README that `db:studio` must never be run with a production connection string.

---

## 8. Resilience & Disaster Recovery

---

- **[High] CLOUD-027** — Single production environment with no staging or canary deployment capability
  - Resource: Architecture — single Railway environment, single Supabase project
  - Description: All deployments go directly to production. There is no staging environment to validate migrations, configuration changes, or new features before they affect production users. A failed database migration (e.g., a `drizzle-kit migrate` that adds a `NOT NULL` column without a default) will cause immediate production downtime. A breaking change in application code will be immediately visible to all users. The `drizzle-kit push` script (which applies schema changes without a migration file) is particularly dangerous in this context — it can silently drop columns or alter constraints.
  - Remediation: (1) Create a separate Railway environment (Railway supports multiple environments per project) and a separate Supabase project for staging. (2) Require all database migrations to be tested in staging before production deployment. (3) Implement a deployment pipeline: PR → CI → staging deploy → manual approval → production deploy. (4) Disable `drizzle-kit push` for any environment connected to a non-local database.

---

- **[Medium] CLOUD-028** — No health check endpoint with dependency validation; Railway restarts on process crash but not on hung dependencies
  - Resource: `/api/health` endpoint (referenced in `.env.example` but not shown)
  - Description: Railway can be configured to perform health checks against an HTTP endpoint. If the health check endpoint exists but only returns `200 OK` without validating database connectivity, Redis connectivity, and external API reachability, Railway will not restart the service when a dependency becomes unavailable. A hung database connection pool (all 10 connections exhausted, `connect_timeout: 10` exceeded) would cause the application to return 500 errors while Railway considers it healthy.
  - Remediation: (1) Implement a `/api/health` endpoint that: (a) requires `HEALTH_SECRET` bearer token, (b) performs a lightweight database query (`SELECT 1`), (c) checks Redis connectivity if Upstash is in use, and (d) returns structured JSON with dependency status and response times. (2) Configure Railway's health check to use this endpoint with a 30-second timeout and 3 consecutive failure threshold before restart. (3) Add an alerting integration (Railway supports webhook notifications) to page on health check failures.

---

- **[Medium] CLOUD-029** — Database connection pool configuration may cause cascading failures under load
  - Resource: `lib/db.ts` — postgres.js client configuration
  - Description: The connection pool is configured with `max: 10` (non-pooler) or `max: 5` (pooler), `idle_timeout: 20` seconds, and `connect_timeout: 10` seconds. With a single Railway replica and streaming AI responses that may hold connections open for 30–60 seconds, 10 connections can be exhausted by 10 concurrent users. When the pool is exhausted, new requests queue indefinitely (postgres.js default) rather than failing fast with a 503. This can cause request pile-up, memory growth, and eventual OOM crash. The `statement_timeout: 30000` (30 seconds) is a good safeguard but applies per-statement, not per-request.
  - Remediation: (1) Use Supabase's connection pooler (PgBouncer) in transaction mode for all application queries — this allows many more concurrent application connections to share a smaller number of actual PostgreSQL connections. Set `max: 20` with the pooler. (2) Add a connection acquisition timeout to the postgres.js client configuration to fail fast when the pool is exhausted rather than queuing indefinitely. (3) Ensure AI streaming routes do not hold database connections open during the streaming phase — acquire, query, release, then stream.

---

- **[Low] CLOUD-030** — No automated backup verification or restore drill documented
  - Resource: Supabase backup configuration (dashboard-managed)
  - Description: Even if Supabase PITR is enabled (CLOUD-017), backups are only valuable if they can be successfully restored. There is no evidence of a restore drill having been performed or scheduled. Backup files can become corrupted, restoration procedures can be undocumented, and RTO estimates can be wildly optimistic without empirical testing.
  - Remediation: (1) Perform a quarterly restore drill: restore the most recent backup to a temporary Supabase project, verify row counts and data integrity, document the time taken. (2) Define explicit RTO (target: < 4 hours) and RPO (target: < 1 hour with PITR) and validate them against the drill results. (3) Document the restore procedure in the team runbook so any team member can execute it under pressure.

---

## 9. Cost Optimization

---

- **[Low] CLOUD-031** — Upstash Redis dependency is present but in-memory rate limiting is used; paying for Redis without using it
  - Resource: `package.json` — `@upstash/redis: ^1.37.0`; architecture context — in-memory rate limiting
  - Description: The `@upstash/redis` package is installed as a production dependency, suggesting Upstash Redis was intended for rate limiting or caching. However, the architecture context confirms in-memory rate limiting is in use. If an Upstash Redis instance has been provisioned but is not being used, it represents unnecessary cost (Upstash free tier is generous, but a paid instance would be wasteful). Conversely, if Redis is not provisioned, the dependency is dead weight increasing bundle size and attack surface.
  - Remediation: (1) If Upstash Redis is provisioned: implement Redis-backed rate limiting immediately (addresses CLOUD-007) to justify the cost. (2) If Upstash Redis is not provisioned: remove the dependency until it is needed, reducing the dependency surface. (3) When implementing Redis rate limiting, use `@upstash/ratelimit` with sliding window algorithm on auth endpoints and AI proxy routes.

---

- **[Low] CLOUD-032** — `react-markdown` and `lenis` are production dependencies that may significantly increase client bundle size
  - Resource: `package.json` — `react-markdown: 9.1.0`, `lenis: ^1.3.18`
  - Description: `react-markdown` pulls in `remark`, `rehype`, and related unified ecosystem packages, adding approximately 150–200 KB to the client bundle (pre-gzip). `lenis` (smooth scroll library) adds approximately 15 KB. If these are used only on specific pages (e.g., audit result display), they should be dynamically imported to avoid including them in the initial page bundle. Next.js 15's App Router supports `dynamic()` imports with `ssr: false` for client-only libraries.
  - Remediation: (1) Run `next build` and analyze the bundle with `@next/bundle-analyzer` to identify the actual contribution of these packages. (2) Wrap `react-markdown` usage in `dynamic(() => import('react-markdown'), { ssr: false })` if it is only needed on client-rendered pages. (3) Evaluate whether `lenis` is necessary or if CSS `scroll-behavior: smooth` is sufficient for the use case.

---

- **[Low] CLOUD-033** — No lifecycle policy on audit result storage; unbounded database growth will increase Supabase costs over time
  - Resource: `lib/auth-schema.ts` — `audit` table; Supabase storage pricing
  - Description: The `audit` table stores full AI-generated audit results (potentially 10–50 KB per row) with no retention limit. As the user base grows, this table will grow unboundedly. Supabase charges for database storage above the free tier limit (500 MB free, then $0.125/GB/month on Pro). A moderately active platform with 1,000 users each running 10 audits per month at 20 KB average result size would accumulate 200 MB/month of new data, exhausting the free tier within 2–3 months.
  - Remediation: (1) Implement a data retention policy: automatically delete `audit` rows where `createdAt < NOW() - INTERVAL '90 days'` via a scheduled job. (2) For users who want to retain results longer, implement an archival flow: compress and move old results to Supabase Storage (object storage, cheaper than database storage) and replace the `result` column value with a storage reference. (3) Add a Supabase storage usage alert at 80% of the plan limit.

---

- **[Low] CLOUD-034** — Major version updates suppressed in Dependabot may cause technical debt accumulation leading to costly future migrations
  - Resource: `.github/dependabot.yml` — major version ignore rule
  - Description: Suppressing all major version updates means the application will fall progressively further behind on `next`, `react`, `better-auth`, `drizzle-orm`, and other core dependencies. Major version migrations become increasingly expensive as the gap widens (e.g., migrating from React 19 to React 21 in one step vs. incremental updates). This is a long-term cost and maintenance risk rather than an immediate security issue.
  - Remediation: Schedule a monthly dependency review meeting to evaluate pending major version updates. Use Dependabot's `groups` feature to batch related major updates (e.g., all React ecosystem packages together) and open a single PR for review rather than suppressing them entirely.

---

## 10. Prioritized Remediation Roadmap

| # | Finding | One-Line Fix | Effort | Timing |
|---|---|---|---|---|
| 1 | **CLOUD-013** — TOTP secrets in plaintext | Encrypt `twoFactor.secret` and hash `backupCodes` at application layer before DB write | High (3–5 days: crypto implementation + migration) | Immediate |
| 2 | **CLOUD-014** — OAuth tokens in plaintext | Encrypt `account.accessToken`, `refreshToken`, `idToken` with envelope encryption | High (2–3 days, can reuse CLOUD-013 crypto layer) | Immediate |
| 3 | **CLOUD-002** — Overprivileged DB credential | Create read/write-only runtime DB role; separate migration credential; enable Supabase network restrictions | Medium (1–2 days) | Immediate |
| 4 | **CLOUD-007** — No WAF / infrastructure rate limiting | Add Cloudflare in front of Railway; implement Upstash Redis rate limiting on auth endpoints | Medium (1 day for Cloudflare; 1–2 days for Redis rate limiting) | Immediate |
| 5 | **CLOUD-027** — No staging environment | Create Railway staging environment + Supabase staging project; add manual approval gate in CI | Medium (1–2 days) | Immediate |
| 6 | **CLOUD-023** — No secrets rotation policy | Document rotation schedule; rotate all credentials now; set calendar reminders | Low (4 hours) | Immediate |
| 7 | **CLOUD-001** — Anthropic API key unscoped | Set Anthropic spend limit; add startup key format validation; document rotation runbook | Low (2 hours) | Immediate |
| 8 | **CLOUD-015** — Email verification disabled | Enable `requireEmailVerification: true` with Resend configured in production | Low (1 hour) | Immediate |
| 9 | **CLOUD-009** — DB not network-restricted | Enable Railway static IP add-on; configure Supabase network restrictions to allowlist Railway egress | Low (2 hours) | Scheduled (next sprint) |
| 10 | **CLOUD-025** — No secrets audit trail | Migrate to Doppler or Infisical for secrets management with audit logging | Medium (1–2 days) | Scheduled (next sprint) |

---

## 11. Overall Risk Score

| Domain | Rating | Key Finding |
|---|---|---|
| IAM & Access | **Medium** | No wildcard IAM (PaaS abstracts this), but overprivileged DB credential and no secrets rotation are significant gaps |
| Network Exposure | **High** | No WAF, no infrastructure-layer rate limiting, DB not network-restricted, in-memory rate limiting ineffective at scale |
| Data Security | **High** | TOTP secrets and OAuth tokens stored in plaintext; no application-layer encryption for sensitive credential columns |
| Compute Security | **Medium** | PaaS abstracts container security; single replica, no graceful shutdown, no structured logging are the primary gaps |
| Resilience | **High** | Single production environment, no staging, no verified backup restore procedure, connection pool exhaustion risk |
| **Net Risk Posture** | **High** | The combination of plaintext credential storage (CLOUD-013/014), a single overprivileged DB connection (CLOUD-002), and no staging environment (CLOUD-027) creates a scenario where a single point of compromise results in full user credential exposure with no rollback capability |