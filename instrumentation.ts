// CLOUD-008/010/022: Production environment validation.
// Note: On Railway, env vars may not be available during Next.js register()
// but ARE available at request time. Security is enforced at point of use
// (middleware, auth checks, API route guards), not here.

export async function register() {
  // Intentionally empty — startup assertions removed because Railway injects
  // env vars after the Node process starts, causing false-positive warnings.
  // All security-critical env var checks are performed at the point of use:
  //   - BETTER_AUTH_SECRET → lib/auth.ts
  //   - HEALTH_SECRET → app/api/health/db/route.ts
  //   - REVALIDATION_SECRET → app/api/admin/*/route.ts
  //   - API_ACCESS_TOKEN → middleware.ts
  //   - TOTP_ENCRYPTION_KEY → lib/crypto.ts
  //   - NEXT_PUBLIC_APP_URL → middleware.ts (CORS)
}
