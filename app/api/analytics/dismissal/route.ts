import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentDismissalStats } from '@/lib/auth-schema';
import { sql } from 'drizzle-orm';
import { VALID_AGENT_TYPES } from '@/lib/schemas/auditRequest';
import { RateLimiter } from '@/lib/rateLimit';

// Analytics-specific limiter: 60 events per minute per IP.
// Generous enough for normal use (a user dismissing many findings in one session),
// tight enough to prevent flooding the stats table.
const analyticsLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
  prefix: 'analytics-dismissal',
});

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'informational']);
const VALID_CONFIDENCES = new Set(['certain', 'likely', 'possible']);
const VALID_ACTIONS     = new Set(['dismiss', 'restore']);
const VALID_AGENT_SET   = new Set<string>(VALID_AGENT_TYPES);

// Also accept custom agent IDs (uuid-like strings) — custom audits are valid signal too.
const CUSTOM_AGENT_RE = /^[a-z0-9_-]{1,80}$/;

function isValidAgentId(id: string): boolean {
  return VALID_AGENT_SET.has(id) || CUSTOM_AGENT_RE.test(id);
}

/**
 * POST /api/analytics/dismissal
 *
 * Fire-and-forget endpoint — always returns 200 to the client so the dismiss
 * action is never blocked by analytics failures.
 *
 * Body: { agentId, agentName, severity, confidence, action }
 *   action: 'dismiss' | 'restore'
 *
 * No auth required — anonymous dismissals carry equally useful signal.
 * Validated against known agent IDs and enum values to prevent junk data.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate-limit by IP — fail open (allow if IP can't be determined)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (ip !== 'unknown') {
    const rl = await analyticsLimiter.check(ip);
    if (!rl.allowed) {
      // Return 200 anyway — client doesn't retry analytics events
      return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 200 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const { agentId, agentName, severity, confidence, action } = body as Record<string, unknown>;

  // Validate — reject silently (200) so bad clients can't probe the schema
  if (
    typeof agentId !== 'string' || !isValidAgentId(agentId) ||
    typeof agentName !== 'string' || agentName.length > 120 ||
    typeof severity !== 'string' || !VALID_SEVERITIES.has(severity) ||
    typeof action !== 'string' || !VALID_ACTIONS.has(action)
  ) {
    return NextResponse.json({ ok: false, reason: 'invalid_input' }, { status: 200 });
  }

  const isDismiss = action === 'dismiss';

  // Build the column increments based on severity and confidence
  const severityCol = {
    critical:      'dismissals_critical',
    high:          'dismissals_high',
    medium:        'dismissals_medium',
    low:           'dismissals_low',
    informational: null,               // informational findings aren't severity-tracked
  }[severity as string] ?? null;

  const confidenceCol = (
    typeof confidence === 'string' && VALID_CONFIDENCES.has(confidence)
      ? { certain: 'dismissals_certain', likely: 'dismissals_likely', possible: null }[confidence] ?? null
      : null
  );

  try {
    const delta = isDismiss ? 1 : -1;

    // UPSERT: insert on first dismissal for this agent, increment on subsequent ones.
    // Use raw SQL expressions so Drizzle doesn't try to "set x = $1" with a static value.
    await db
      .insert(agentDismissalStats)
      .values({
        agentId,
        agentName: agentName.trim(),
        dismissals:   isDismiss ? 1 : 0,
        restorations: isDismiss ? 0 : 1,
        dismissalsCritical: severityCol === 'dismissals_critical' && isDismiss ? 1 : 0,
        dismissalsHigh:     severityCol === 'dismissals_high'     && isDismiss ? 1 : 0,
        dismissalsMedium:   severityCol === 'dismissals_medium'   && isDismiss ? 1 : 0,
        dismissalsLow:      severityCol === 'dismissals_low'      && isDismiss ? 1 : 0,
        dismissalsCertain:  confidenceCol === 'dismissals_certain' && isDismiss ? 1 : 0,
        dismissalsLikely:   confidenceCol === 'dismissals_likely'  && isDismiss ? 1 : 0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: agentDismissalStats.agentId,
        set: {
          // Clamp at 0 — restorations should never push a counter negative
          dismissals:   sql`GREATEST(0, ${agentDismissalStats.dismissals} + ${delta})`,
          restorations: isDismiss
            ? agentDismissalStats.restorations
            : sql`${agentDismissalStats.restorations} + 1`,
          ...(severityCol === 'dismissals_critical' && {
            dismissalsCritical: sql`GREATEST(0, ${agentDismissalStats.dismissalsCritical} + ${delta})`,
          }),
          ...(severityCol === 'dismissals_high' && {
            dismissalsHigh: sql`GREATEST(0, ${agentDismissalStats.dismissalsHigh} + ${delta})`,
          }),
          ...(severityCol === 'dismissals_medium' && {
            dismissalsMedium: sql`GREATEST(0, ${agentDismissalStats.dismissalsMedium} + ${delta})`,
          }),
          ...(severityCol === 'dismissals_low' && {
            dismissalsLow: sql`GREATEST(0, ${agentDismissalStats.dismissalsLow} + ${delta})`,
          }),
          ...(confidenceCol === 'dismissals_certain' && {
            dismissalsCertain: sql`GREATEST(0, ${agentDismissalStats.dismissalsCertain} + ${delta})`,
          }),
          ...(confidenceCol === 'dismissals_likely' && {
            dismissalsLikely: sql`GREATEST(0, ${agentDismissalStats.dismissalsLikely} + ${delta})`,
          }),
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    // Log but never propagate — analytics must never break the dismiss UX
    console.error(JSON.stringify({
      ts: new Date().toISOString(), level: 'error',
      event: 'dismissal_analytics_failed',
      error: err instanceof Error ? err.message : String(err),
    }));
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
