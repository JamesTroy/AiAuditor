// ARCH-021: Lightweight health check for uptime monitors and deployment readiness.
// VULN-008: Returns only liveness status — no version or config details exposed
// to unauthenticated callers (version aids CVE targeting; API key presence
// confirms the application's dependency on Anthropic).
export const runtime = 'nodejs';

export function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Log internally but do not expose the reason to unauthenticated callers.
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', event: 'health_check_failed', reason: 'ANTHROPIC_API_KEY not configured' }));
    return new Response(null, { status: 503 });
  }

  return Response.json({ status: 'ok' });
}
