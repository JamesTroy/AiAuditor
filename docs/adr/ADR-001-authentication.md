# ADR-001: Authentication Strategy

**Status:** Accepted
**Date:** 2026-03-14

## Context

The application proxies requests to the Anthropic API. An unauthenticated endpoint means any
visitor can trigger API calls billed to the operator.

## Decision

**No user-facing authentication is implemented.** Instead, abuse is mitigated by:

1. **Rate limiting** — 10 requests per IP per minute (`lib/rateLimit.ts`). See ARCH-001 for
   the known limitation: the counter is process-scoped and can be bypassed in multi-instance
   deployments. Replace with Redis/Upstash before exposing to untrusted traffic at scale.

2. **Input size caps** — 30,000 chars per request (`lib/schemas/auditRequest.ts`) to bound
   per-request cost.

3. **Deployment model** — The intended deployment is a personal or team tool behind an
   existing access layer (Vercel password protection, corporate SSO, or VPN). It is not
   designed to be a public, unauthenticated service.

## Consequences

- **No auth = no user accounts, no session management** — simplifies the architecture and
  eliminates a class of auth-related vulnerabilities.

- **Operator responsibility** — The operator must configure access control at the hosting
  layer before making the app publicly reachable.

- **Upgrade path** — If public access is required, add NextAuth.js (or similar) before
  removing the hosting-layer access control. The API route already centralises all Anthropic
  calls, so adding an auth check there is a one-file change.

## Alternatives Considered

| Option | Why rejected |
|---|---|
| API key in client | Exposes key to anyone who inspects the page |
| NextAuth with credentials | Adds DB dependency for a tool meant to run stateless |
| Hosting-layer auth only | **Selected** — lowest complexity for the target use case |
