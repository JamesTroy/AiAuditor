import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agentDismissalStats, audit as auditTable } from '@/lib/auth-schema';
import { fpRatesLimiter } from '@/lib/rateLimit';
import { VALID_AGENT_TYPES } from '@/lib/schemas/auditRequest';
import {
  MIN_LIKELY_DISMISSALS,
  LIKELY_FP_RATE_THRESHOLD,
  MIN_AUDITS_FOR_TRUST,
} from '@/lib/config/fpThresholds';

export interface AgentFpRate {
  agentId: string;
  likelyDismissals: number;
  totalDismissals: number;
  likelyFpRate: number;
  /** True when the agent crosses both the minimum sample and rate thresholds. */
  highLikelyFpRate: boolean;
}

export interface FpRatesResponse {
  /** Agents with enough dismissal data to compute a real FP rate. */
  rates: AgentFpRate[];
  /** Agents below MIN_AUDITS_FOR_TRUST — hide [LIKELY] until data accumulates. */
  coldStartAgentIds: string[];
}

/**
 * GET /api/agents/fp-rates
 *
 * Returns per-agent [LIKELY] false-positive rates derived from dismissal
 * analytics. Only agents with ≥5 [LIKELY] dismissals are returned —
 * below that sample size the signal is too noisy to act on.
 *
 * Used by AuditResultView to decide whether to auto-downgrade [LIKELY]
 * findings to [POSSIBLE] for high-FP agents.
 *
 * No auth required — this is aggregate, non-personal data.
 * Cached for 5 minutes so every audit page load doesn't hit the DB.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // ARCH-REVIEW-002: Rate limit fp-rates endpoint.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = await fpRatesLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { rates: [], coldStartAgentIds: [] } satisfies FpRatesResponse,
      { status: 429, headers: rl.headers },
    );
  }

  try {
    const [dismissalRows, auditCountRows] = await Promise.all([
      db
        .select({
          agentId: agentDismissalStats.agentId,
          dismissalsLikely: agentDismissalStats.dismissalsLikely,
          dismissals: agentDismissalStats.dismissals,
        })
        .from(agentDismissalStats),
      // FP-COLD-START: per-agent audit counts to detect "no data yet" agents.
      db
        .select({
          agentId: auditTable.agentId,
          count: sql<number>`count(*)::int`.as('count'),
        })
        .from(auditTable)
        .groupBy(auditTable.agentId),
    ]);

    const rates: AgentFpRate[] = dismissalRows
      .filter((r) => r.dismissalsLikely >= MIN_LIKELY_DISMISSALS)
      .map((r) => {
        const likelyFpRate = r.dismissals > 0
          ? r.dismissalsLikely / r.dismissals
          : 0;
        return {
          agentId: r.agentId,
          likelyDismissals: r.dismissalsLikely,
          totalDismissals: r.dismissals,
          likelyFpRate: Math.round(likelyFpRate * 1000) / 1000,
          highLikelyFpRate: likelyFpRate >= LIKELY_FP_RATE_THRESHOLD,
        };
      });

    // FP-COLD-START: An agent is cold-start when its audit count is below
    // MIN_AUDITS_FOR_TRUST. Agents that have never run (no row in auditTable)
    // are implicitly cold-start with count 0.
    const auditCountMap = new Map<string, number>(
      auditCountRows.map((r) => [r.agentId, r.count]),
    );
    const coldStartAgentIds = VALID_AGENT_TYPES.filter(
      (id) => (auditCountMap.get(id) ?? 0) < MIN_AUDITS_FOR_TRUST,
    );

    return NextResponse.json(
      { rates, coldStartAgentIds } satisfies FpRatesResponse,
      {
        status: 200,
        headers: {
          // Cache for 5 minutes — stale-while-revalidate so page loads are fast
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        },
      },
    );
  } catch (err) {
    // Non-fatal — callers degrade gracefully when this fails
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      event: 'fp_rates_fetch_failed',
      error: err instanceof Error ? err.message : String(err),
    }));
    return NextResponse.json(
      { rates: [], coldStartAgentIds: [] } satisfies FpRatesResponse,
      { status: 200 },
    );
  }
}
