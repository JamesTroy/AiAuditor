import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentDismissalStats } from '@/lib/auth-schema';

// Minimum [LIKELY] dismissals before we trust the signal.
// Below this sample size the rate is too noisy to act on.
const MIN_LIKELY_DISMISSALS = 5;

// Fraction of total dismissals that must be [LIKELY] for an agent to be
// considered high-FP on [LIKELY] findings.
const LIKELY_FP_RATE_THRESHOLD = 0.40;

export interface AgentFpRate {
  agentId: string;
  likelyDismissals: number;
  totalDismissals: number;
  likelyFpRate: number;
  /** True when the agent crosses both the minimum sample and rate thresholds. */
  highLikelyFpRate: boolean;
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
export async function GET(): Promise<NextResponse> {
  try {
    const rows = await db
      .select({
        agentId: agentDismissalStats.agentId,
        dismissalsLikely: agentDismissalStats.dismissalsLikely,
        dismissals: agentDismissalStats.dismissals,
      })
      .from(agentDismissalStats);

    const rates: AgentFpRate[] = rows
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

    return NextResponse.json(
      { rates },
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
    return NextResponse.json({ rates: [] }, { status: 200 });
  }
}
