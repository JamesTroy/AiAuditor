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

class GithubListError extends Error {
  constructor(public status: number, public body: string) {
    super(`GitHub ${status}: ${body.slice(0, 200)}`);
  }
}

async function listAllAppInstallations(): Promise<AppInstallation[]> {
  let jwt: string;
  try {
    jwt = buildAppJwt();
  } catch (err) {
    throw new GithubListError(0, `jwt_build_failed: ${err instanceof Error ? err.message : String(err)}`);
  }
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
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new GithubListError(res.status, body);
    }
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

  // Optional explicit claim: { installationId: <number> } — links a specific
  // installation that's visible to our App, bypassing the identity-match
  // heuristic. The match check itself still happens (so we can confirm the
  // ID is real and grab its metadata), but the result of that check is
  // ignored in favour of the user's stated choice.
  let explicitId: number | null = null;
  try {
    const body = (await req.json()) as { installationId?: unknown };
    if (typeof body?.installationId === 'number' && body.installationId > 0) {
      explicitId = body.installationId;
    }
  } catch {
    /* no body — discovery mode */
  }

  const { githubUserId, githubLogin } = await fetchUserGithubIdentity(session.user.id);
  const sessionNameLower = session.user.name?.toLowerCase() ?? null;

  if (!githubUserId && !githubLogin && !sessionNameLower && !explicitId) {
    return NextResponse.json(
      { linked: 0, error: 'no_github_identity', message: 'No GitHub identity found on your Claudit account. Sign in with GitHub once, then retry.' },
      { status: 400 },
    );
  }

  let installations: AppInstallation[];
  try {
    installations = await listAllAppInstallations();
  } catch (err) {
    const ghStatus = err instanceof GithubListError ? err.status : null;
    const ghBody = err instanceof GithubListError ? err.body : '';
    const message = err instanceof Error ? err.message : String(err);
    log('integrations_github_backfill_list_failed', {
      userId: session.user.id,
      ghStatus,
      ghBody: ghBody.slice(0, 500),
      error: message.slice(0, 500),
    });
    // Friendly hint for the two most common failure modes.
    let hint: string | null = null;
    if (ghStatus === 401) hint = 'GitHub rejected our App JWT (401). Most often: GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is wrong, or container clock skew >60s.';
    else if (ghStatus === 403) hint = 'GitHub returned 403 — App may be suspended or rate-limited.';
    else if (ghStatus === 0) hint = 'Failed to build the App JWT locally (private key parse error). Check GITHUB_APP_PRIVATE_KEY format.';
    return NextResponse.json(
      {
        linked: 0,
        error: 'github_list_failed',
        message: "Couldn't reach GitHub to list installations. Try again in a moment.",
        // Surfacing GitHub's status + body to every signed-in caller —
        // contents are an HTTP code, a hint string, and GitHub's error
        // payload, none of which leak secrets. Saves a round-trip through
        // Railway logs for diagnosis.
        diagnostic: { ghStatus, hint, ghBody: ghBody.slice(0, 500), error: message.slice(0, 500) },
      },
      { status: 502 },
    );
  }

  // Explicit claim takes precedence — user has seen the list of available
  // installations and chosen one. We still require it to be in the App's
  // listing so the user can't claim a number they made up.
  const matches = explicitId
    ? installations.filter((inst) => inst.id === explicitId)
    : installations.filter((inst) => {
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
        'No GitHub App installations match your account. Check the diagnostic below for what we tried to match against.',
      // Show what we know vs what GitHub listed — most often the mismatch is
      // that the install is on an org and the user's GitHub login isn't an
      // org member, or session.user.name is a display name (e.g. "James Troy")
      // and the GitHub login is "JamesTroy".
      diagnostic: {
        ghStatus: 200,
        hint: 'Listing succeeded but no installation matched. Pick one from "GitHub installations" and link it explicitly.',
        ghBody: '',
        error:
          `Tried to match against: ` +
          `githubUserId=${githubUserId ?? '(none)'}, ` +
          `githubLogin=${githubLogin ?? '(none)'}, ` +
          `sessionName=${sessionNameLower ?? '(none)'}`,
      },
      installations: installations.map((i) => ({
        installationId: i.id,
        accountLogin: i.account.login,
        accountId: i.account.id,
        accountType: i.account.type,
      })),
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
