// Unified GitHub source fetcher.
//
// Supports four audit-scope modes beyond the single-PR endpoint:
//   - 'repo'    : fetch a slice of an entire repository at a ref (HEAD by default)
//   - 'compare' : diff between two refs (branch vs branch, sha vs sha, tag vs ref)
//   - 'commit'  : diff introduced by a single commit (i.e. since-last-commit audit)
//   - 'pr'      : forwards to the existing PR diff path so callers can use one endpoint
//
// All responses share a normalized shape so the client can hand the same payload to /api/audit.
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { auditLimiter, perIpConcurrencyLimiter } from '@/lib/rateLimit';
import { API_RESPONSE_HEADERS } from '@/lib/config/apiHeaders';
import { cacheGet, cacheSet } from '@/lib/cache';

export const runtime = 'nodejs';

const MAX_DIFF_SIZE = 200_000;     // 200KB for multi-file diffs
const MAX_REPO_SIZE = 400_000;     // 400KB total source for repo mode
const MAX_REPO_FILES = 60;         // hard ceiling on files concatenated in repo mode
const MAX_FILE_BYTES = 30_000;     // per-file cap inside repo mode (~30KB)
const FETCH_TIMEOUT_MS = 20_000;
const CACHE_TTL_SECONDS = 300;     // 5 minutes — same as github-pr

// owner/repo segments are validated against this character class.
// GitHub allows ASCII alphanumerics, hyphen, period, underscore.
const SLUG = /^[A-Za-z0-9._-]+$/;
// Refs may include slashes (feature/foo) and a tighter set than slugs.
const REF = /^[A-Za-z0-9._/-]+$/;

// Source files we want to surface in repo mode. Anything else (lockfiles,
// binaries, images, build artifacts) is filtered out before fetching.
const SOURCE_EXTENSIONS = [
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'scala',
  'c', 'cc', 'cpp', 'h', 'hpp', 'cs',
  'php', 'sh', 'bash',
  'sql', 'graphql', 'proto',
  'css', 'scss', 'sass', 'less',
  'html', 'vue', 'svelte', 'astro',
  'yml', 'yaml', 'toml',
  'json', 'md',
];

const IGNORED_PATH_PREFIXES = [
  'node_modules/', 'dist/', 'build/', '.next/', 'out/', 'coverage/',
  '.git/', '.cache/', 'vendor/', 'target/', '__pycache__/',
];

const IGNORED_FILENAMES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb',
  'Cargo.lock', 'composer.lock', 'Pipfile.lock', 'poetry.lock',
]);

type GithubSourceMode = 'repo' | 'compare' | 'commit' | 'pr';

interface NormalizedSource {
  mode: GithubSourceMode;
  title: string;
  description: string;
  /** Concatenated source code or unified diff text to feed into /api/audit. */
  content: string;
  /** Number of files included (or changed, for diff modes). */
  files: number;
  additions?: number;
  deletions?: number;
  /** Files we *would* have included but skipped (size, count, or filter). */
  skipped?: string[];
  /** Whether content was truncated by size cap. */
  truncated: boolean;
}

function jsonError(status: number, message: string) {
  return new Response(message, { status, headers: API_RESPONSE_HEADERS });
}

