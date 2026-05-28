// GET    /api/integrations/github           List the caller's GitHub App installations
// DELETE /api/integrations/github?id=N       Remove the local record for an installation
//
// DELETE only clears our DB row — it does NOT uninstall the App from GitHub.
// For that, the user has to go to https://github.com/settings/installations/<id>
// and click "Uninstall". The UI surfaces both: a "Manage on GitHub" deep link
// and a "Remove from Claudit" button that calls this DELETE.

import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { githubInstallations, prAudits } from '@/lib/auth-schema';
import { settingsLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';

interface RepoEntry {
  id: number;
  full_name: string;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = await settingsLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers });
  }

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let rows;
  try {
    rows = await db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.userId, session.user.id))
      .orderBy(desc(githubInstallations.installedAt));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const e = err as { code?: string; cause?: { code?: string; message?: string } };
    const sqlstate = e.code ?? e.cause?.code;
    const causeMessage = e.cause?.message ?? '';

    // Log the raw shape so we can diagnose Railway issues from logs — the
    // generic "Couldn't load" UI message hides the real cause otherwise.
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      event: 'integrations_github_list_query_failed',
      sqlstate,
      message: message.slice(0, 300),
      cause: causeMessage.slice(0, 300),
    }));

    // Postgres SQLSTATE 42P01 = undefined_table (migration 006 not applied).
    // Match by code first (most reliable), then by message text as a fallback
    // in case the error is wrapped and the code doesn't surface — drizzle
    // wraps errors with a generic "Failed query: …" prefix that has tripped
    // a stricter regex in the past.
    const tableMissing =
      sqlstate === '42P01' ||
      /relation .* does not exist|no such table|table .* does not exist/i.test(message) ||
      /relation .* does not exist|no such table|table .* does not exist/i.test(causeMessage);
    if (tableMissing) {
      return NextResponse.json(
        { installations: [], recentAudits: [], migrationMissing: true },
        { status: 200 },
      );
    }
    throw err;
  }

  const installations = rows.map((r) => {
    let repos: RepoEntry[] = [];
    try {
      const parsed = JSON.parse(r.repositories);
      if (Array.isArray(parsed)) repos = parsed;
    } catch {
      /* leave empty */
    }
    let threshold = 70;
    try {
      const cfg = JSON.parse(r.config);
      if (cfg && typeof cfg.threshold === 'number' && cfg.threshold >= 0 && cfg.threshold <= 100) {
        threshold = cfg.threshold;
      }
    } catch {
      /* default */
    }
    return {
      installationId: r.installationId,
      accountLogin: r.accountLogin,
      accountType: r.accountType,
      repositorySelection: r.repositorySelection,
      repositoryCount: repos.length,
      repositories: repos.slice(0, 10),  // cap returned to keep payload small
      installedAt: r.installedAt,
      suspendedAt: r.suspendedAt,
      threshold,
    };
  });

  // Recent PR audits across all the user's installations.
  const installationIds = installations.map((i) => i.installationId);
  type RecentAuditRow = {
    id: string;
    installationId: number;
    repoFullName: string;
    prNumber: number;
    status: string;
    score: number | null;
    findingsTotal: number | null;
    findingsCritical: number | null;
    findingsHigh: number | null;
    postedReviewId: number | null;
    postedCheckRunId: number | null;
    createdAt: Date;
  };
  let recentAudits: RecentAuditRow[] = [];
  if (installationIds.length > 0) {
    try {
      const { inArray } = await import('drizzle-orm');
      recentAudits = await db
        .select({
          id: prAudits.id,
          installationId: prAudits.installationId,
          repoFullName: prAudits.repoFullName,
          prNumber: prAudits.prNumber,
          status: prAudits.status,
          score: prAudits.score,
          findingsTotal: prAudits.findingsTotal,
          findingsCritical: prAudits.findingsCritical,
          findingsHigh: prAudits.findingsHigh,
          postedReviewId: prAudits.postedReviewId,
          postedCheckRunId: prAudits.postedCheckRunId,
          createdAt: prAudits.createdAt,
        })
        .from(prAudits)
        .where(inArray(prAudits.installationId, installationIds))
        .orderBy(desc(prAudits.createdAt))
        .limit(20);
    } catch {
      /* pr_audits table may not exist if migration partial — fall through with [] */
    }
  }

  return NextResponse.json({ installations, recentAudits });
}

export async function PATCH(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = await settingsLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers });
  }

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const idRaw = req.nextUrl.searchParams.get('id');
  const installationId = idRaw ? parseInt(idRaw, 10) : NaN;
  if (Number.isNaN(installationId) || installationId <= 0) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  }

  let body: { threshold?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const threshold = body.threshold;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    return NextResponse.json({ error: 'threshold must be a number 0-100' }, { status: 400 });
  }

  // Fetch existing config, merge threshold, write back.
  const [existing] = await db
    .select({ config: githubInstallations.config })
    .from(githubInstallations)
    .where(
      and(
        eq(githubInstallations.installationId, installationId),
        eq(githubInstallations.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let parsed: Record<string, unknown> = {};
  try {
    const obj = JSON.parse(existing.config);
    if (obj && typeof obj === 'object') parsed = obj as Record<string, unknown>;
  } catch {
    /* malformed existing config — overwrite */
  }
  parsed.threshold = Math.round(threshold);

  await db
    .update(githubInstallations)
    .set({ config: JSON.stringify(parsed), updatedAt: new Date() })
    .where(
      and(
        eq(githubInstallations.installationId, installationId),
        eq(githubInstallations.userId, session.user.id),
      ),
    );

  return NextResponse.json({ threshold: parsed.threshold });
}

export async function DELETE(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = await settingsLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers });
  }

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const idRaw = req.nextUrl.searchParams.get('id');
  const installationId = idRaw ? parseInt(idRaw, 10) : NaN;
  if (Number.isNaN(installationId) || installationId <= 0) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  }

  // Only delete rows owned by the caller — prevents another user from
  // wiping someone else's install record via guessed installation IDs.
  const [deleted] = await db
    .delete(githubInstallations)
    .where(
      and(
        eq(githubInstallations.installationId, installationId),
        eq(githubInstallations.userId, session.user.id),
      ),
    )
    .returning({ installationId: githubInstallations.installationId });

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
