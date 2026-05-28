// POST /api/integrations/github/backfill
//
// Links GitHub App installations the user already created on GitHub (before
// our DB table existed, or via direct install on github.com without going
// through our /install endpoint) to their Claudit account.
//
// How matching works (in order):
//   1. The user's Better Auth `account` row with providerId='github' gives us
//      their GitHub numeric user id. Any installation whose account.id matches
//      it (User-type install) is linked.
//   2. As a fallback for org installs and for users whose GitHub OAuth link
//      is missing, we also match by case-insensitive account.login against
//      both their GitHub-OAuth login (if available) and their session.user.name.
//
// Without one of these matches we refuse to link — otherwise any user could
// claim any installation. If nothing matches, the response says so and the
// user is expected to use the standard "Install on GitHub" button.

import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { account, githubInstallations } from '@/lib/auth-schema';
import { settingsLimiter } from '@/lib/rateLimit';
import { buildAppJwt, getInstallationToken } from '@/lib/github/app';

export const runtime = 'nodejs';

interface AppInstallation {
  id: number;
  account: { id: number; login: string; type: 'User' | 'Organization' };
  repository_selection: 'all' | 'selected';
  suspended_at: string | null;
}

interface InstallationRepos {
  total_count: number;
  repositories: Array<{ id: number; full_name: string }>;
}

function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event, ...data }));
}

async function fetchUserGithubIdentity(userId: string): Promise<{ githubUserId: string | null; githubLogin: string | null }> {
  const [row] = await db
    .select({ accountId: account.accountId, accessToken: account.accessToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'github')))
    .limit(1);
  if (!row) return { githubUserId: null, githubLogin: null };

  let login: string | null = null;
  if (row.accessToken) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${row.accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Claudit/1.0',
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const json = (await res.json()) as { login?: string };
        if (typeof json.login === 'string') login = json.login.toLowerCase();
      }
    } catch {
      /* non-fatal — login stays null and we fall back to id-only matching */
    }
  }
  return { githubUserId: row.accountId, githubLogin: login };
}

async function listAllAppInstallations(): Promise<AppInstallation[]> {
  const jwt = buildAppJwt();
  const all: AppInstallation[] = [];
  let page = 1;
  const PER_PAGE = 100;
  while (page <= 5) {
    const res = await fetch(`https://api.github.com/app/installations?per_page=${PER_PAGE}&page=${page}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Claudit/1.0',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`GitHub returned ${res.status} listing installations`);
    const batch = (await res.json()) as AppInstallation[];
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
    page += 1;
  }
  return all;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = await settingsLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers });
  }

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { githubUserId, githubLogin } = await fetchUserGithubIdentity(session.user.id);
  const sessionNameLower = session.user.name?.toLowerCase() ?? null;

  if (!githubUserId && !githubLogin && !sessionNameLower) {
    return NextResponse.json(
      { linked: 0, error: 'no_github_identity', message: 'No GitHub identity found on your Claudit account. Sign in with GitHub once, then retry.' },
      { status: 400 },
    );
  }

  let installations: AppInstallation[];
  try {
    installations = await listAllAppInstallations();
  } catch (err) {
    log('integrations_github_backfill_list_failed', {
      userId: session.user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { linked: 0, error: 'github_list_failed', message: "Couldn't reach GitHub to list installations. Try again in a moment." },
      { status: 502 },
    );
  }

  const matches = installations.filter((inst) => {
    const loginLower = inst.account.login.toLowerCase();
    if (githubUserId && String(inst.account.id) === githubUserId && inst.account.type === 'User') return true;
    if (githubLogin && loginLower === githubLogin) return true;
    if (sessionNameLower && loginLower === sessionNameLower) return true;
    return false;
  });

  log('integrations_github_backfill_matched', {
    userId: session.user.id,
    matchCount: matches.length,
    totalInstallations: installations.length,
    hasGithubId: !!githubUserId,
    hasGithubLogin: !!githubLogin,
  });

  if (matches.length === 0) {
    return NextResponse.json({
      linked: 0,
      candidates: [],
      message:
        'No GitHub App installations match your account. If the install is on an organization, make sure your GitHub username has access to that org, or use the standard Install on GitHub button.',
    });
  }

  let linked = 0;
  const errors: Array<{ installationId: number; error: string }> = [];
  for (const inst of matches) {
    let repositoriesJson = '[]';
    if (inst.repository_selection === 'selected') {
      try {
        const token = await getInstallationToken(inst.id);
        const res = await fetch('https://api.github.com/installation/repositories?per_page=100', {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Claudit/1.0',
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          const data = (await res.json()) as InstallationRepos;
          repositoriesJson = JSON.stringify(
            data.repositories.slice(0, 200).map((r) => ({ id: r.id, full_name: r.full_name })),
          );
        }
      } catch {
        /* leave as [] — non-fatal */
      }
    }

    try {
      await db
        .insert(githubInstallations)
        .values({
          installationId: inst.id,
          userId: session.user.id,
          accountLogin: inst.account.login,
          accountType: inst.account.type,
          repositorySelection: inst.repository_selection,
          repositories: repositoriesJson,
          suspendedAt: inst.suspended_at ? new Date(inst.suspended_at) : null,
          config: '{}',
        })
        .onConflictDoUpdate({
          target: githubInstallations.installationId,
          set: {
            userId: session.user.id,
            accountLogin: inst.account.login,
            accountType: inst.account.type,
            repositorySelection: inst.repository_selection,
            repositories: repositoriesJson,
            suspendedAt: inst.suspended_at ? new Date(inst.suspended_at) : null,
            updatedAt: new Date(),
          },
        });
      linked += 1;
    } catch (err) {
      errors.push({ installationId: inst.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  log('integrations_github_backfill_done', {
    userId: session.user.id,
    linked,
    errorCount: errors.length,
  });

  return NextResponse.json({
    linked,
    candidates: matches.map((m) => ({
      installationId: m.id,
      accountLogin: m.account.login,
      accountType: m.account.type,
    })),
    errors: errors.length ? errors : undefined,
  });
}
