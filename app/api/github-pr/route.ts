import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { auditLimiter } from '@/lib/rateLimit';
import { API_RESPONSE_HEADERS } from '@/lib/config/apiHeaders';
import { cacheGet, cacheSet } from '@/lib/cache';

export const runtime = 'nodejs';

const MAX_DIFF_SIZE = 100_000; // 100KB max diff
const FETCH_TIMEOUT_MS = 15_000;

// Parse GitHub PR URL: https://github.com/owner/repo/pull/123
const PR_URL_PATTERN = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';

  const rl = auditLimiter.check(ip);
  if (!rl.allowed) {
    return new Response('Too many requests.', { status: 429, headers: rl.headers });
  }

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const match = url.match(PR_URL_PATTERN);
  if (!match) {
    return new Response('Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/123', { status: 400 });
  }

  const [, owner, repo, prNumber] = match;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;

  // CACHE-013: Check Redis cache for previously fetched PR data (TTL 5 min).
  const prCacheKey = `pr:${createHash('sha256').update(apiUrl).digest('hex').slice(0, 32)}`;
  const cached = await cacheGet<{
    title: string; description: string; author: string; branch: string;
    baseBranch: string; changedFiles: number; additions: number; deletions: number;
    diff: string; truncated: boolean;
  }>(prCacheKey);
  if (cached) {
    return Response.json(cached, { headers: API_RESPONSE_HEADERS });
  }

  try {
    // Fetch PR metadata
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Claudit-Audit-App',
    };

    // Use GitHub token if available (for private repos or higher rate limits)
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const prRes = await fetch(apiUrl, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!prRes.ok) {
      if (prRes.status === 404) {
        return new Response('PR not found. Make sure the repository is public or a GITHUB_TOKEN is configured.', { status: 404 });
      }
      if (prRes.status === 403) {
        return new Response('GitHub API rate limit exceeded. Try again later.', { status: 429 });
      }
      return new Response(`GitHub API error: ${prRes.status}`, { status: 502 });
    }

    const prData = await prRes.json();

    // Fetch the diff
    const diffRes = await fetch(`${apiUrl}.diff`, {
      headers: { ...headers, 'Accept': 'application/vnd.github.v3.diff' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!diffRes.ok) {
      return new Response('Failed to fetch PR diff', { status: 502 });
    }

    const diff = await diffRes.text();
    const truncatedDiff = diff.slice(0, MAX_DIFF_SIZE);

    // CACHE-001/026: Explicit no-store prevents shared caches from leaking private PR data.
    const result = {
      title: prData.title,
      description: prData.body ?? '',
      author: prData.user?.login ?? 'unknown',
      branch: prData.head?.ref ?? '',
      baseBranch: prData.base?.ref ?? '',
      changedFiles: prData.changed_files ?? 0,
      additions: prData.additions ?? 0,
      deletions: prData.deletions ?? 0,
      diff: truncatedDiff,
      truncated: diff.length > MAX_DIFF_SIZE,
    };

    // CACHE-013: Cache PR data for 5 minutes (PRs change infrequently during an audit session).
    await cacheSet(prCacheKey, result, 300);

    return Response.json(result, { headers: API_RESPONSE_HEADERS });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return new Response('GitHub API request timed out', { status: 504 });
    }
    return new Response('Failed to fetch PR data', { status: 502 });
  }
}
