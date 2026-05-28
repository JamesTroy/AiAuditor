// Typed GitHub REST wrappers used by the PR review pipeline.
//
// All calls go through getInstallationToken() — never a personal access token
// or app JWT. Each request uses a 20s timeout and the recommended Accept and
// API-Version headers per docs.github.com/en/rest.

import { getInstallationToken } from '@/lib/github/app';

const API_BASE = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 20_000;

interface RequestOpts {
  installationId: number;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

async function gh<T>(path: string, opts: RequestOpts): Promise<T> {
  const token = await getInstallationToken(opts.installationId);
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Claudit/1.0',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${opts.method ?? 'GET'} ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  // 204 No Content is valid for some DELETE / PUT endpoints
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- Pull request data ----------

export interface PullRequest {
  number: number;
  state: 'open' | 'closed';
  draft: boolean;
  title: string;
  body: string | null;
  head: { sha: string; ref: string; repo: { full_name: string } | null };
  base: { sha: string; ref: string; repo: { full_name: string } };
  user: { login: string } | null;
  changed_files: number;
  additions: number;
  deletions: number;
}

export function getPullRequest(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PullRequest> {
  return gh<PullRequest>(`/repos/${owner}/${repo}/pulls/${prNumber}`, { installationId });
}

export interface PullRequestFile {
  sha: string;
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  contents_url: string;
}

/**
 * List changed files in a PR. GitHub paginates at 30 by default; we ask for
 * 100 per page and walk up to 3 pages (300 files max) — anything bigger than
 * that is unlikely to be reviewable by an AI agent in a sensible time anyway.
 */
export async function listPullRequestFiles(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PullRequestFile[]> {
  const all: PullRequestFile[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await gh<PullRequestFile[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      { installationId },
    );
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

/**
 * Fetch the full text of a file at a given ref (typically the PR head SHA).
 * Uses the raw-content media type to skip base64 decoding for text files.
 */
export async function getFileContent(
  installationId: number,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string> {
  const token = await getInstallationToken(installationId);
  const res = await fetch(
    `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.raw+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Claudit/1.0',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub get-file ${path}@${ref} ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.text();
}

// ---------- Reviews ----------

export interface ReviewComment {
  path: string;
  body: string;
  // GitHub supports either (line, side) OR (start_line, start_side, line, side)
  // for multi-line comments. We always use single-line anchors for findings.
  line: number;
  side?: 'LEFT' | 'RIGHT';
}

export interface CreateReviewOpts {
  body: string;
  event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';
  comments?: ReviewComment[];
  commit_id?: string; // pin the review to a specific PR head SHA
}

export interface CreatedReview {
  id: number;
  state: string;
  html_url: string;
  submitted_at: string;
}

export function createReview(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
  opts: CreateReviewOpts,
): Promise<CreatedReview> {
  return gh<CreatedReview>(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
    installationId,
    method: 'POST',
    body: opts,
  });
}

/**
 * Dismiss a previously-submitted review (used when re-pushing makes the
 * old review obsolete). Cleaner history than stacking reviews.
 */
export function dismissReview(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
  reviewId: number,
  message: string,
): Promise<unknown> {
  return gh<unknown>(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${reviewId}/dismissals`, {
    installationId,
    method: 'PUT',
    body: { message },
  });
}

// ---------- Check runs (PASS/FAIL gate visible in the PR's "Checks" tab) ----------

export interface CreateCheckRunOpts {
  name: string;            // e.g., "Claudit"
  head_sha: string;
  status?: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' | 'skipped' | 'stale';
  started_at?: string;
  completed_at?: string;
  output?: {
    title: string;
    summary: string;
    text?: string;
  };
  details_url?: string;
}

export interface CheckRun {
  id: number;
  html_url: string;
  status: string;
  conclusion: string | null;
}

export function createCheckRun(
  installationId: number,
  owner: string,
  repo: string,
  opts: CreateCheckRunOpts,
): Promise<CheckRun> {
  return gh<CheckRun>(`/repos/${owner}/${repo}/check-runs`, {
    installationId,
    method: 'POST',
    body: opts,
  });
}

export function updateCheckRun(
  installationId: number,
  owner: string,
  repo: string,
  checkRunId: number,
  opts: Partial<CreateCheckRunOpts>,
): Promise<CheckRun> {
  return gh<CheckRun>(`/repos/${owner}/${repo}/check-runs/${checkRunId}`, {
    installationId,
    method: 'PATCH',
    body: opts,
  });
}
