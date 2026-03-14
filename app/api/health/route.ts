// ARCH-021: Lightweight health check for uptime monitors and deployment readiness.
// Does NOT call the Anthropic API — just verifies the key is configured.
export const runtime = 'nodejs';

export function GET() {
  const apiKeyPresent = !!process.env.ANTHROPIC_API_KEY;

  if (!apiKeyPresent) {
    return Response.json(
      { status: 'error', reason: 'ANTHROPIC_API_KEY not configured' },
      { status: 503 },
    );
  }

  return Response.json({
    status: 'ok',
    version: process.env.npm_package_version ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
}
