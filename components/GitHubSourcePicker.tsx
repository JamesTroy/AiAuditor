'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { friendlyError } from '@/lib/friendlyError';
import { transitions, tapScale } from '@/lib/motion/variants';

// Source modes supported by the unified /api/github-source endpoint, plus
// the legacy 'pr' path which still lives under /api/github-pr.
type Mode = 'repo' | 'compare' | 'commit' | 'pr';

interface FetchResult {
  /** Source-tree concat (repo mode) or unified diff (compare/commit/pr). */
  content: string;
  /** Optional companion files appended to the audit as workspace context. */
  contextFiles?: { name: string; content: string }[];
  /** Short human-readable summary for the activity log. */
  summary: string;
}

interface Props {
  /** Called with the fetched content (and optional context files) once load succeeds. */
  onSource: (result: FetchResult) => void;
  /** Lock the picker while an audit is running. */
  disabled?: boolean;
}

const PR_PATTERN = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)\/?$/i;
const REPO_PATTERN = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i;
const COMMIT_PATTERN = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/commit\/([0-9a-f]{6,40})\/?$/i;
const COMPARE_PATTERN = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/compare\/(.+?)\.{2,3}(.+?)\/?$/i;

function modeLabel(m: Mode): string {
  return m === 'repo' ? 'Full repo' : m === 'compare' ? 'Branch ↔ branch' : m === 'commit' ? 'Single commit' : 'Pull request';
}

function modeDescription(m: Mode): string {
  switch (m) {
    case 'repo': return 'Snapshot source files at a ref (HEAD by default). Best for first-time audits or refactors.';
    case 'compare': return 'Diff between two refs (branch, tag, or sha). Best for release reviews.';
    case 'commit': return 'Diff for a single commit — fast regression check since last commit.';
    case 'pr': return 'GitHub PR diff. Best for code review workflows.';
  }
}