function githubHeaders(accept = 'application/vnd.github.v3+json'): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    'User-Agent': 'Claudit-Audit-App',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function ghFetch(url: string, accept?: string): Promise<Response> {
  return fetch(url, {
    headers: githubHeaders(accept),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

function classifyStatus(status: number): { code: number; message: string } {
  if (status === 404) return { code: 404, message: 'Resource not found. Make sure the repository is public or a GITHUB_TOKEN is configured.' };
  if (status === 403) return { code: 429, message: 'GitHub API rate limit exceeded. Try again later.' };
  if (status === 422) return { code: 400, message: 'Invalid ref or comparison — GitHub rejected the request.' };
  return { code: 502, message: `GitHub API error: ${status}` };
}

function shouldIncludeFile(path: string): boolean {
  if (IGNORED_PATH_PREFIXES.some((p) => path.startsWith(p) || path.includes(`/${p}`))) return false;
  const base = path.split('/').pop() ?? path;
  if (IGNORED_FILENAMES.has(base)) return false;
  const ext = base.includes('.') ? base.split('.').pop()!.toLowerCase() : '';
  return SOURCE_EXTENSIONS.includes(ext);
}

// ──────────────────────────────────────────────────────────────────────────────
// repo mode
// ──────────────────────────────────────────────────────────────────────────────

interface RepoTreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
  sha: string;
}

async function fetchRepoMode(owner: string, repo: string, ref: string, pathPrefix: string | null): Promise<NormalizedSource> {
  // Resolve ref → commit sha so the tree response is stable and cacheable.
  const refRes = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`);
  if (!refRes.ok) {
    const c = classifyStatus(refRes.status);
    throw new HttpError(c.code, c.message);
  }
  const commit = await refRes.json();
  const treeSha: string = commit.commit?.tree?.sha;
  if (!treeSha) throw new HttpError(502, 'GitHub did not return a tree sha for the resolved ref.');

  const treeRes = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);
  if (!treeRes.ok) {
    const c = classifyStatus(treeRes.status);
    throw new HttpError(c.code, c.message);
  }
  const treeData = await treeRes.json();
  const entries: RepoTreeEntry[] = Array.isArray(treeData.tree) ? treeData.tree : [];

  // Filter to source files we want, optionally scoped to a path prefix.
  const prefix = pathPrefix ? pathPrefix.replace(/^\/+|\/+$/g, '') + '/' : '';
  const candidates = entries
    .filter((e) => e.type === 'blob' && shouldIncludeFile(e.path))
    .filter((e) => (prefix ? e.path.startsWith(prefix) : true))
    .filter((e) => (e.size ?? 0) <= MAX_FILE_BYTES * 2) // generous before content check
    // Stable, deterministic ordering by path so cache keys behave.
    .sort((a, b) => a.path.localeCompare(b.path));

  const skipped: string[] = [];
  const picked: RepoTreeEntry[] = [];
  for (const e of candidates) {
    if (picked.length >= MAX_REPO_FILES) { skipped.push(e.path); continue; }
    picked.push(e);
  }
  if (treeData.truncated) skipped.push('(git tree truncated by GitHub — repo too large for full enumeration)');

  // Fetch each file via the raw contents endpoint, in parallel but bounded.
  const concurrency = 8;
  const fileTexts: { path: string; content: string }[] = [];
  let totalBytes = 0;
  let truncated = false;

  async function fetchOne(entry: RepoTreeEntry) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${entry.path}?ref=${encodeURIComponent(commit.sha)}`;
    const res = await ghFetch(url, 'application/vnd.github.v3.raw');
    if (!res.ok) { skipped.push(entry.path); return; }
    const text = await res.text();
    const slice = text.slice(0, MAX_FILE_BYTES);
    if (totalBytes + slice.length > MAX_REPO_SIZE) { truncated = true; return; }
    totalBytes += slice.length;
    fileTexts.push({ path: entry.path, content: slice });
  }

  // Simple chunked parallelism — keep it within GitHub's secondary rate limit.
  for (let i = 0; i < picked.length; i += concurrency) {
    if (truncated) break;
    await Promise.all(picked.slice(i, i + concurrency).map(fetchOne));
  }

  fileTexts.sort((a, b) => a.path.localeCompare(b.path));

  const content = fileTexts
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n');

  return {
    mode: 'repo',
    title: `${owner}/${repo}@${ref}${prefix ? ` /${prefix}` : ''}`,
    description: `Repository snapshot: ${fileTexts.length} files, ${(totalBytes / 1024).toFixed(0)}KB`,
    content,
    files: fileTexts.length,
    skipped: skipped.length > 0 ? skipped.slice(0, 50) : undefined,
    truncated,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// compare / commit modes
// ──────────────────────────────────────────────────────────────────────────────

async function fetchCompareMode(owner: string, repo: string, base: string, head: string): Promise<NormalizedSource> {
  const metaUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
  const metaRes = await ghFetch(metaUrl);
  if (!metaRes.ok) {
    const c = classifyStatus(metaRes.status);
    throw new HttpError(c.code, c.message);
  }
  const meta = await metaRes.json();

  const diffRes = await ghFetch(metaUrl, 'application/vnd.github.v3.diff');
  if (!diffRes.ok) throw new HttpError(502, 'Failed to fetch comparison diff.');
  const rawDiff = await diffRes.text();
  const sliced = rawDiff.slice(0, MAX_DIFF_SIZE);

  return {
    mode: 'compare',
    title: `${owner}/${repo}: ${base}...${head}`,
    description: `${meta.total_commits ?? 0} commits, ${meta.files?.length ?? 0} files changed (+${meta.ahead_by ?? 0}/-${meta.behind_by ?? 0} commits ahead/behind)`,
    content: sliced,
    files: meta.files?.length ?? 0,
    additions: typeof meta.files === 'object' && Array.isArray(meta.files)
      ? meta.files.reduce((s: number, f: { additions?: number }) => s + (f.additions ?? 0), 0)
      : undefined,
    deletions: Array.isArray(meta.files)
      ? meta.files.reduce((s: number, f: { deletions?: number }) => s + (f.deletions ?? 0), 0)
      : undefined,
    truncated: rawDiff.length > MAX_DIFF_SIZE,
  };
}

async function fetchCommitMode(owner: string, repo: string, sha: string): Promise<NormalizedSource> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}`;
  const metaRes = await ghFetch(url);
  if (!metaRes.ok) {
    const c = classifyStatus(metaRes.status);
    throw new HttpError(c.code, c.message);
  }
  const meta = await metaRes.json();
  const diffRes = await ghFetch(url, 'application/vnd.github.v3.diff');
  if (!diffRes.ok) throw new HttpError(502, 'Failed to fetch commit diff.');
  const rawDiff = await diffRes.text();
  const sliced = rawDiff.slice(0, MAX_DIFF_SIZE);

  const firstLine = (meta.commit?.message ?? '').split('\n')[0] ?? '';
  return {
    mode: 'commit',
    title: `${owner}/${repo}@${(meta.sha ?? sha).slice(0, 7)}: ${firstLine}`.slice(0, 200),
    description: `${meta.author?.login ?? meta.commit?.author?.name ?? 'unknown'} — ${meta.files?.length ?? 0} files changed (+${meta.stats?.additions ?? 0} / -${meta.stats?.deletions ?? 0})`,
    content: sliced,
    files: meta.files?.length ?? 0,
    additions: meta.stats?.additions,
    deletions: meta.stats?.deletions,
    truncated: rawDiff.length > MAX_DIFF_SIZE,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Request handling
// ──────────────────────────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface RequestBody {
  mode?: unknown;
  owner?: unknown;
  repo?: unknown;
  ref?: unknown;
  base?: unknown;
  head?: unknown;
  sha?: unknown;
  path?: unknown;
}

function readSlug(v: unknown, label: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `Missing ${label}`);
  const s = v.trim();
  if (!SLUG.test(s) || s.length > 100) throw new HttpError(400, `Invalid ${label}`);
  return s;
}

function readRef(v: unknown, label: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `Missing ${label}`);
  const s = v.trim();
  if (!REF.test(s) || s.length > 250) throw new HttpError(400, `Invalid ${label}`);
  return s;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';

  const rl = await auditLimiter.check(ip);
  if (!rl.allowed) return new Response('Too many requests.', { status: 429, headers: rl.headers });
  const ipBurst = await perIpConcurrencyLimiter.check(ip);
  if (!ipBurst.allowed) return new Response('Too many requests from this IP. Please slow down.', { status: 429, headers: ipBurst.headers });

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  const mode = typeof body.mode === 'string' ? body.mode : '';
  if (mode !== 'repo' && mode !== 'compare' && mode !== 'commit') {
    return jsonError(400, 'Invalid mode. Expected one of: repo, compare, commit.');
  }

  try {
    const owner = readSlug(body.owner, 'owner');
    const repo = readSlug(body.repo, 'repo');

    // Cache key reflects every meaningful input so we don't cross-contaminate modes.
    const cacheSrc = JSON.stringify({ mode, owner, repo, ref: body.ref, base: body.base, head: body.head, sha: body.sha, path: body.path });
    const cacheKey = `gh-src:${createHash('sha256').update(cacheSrc).digest('hex').slice(0, 32)}`;
    const cached = await cacheGet<NormalizedSource>(cacheKey);
    if (cached) return Response.json(cached, { headers: API_RESPONSE_HEADERS });

    let result: NormalizedSource;
    if (mode === 'repo') {
      const ref = body.ref ? readRef(body.ref, 'ref') : 'HEAD';
      const pathPrefix = typeof body.path === 'string' && body.path.trim() ? body.path.trim() : null;
      if (pathPrefix && pathPrefix.length > 250) throw new HttpError(400, 'Invalid path');
      result = await fetchRepoMode(owner, repo, ref, pathPrefix);
    } else if (mode === 'compare') {
      const base = readRef(body.base, 'base');
      const head = readRef(body.head, 'head');
      result = await fetchCompareMode(owner, repo, base, head);
    } else {
      const sha = readRef(body.sha, 'sha');
      result = await fetchCommitMode(owner, repo, sha);
    }

    await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
    return Response.json(result, { headers: API_RESPONSE_HEADERS });
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.status, err.message);
    if (err instanceof Error && err.name === 'TimeoutError') {
      return jsonError(504, 'GitHub API request timed out');
    }
    return jsonError(502, 'Failed to fetch from GitHub');
  }
}
