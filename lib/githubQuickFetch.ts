// Minimal GitHub repo fetcher for scheduled audits and pre-deploy webhooks.
// Fetches a flat slice of source files from the default/specified branch.
// Mirrors the logic in app/api/github-source/route.ts (repo mode) but
// is importable as a plain function — no HTTP round-trip required.

const MAX_BYTES = 300_000;
const MAX_FILES = 50;
const MAX_FILE_BYTES = 25_000;
const FETCH_TIMEOUT_MS = 20_000;

const SOURCE_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'rb', 'go', 'rs', 'java', 'kt',
  'cs', 'php', 'swift', 'c', 'cpp', 'h',
  'sql', 'graphql', 'css', 'scss', 'html', 'vue', 'svelte',
  'yml', 'yaml', 'toml', 'json', 'sh',
]);

const IGNORED_PREFIXES = [
  'node_modules/', 'dist/', 'build/', '.next/', 'out/', 'coverage/',
  '.git/', 'vendor/', 'target/', '__pycache__/',
];

const IGNORED_NAMES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb',
]);

// owner/repo segments validated against GitHub-allowed characters.
const SLUG = /^[A-Za-z0-9._-]+$/;
const REF  = /^[A-Za-z0-9._/-]+$/;

function validateSlug(v: string, label: string) {
  if (!SLUG.test(v)) throw new Error(`Invalid ${label}`);
}

async function ghGet(url: string, token?: string | null) {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  return res.json();
}

export interface GitHubFetchResult {
  text: string;
  fileCount: number;
  truncated: boolean;
  repoFullName: string;
  sha: string;
}

export async function fetchRepoCode(
  owner: string,
  repo: string,
  ref = 'HEAD',
  token?: string | null,
): Promise<GitHubFetchResult> {
  validateSlug(owner, 'owner');
  validateSlug(repo, 'repo');
  if (!REF.test(ref)) throw new Error('Invalid ref');

  // Resolve ref to a commit SHA.
  const commit = await ghGet(
    `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
    token,
  );
  const sha: string = commit.sha;

  // Get the full file tree.
  const treeData = await ghGet(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
    token,
  );

  const candidates: string[] = (treeData.tree as Array<{ type: string; path: string; size?: number }>)
    .filter((e) => {
      if (e.type !== 'blob') return false;
      if (IGNORED_NAMES.has(e.path.split('/').pop()!)) return false;
      if (IGNORED_PREFIXES.some((p) => e.path.startsWith(p))) return false;
      const ext = e.path.split('.').pop()?.toLowerCase() ?? '';
      if (!SOURCE_EXT.has(ext)) return false;
      if (e.size && e.size > MAX_FILE_BYTES) return false;
      return true;
    })
    .map((e) => e.path)
    .slice(0, MAX_FILES);

  const parts: string[] = [];
  let totalBytes = 0;
  let truncated = false;

  for (const path of candidates) {
    if (totalBytes >= MAX_BYTES) { truncated = true; break; }
    try {
      const file = await ghGet(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(sha)}`,
        token,
      );
      const content = Buffer.from(file.content as string, 'base64').toString('utf-8');
      const chunk = `// FILE: ${path}\n${content}`;
      if (totalBytes + chunk.length > MAX_BYTES) { truncated = true; break; }
      parts.push(chunk);
      totalBytes += chunk.length;
    } catch {
      // Skip unreadable files.
    }
  }

  return {
    text: parts.join('\n\n'),
    fileCount: parts.length,
    truncated,
    repoFullName: `${owner}/${repo}`,
    sha,
  };
}

// Parse "https://github.com/owner/repo" or "github.com/owner/repo".
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.\s]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}