export default function GitHubSourcePicker({ onSource, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('pr');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Per-mode inputs. Kept independent so switching tabs doesn't wipe state.
  const [prUrl, setPrUrl] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [repoRef, setRepoRef] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [compareUrl, setCompareUrl] = useState('');
  const [compareBase, setCompareBase] = useState('');
  const [compareHead, setCompareHead] = useState('');
  const [commitUrl, setCommitUrl] = useState('');
  const [commitSha, setCommitSha] = useState('');

  const reset = useCallback(() => {
    setError('');
    setLoading(false);
  }, []);

  function parseRepoRef(value: string): { owner: string; repo: string } | null {
    const m = value.trim().match(REPO_PATTERN);
    if (!m) return null;
    return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
  }

  function parseCompareRef(value: string): { owner: string; repo: string; base: string; head: string } | null {
    const m = value.trim().match(COMPARE_PATTERN);
    if (!m) return null;
    return { owner: m[1], repo: m[2], base: decodeURIComponent(m[3]), head: decodeURIComponent(m[4]) };
  }

  function parseCommitRef(value: string): { owner: string; repo: string; sha: string } | null {
    const m = value.trim().match(COMMIT_PATTERN);
    if (!m) return null;
    return { owner: m[1], repo: m[2], sha: m[3] };
  }

  async function postSource(body: Record<string, unknown>): Promise<Response> {
    return fetch('/api/github-source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function handleFetch() {
    if (loading || disabled) return;
    reset();
    setLoading(true);
    try {
      if (mode === 'pr') {
        if (!PR_PATTERN.test(prUrl.trim())) throw new Error('Enter a GitHub PR URL like https://github.com/owner/repo/pull/123');
        const res = await fetch('/api/github-pr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: prUrl.trim() }),
        });
        if (!res.ok) throw new Error(friendlyError(await res.text()));
        const data = await res.json();
        const header = `# PR: ${data.title}\n# Author: ${data.author}\n# Branch: ${data.branch} → ${data.baseBranch}\n# Changed files: ${data.changedFiles} (+${data.additions} -${data.deletions})${data.truncated ? '\n# Note: diff truncated' : ''}\n\n`;
        onSource({
          content: header + data.diff,
          summary: `PR #${prUrl.match(PR_PATTERN)?.[3] ?? ''}: ${data.changedFiles} files (+${data.additions}/-${data.deletions})`,
        });
        setOpen(false);
        return;
      }

      if (mode === 'repo') {
        const parsed = parseRepoRef(repoUrl);
        if (!parsed) throw new Error('Enter a GitHub repo URL like https://github.com/owner/repo');
        const res = await postSource({
          mode: 'repo',
          owner: parsed.owner,
          repo: parsed.repo,
          ref: repoRef.trim() || 'HEAD',
          path: repoPath.trim() || undefined,
        });
        if (!res.ok) throw new Error(friendlyError(await res.text()));
        const data = await res.json();
        // Repo mode produces a multi-file concat. Send the first slice as the
        // primary input and the rest as context files so the auditor sees
        // structure without exceeding the input ceiling.
        onSource({
          content: data.content,
          summary: `Repo ${parsed.owner}/${parsed.repo}@${repoRef || 'HEAD'}: ${data.files} files${data.truncated ? ' (truncated)' : ''}`,
        });
        setOpen(false);
        return;
      }

      if (mode === 'compare') {
        // Accept either a /compare URL or owner/repo + two refs.
        let payload: Record<string, unknown>;
        const parsedUrl = parseCompareRef(compareUrl);
        if (parsedUrl) {
          payload = { mode: 'compare', ...parsedUrl };
        } else {
          const parsedRepo = parseRepoRef(compareUrl);
          if (!parsedRepo) throw new Error('Enter a /compare URL or paste the repo URL plus base/head refs.');
          if (!compareBase.trim() || !compareHead.trim()) throw new Error('Provide both base and head refs.');
          payload = { mode: 'compare', owner: parsedRepo.owner, repo: parsedRepo.repo, base: compareBase.trim(), head: compareHead.trim() };
        }
        const res = await postSource(payload);
        if (!res.ok) throw new Error(friendlyError(await res.text()));
        const data = await res.json();
        const header = `# Compare: ${data.title}\n# ${data.description}${data.truncated ? '\n# Note: diff truncated' : ''}\n\n`;
        onSource({
          content: header + data.content,
          summary: `Compare ${data.title}: ${data.files} files`,
        });
        setOpen(false);
        return;
      }

      if (mode === 'commit') {
        const parsed = parseCommitRef(commitUrl);
        let payload: Record<string, unknown>;
        if (parsed) {
          payload = { mode: 'commit', owner: parsed.owner, repo: parsed.repo, sha: parsed.sha };
        } else {
          const parsedRepo = parseRepoRef(commitUrl);
          if (!parsedRepo) throw new Error('Enter a /commit URL or repo URL plus a commit sha.');
          if (!commitSha.trim()) throw new Error('Provide a commit sha.');
          payload = { mode: 'commit', owner: parsedRepo.owner, repo: parsedRepo.repo, sha: commitSha.trim() };
        }
        const res = await postSource(payload);
        if (!res.ok) throw new Error(friendlyError(await res.text()));
        const data = await res.json();
        const header = `# Commit: ${data.title}\n# ${data.description}${data.truncated ? '\n# Note: diff truncated' : ''}\n\n`;
        onSource({
          content: header + data.content,
          summary: `Commit ${data.title}: ${data.files} files`,
        });
        setOpen(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch from GitHub');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-expanded={open}
      >
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Import from GitHub
        <span className="ml-1 text-gray-400 dark:text-zinc-600">PR · repo · compare · commit</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="gh-picker"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: transitions.soft }}
            exit={{ opacity: 0, height: 0, transition: transitions.snappy }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-2 p-4 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
              {/* Mode tabs */}
              <div role="tablist" className="flex flex-wrap gap-1 mb-3 border-b border-gray-200 dark:border-zinc-800 pb-2">
                {(['pr', 'commit', 'compare', 'repo'] as Mode[]).map((m) => {
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => { setMode(m); setError(''); }}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        active
                          ? 'bg-violet-600 text-white'
                          : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {modeLabel(m)}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-gray-500 dark:text-zinc-500 mb-3">{modeDescription(mode)}</p>

              {/* Per-mode inputs */}
              {mode === 'pr' && (
                <div className="flex flex-col gap-2">
                  <input
                    type="url"
                    inputMode="url"
                    value={prUrl}
                    onChange={(e) => setPrUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo/pull/123"
                    className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:border-violet-500 font-mono"
                    aria-label="PR URL"
                  />
                </div>
              )}

              {mode === 'commit' && (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={commitUrl}
                    onChange={(e) => setCommitUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo/commit/<sha>  — or repo URL"
                    className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:border-violet-500 font-mono"
                    aria-label="Commit URL or repo URL"
                  />
                  {!COMMIT_PATTERN.test(commitUrl.trim()) && (
                    <input
                      type="text"
                      value={commitSha}
                      onChange={(e) => setCommitSha(e.target.value)}
                      placeholder="Commit sha (if you pasted a repo URL above)"
                      className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:border-violet-500 font-mono"
                      aria-label="Commit sha"
                    />
                  )}
                  <p className="text-[11px] text-gray-400 dark:text-zinc-600">
                    Audits the diff introduced by a single commit — useful for catching regressions before merging.
                  </p>
                </div>
              )}

              {mode === 'compare' && (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={compareUrl}
                    onChange={(e) => setCompareUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo/compare/main...feature  — or repo URL"
                    className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:border-violet-500 font-mono"
                    aria-label="Compare URL or repo URL"
                  />
                  {!COMPARE_PATTERN.test(compareUrl.trim()) && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={compareBase}
                        onChange={(e) => setCompareBase(e.target.value)}
                        placeholder="base ref (e.g. main)"
                        className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:border-violet-500 font-mono"
                        aria-label="Base ref"
                      />
                      <input
                        type="text"
                        value={compareHead}
                        onChange={(e) => setCompareHead(e.target.value)}
                        placeholder="head ref (e.g. feature/x)"
                        className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:border-violet-500 font-mono"
                        aria-label="Head ref"
                      />
                    </div>
                  )}
                </div>
              )}

              {mode === 'repo' && (
                <div className="flex flex-col gap-2">
                  <input
                    type="url"
                    inputMode="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:border-violet-500 font-mono"
                    aria-label="Repo URL"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={repoRef}
                      onChange={(e) => setRepoRef(e.target.value)}
                      placeholder="ref (default: HEAD)"
                      className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:border-violet-500 font-mono"
                      aria-label="Repo ref"
                    />
                    <input
                      type="text"
                      value={repoPath}
                      onChange={(e) => setRepoPath(e.target.value)}
                      placeholder="path filter (e.g. app/api)"
                      className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:border-violet-500 font-mono"
                      aria-label="Path filter"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-zinc-600">
                    Lockfiles, binaries, and build artifacts are filtered out. Caps at 60 files / 400KB to stay within audit limits.
                  </p>
                </div>
              )}

              {error && (
                <div role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <motion.button
                  type="button"
                  onClick={handleFetch}
                  disabled={loading || disabled}
                  whileTap={tapScale}
                  className="text-xs px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-500 transition-colors disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed"
                >
                  {loading ? 'Fetching…' : 'Import'}
                </motion.button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
