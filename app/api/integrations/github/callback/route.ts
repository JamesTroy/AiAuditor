// GET /api/integrations/github/callback
//
// GitHub redirects here after the user installs the App. We validate the
// signed state, fetch the installation's account/repo metadata, and write
// (or refresh) the github_installations row linked to the Claudit user.
//
// Query params from GitHub:
//   installation_id   numeric, required
//   setup_action      "install" | "update"
//   state             our signed state token
//   code              OAuth code (only when "Request user authorization
//                     during installation" is enabled; we don't use it for
//                     identity since the user is already logged in)

import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { githubInstallations } from '@/lib/auth-schema';
import { settingsLimiter } from '@/lib/rateLimit';
import { verifyInstallState } from '@/lib/github/installFlow';
import { buildAppJwt } from '@/lib/github/app';

export const runtime = 'nodejs';

interface GitHubInstallation {
  id: number;
  account: { login: string; type: 'User' | 'Organization' };
  repository_selection: 'all' | 'selected';
}

interface GitHubInstallationRepos {
  total_count: number;
  repositories: Array<{ id: number; full_name: string; private: boolean }>;
}

const SETTINGS_URL = '/settings/integrations';

function redirectWithError(req: NextRequest, code: string): NextResponse {
  const url = new URL(SETTINGS_URL, req.url);
  url.searchParams.set('error', code);
  return NextResponse.redirect(url);
}

function redirectInstalled(req: NextRequest, installationId: number): NextResponse {
  const url = new URL(SETTINGS_URL, req.url);
  url.searchParams.set('installed', String(installationId));
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = await settingsLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers });
  }

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) {
    // We can't link an install without a user. Send them to login, but with
    // a return-to that does NOT carry the install state (which is bound to
    // a different user anyway).
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', SETTINGS_URL);
    return NextResponse.redirect(loginUrl);
  }

  const installationIdRaw = req.nextUrl.searchParams.get('installation_id');
  const state = req.nextUrl.searchParams.get('state');
  const installationId = installationIdRaw ? parseInt(installationIdRaw, 10) : NaN;
  if (!installationIdRaw || Number.isNaN(installationId) || installationId <= 0) {
    return redirectWithError(req, 'missing_installation_id');
  }

  const decoded = verifyInstallState(state);
  if (!decoded) return redirectWithError(req, 'invalid_or_expired_state');

  // Defence-in-depth — the state's userId must match the current session.
  // Without this, a leaked state token could be replayed by another user.
  if (decoded.userId !== session.user.id) {
    return redirectWithError(req, 'state_user_mismatch');
  }

  // Fetch installation metadata via App JWT (no installation token needed —
  // /app/installations/{id} is App-scoped).
  let installation: GitHubInstallation;
  try {
    const jwt = buildAppJwt();
    const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Claudit/1.0',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return redirectWithError(req, 'github_fetch_failed');
    }
    installation = (await res.json()) as GitHubInstallation;
  } catch {
    return redirectWithError(req, 'github_fetch_failed');
  }

  // For repository_selection='selected', fetch the chosen repos so we can
  // mirror the list (lightweight: id + full_name only). For 'all' we leave
  // the list empty — the webhook flow looks repos up at audit time anyway.
  let repositoriesJson = '[]';
  if (installation.repository_selection === 'selected') {
    try {
      // Need an installation token for /installation/repositories.
      const { getInstallationToken } = await import('@/lib/github/app');
      const token = await getInstallationToken(installationId);
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
        const data = (await res.json()) as GitHubInstallationRepos;
        repositoriesJson = JSON.stringify(
          data.repositories.slice(0, 200).map((r) => ({ id: r.id, full_name: r.full_name })),
        );
      }
    } catch {
      // Non-fatal — leave repositoriesJson as '[]'.
    }
  }

  try {
    await db
      .insert(githubInstallations)
      .values({
        installationId,
        userId: session.user.id,
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        repositorySelection: installation.repository_selection,
        repositories: repositoriesJson,
        config: '{}',
      })
      .onConflictDoUpdate({
        target: githubInstallations.installationId,
        set: {
          userId: session.user.id,
          accountLogin: installation.account.login,
          accountType: installation.account.type,
          repositorySelection: installation.repository_selection,
          repositories: repositoriesJson,
          suspendedAt: null,
          updatedAt: new Date(),
        },
      });
  } catch {
    return redirectWithError(req, 'db_write_failed');
  }

  return redirectInstalled(req, installationId);
}
