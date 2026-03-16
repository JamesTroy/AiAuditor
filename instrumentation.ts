// CLOUD-008/010/022: Production startup assertions.
// Next.js calls this file at server startup (before any request is handled).
// Throwing here causes Railway to mark the deployment as failed, preventing
// traffic from reaching an application with degraded security.

export async function register() {
  if (process.env.NODE_ENV !== 'production') return;

  // Next.js calls register() during `next build` as well as server startup.
  // Skip assertions during build — secrets are only available at runtime.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  // CLOUD-008: Security secrets that gate access controls must be set in production.
  // If absent, their respective checks are silently bypassed — an insecure default.
  const requiredSecrets = [
    'BETTER_AUTH_SECRET',
    'HEALTH_SECRET',
    'REVALIDATION_SECRET',
    'API_ACCESS_TOKEN',
  ];

  for (const key of requiredSecrets) {
    if (!process.env[key]) {
      throw new Error(
        `[FATAL] Required secret ${key} is not set in production. Refusing to start. ` +
        `Add it to Railway environment variables.`,
      );
    }
  }

  // CLOUD-022: NEXT_PUBLIC_APP_URL must be set for CORS origin validation.
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error(
      '[FATAL] NEXT_PUBLIC_APP_URL is not set in production. ' +
      'CORS origin validation will silently fail. Refusing to start.',
    );
  }

  // CLOUD-001: Encryption key for sensitive DB columns.
  if (!process.env.TOTP_ENCRYPTION_KEY) {
    throw new Error(
      '[FATAL] TOTP_ENCRYPTION_KEY is not set in production. ' +
      'TOTP secrets and OAuth tokens will be stored in plaintext. ' +
      'Generate with: openssl rand -hex 32',
    );
  }

  // CLOUD-010: Email sending capability required for password reset and verification.
  if (!process.env.RESEND_API_KEY) {
    console.error(
      '[WARN] RESEND_API_KEY is not set in production. ' +
      'Password reset, email verification, and 2FA OTP emails will not function.',
    );
  }

  // CLOUD-019: Redis required for cross-replica rate limiting.
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error(
      '[WARN] Upstash Redis credentials not set. Rate limiting will use in-memory store ' +
      '(ineffective across replicas). Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
    );
  }
}
