// GET /api/integrations/github/install
//
// Session-gated entry point for the GitHub App install flow. Builds a
// signed state token tying this install attempt to the current user,
// then 302-redirects to https://github.com/apps/<slug>/installations/new.
//
// After the user picks repos and confirms on GitHub, GitHub redirects back
// to /api/integrations/github/callback with the same state.

import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { auth } from '@/lib/auth';
import { settingsLimiter } from '@/lib/rateLimit';
import { signInstallState, getGitHubInstallUrl } from '@/lib/github/installFlow';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = await settingsLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers });
  }

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) {
    // Redirect to login with a return-to so the user lands back here.
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', '/api/integrations/github/install');
    return NextResponse.redirect(loginUrl);
  }

  const state = signInstallState(session.user.id);
  return NextResponse.redirect(getGitHubInstallUrl(state));
}
