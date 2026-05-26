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
const SCORE_DROP_NOTIFY_THRESHOLD = 5;

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

  let dueRows: Array<{ id: string; userId: string; name: string; repoUrl: string; branch: string; schedule: string; threshold: number; lastScore: number | null; githubToken: string | null; userEmail: string }>;
  try {
    const rows = await db
      .select({
        id:          scheduledAudits.id,
        userId:      scheduledAudits.userId,
        name:        scheduledAudits.name,
        repoUrl:     scheduledAudits.repoUrl,
        branch:      scheduledAudits.branch,
        schedule:    scheduledAudits.schedule,
        threshold:   scheduledAudits.threshold,
        lastScore:   scheduledAudits.lastScore,
        githubToken: scheduledAudits.githubToken,
        userEmail:   user.email,
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
    dueRows = rows;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('cron_query_failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const results: Array<{ id: string; score?: number; error?: string }> = [];

  for (const row of dueRows) {
    const start = Date.now();
    try {
      const parsed = parseGitHubUrl(row.repoUrl);
      if (!parsed) throw new Error(`Cannot parse GitHub URL: ${row.repoUrl}`);

      const fetched = await fetchRepoCode(parsed.owner, parsed.repo, row.branch, row.githubToken ?? undefined);
      if (!fetched.text.trim()) throw new Error('No source files found');

      const scoreResult = await quickScore(fetched.text);
      const prevScore = row.lastScore;
      const newScore  = scoreResult.score;

      await db
        .update(scheduledAudits)
        .set({ lastScore: newScore, lastRunAt: new Date(), updatedAt: new Date() })
        .where(eq(scheduledAudits.id, row.id));

      log('scheduled_audit_complete', { id: row.id, score: newScore, prevScore, durationMs: Date.now() - start });

      const dropped = prevScore !== null && prevScore - newScore >= SCORE_DROP_NOTIFY_THRESHOLD;
      const belowThreshold = newScore < row.threshold;
      if (dropped || belowThreshold) {
        await sendScoreDropEmail({
          to: row.userEmail,
          scheduleName: row.name,
          repoUrl: row.repoUrl,
          previousScore: prevScore,
          currentScore: newScore,
          threshold: row.threshold,
          critical: scoreResult.critical,
          high: scoreResult.high,
          summary: scoreResult.summary,
        }).catch((err) => log('score_drop_email_failed', { id: row.id, error: String(err) }));
      }

      results.push({ id: row.id, score: newScore });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('scheduled_audit_failed', { id: row.id, error: message });

      await db
        .update(scheduledAudits)
        .set({ lastRunAt: new Date(), updatedAt: new Date() })
        .where(eq(scheduledAudits.id, row.id))
        .catch(() => { /* ignore */ });

      results.push({ id: row.id, error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
