// Cron endpoint for scheduled audits.
// Call this from a cron service (Railway cron, cron-job.org, etc.) with:
//   POST /api/cron/scheduled-audits
//   Authorization: Bearer <CRON_SECRET>
// Processes at most 10 due audits per invocation to respect Railway timeouts.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scheduledAudits, user } from '@/lib/auth-schema';
import { eq, and, or, isNull, lte } from 'drizzle-orm';
import { fetchRepoCode, parseGitHubUrl } from '@/lib/githubQuickFetch';
import { quickScore } from '@/lib/quickScore';
import { sendScoreDropEmail } from '@/lib/email/scoreDropEmail';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BATCH_SIZE = 10;
const SCORE_DROP_NOTIFY_THRESHOLD = 5; // notify if score falls by this many points

function isDue(row: typeof scheduledAudits.$inferSelect): boolean {
  if (!row.enabled) return false;
  if (!row.lastRunAt) return true;
  const now = Date.now();
  const last = new Date(row.lastRunAt).getTime();
  const interval = row.schedule === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return now - last >= interval;
}

function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all enabled scheduled audits whose last run was either never or past due.
  const now = new Date();
  const dailyCutoff  = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weeklyCutoff = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

  const dueRows = await db
    .select({
      audit:    scheduledAudits,
      userEmail: user.email,
    })
    .from(scheduledAudits)
    .innerJoin(user, eq(scheduledAudits.userId, user.id))
    .where(
      and(
        eq(scheduledAudits.enabled, true),
        or(
          isNull(scheduledAudits.lastRunAt),
          and(eq(scheduledAudits.schedule, 'daily'),  lte(scheduledAudits.lastRunAt, dailyCutoff)),
          and(eq(scheduledAudits.schedule, 'weekly'), lte(scheduledAudits.lastRunAt, weeklyCutoff)),
        ),
      ),
    )
    .limit(BATCH_SIZE);

  const results: Array<{ id: string; score?: number; error?: string }> = [];

  for (const { audit, userEmail } of dueRows) {
    const start = Date.now();
    try {
      // Parse repo URL.
      const parsed = parseGitHubUrl(audit.repoUrl);
      if (!parsed) throw new Error(`Cannot parse GitHub URL: ${audit.repoUrl}`);

      // Fetch source.
      const fetched = await fetchRepoCode(
        parsed.owner,
        parsed.repo,
        audit.branch,
        audit.githubToken ?? undefined,
      );
      if (!fetched.text.trim()) throw new Error('No source files found');

      // Score.
      const scoreResult = await quickScore(fetched.text);
      const prevScore = audit.lastScore;
      const newScore  = scoreResult.score;

      // Persist result.
      await db
        .update(scheduledAudits)
        .set({ lastScore: newScore, lastRunAt: new Date(), updatedAt: new Date() })
        .where(eq(scheduledAudits.id, audit.id));

      log('scheduled_audit_complete', {
        id: audit.id, score: newScore, prevScore, durationMs: Date.now() - start,
      });

      // Email if score dropped meaningfully OR is below threshold.
      const dropped = prevScore !== null && prevScore - newScore >= SCORE_DROP_NOTIFY_THRESHOLD;
      const belowThreshold = newScore < audit.threshold;
      if (dropped || belowThreshold) {
        await sendScoreDropEmail({
          to: userEmail,
          scheduleName: audit.name,
          repoUrl: audit.repoUrl,
          previousScore: prevScore,
          currentScore: newScore,
          threshold: audit.threshold,
          critical: scoreResult.critical,
          high: scoreResult.high,
          summary: scoreResult.summary,
        }).catch((err) => {
          log('score_drop_email_failed', { id: audit.id, error: String(err) });
        });
      }

      results.push({ id: audit.id, score: newScore });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('scheduled_audit_failed', { id: audit.id, error: message });

      await db
        .update(scheduledAudits)
        .set({ lastRunAt: new Date(), updatedAt: new Date() })
        .where(eq(scheduledAudits.id, audit.id))
        .catch(() => { /* ignore secondary failure */ });

      results.push({ id: audit.id, error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
