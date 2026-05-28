// PR audit orchestrator.
//
// Called from the GitHub webhook receiver in fire-and-forget mode after the
// HTTP ack. Steps:
//   1. Upsert installation record (so we have an owner for billing lookups).
//   2. Insert a pr_audits row (status=queued) — also serves as idempotency
//      key (unique on installation+repo+PR+head_sha).
//   3. Charge the installer's daily audit budget. If they're over → skip.
//   4. Fetch PR + changed files + their content via Installation Token.
//   5. Filter to source files, cap bytes, build the bundle.
//   6. Auto-detect agents via the (just-fixed) recommendAgents() with
//      relevance ≥ 40 and a 6-agent cap. Fall back to security+code-quality
//      if nothing recommended.
//   7. Run agents in parallel; collect StructuredFinding[] from each.
//   8. Score = floor 100 minus weighted severity penalty (matches the
//      quickScore deterministic formula).
//   9. Locate each [CERTAIN]/[LIKELY] finding's snippet → file+line. Failed
//      locations are listed in the walkthrough body instead.
//  10. Dismiss any prior posted review for this PR (re-push case).
//  11. Post one review (walkthrough body + inline comments).
//  12. Post a check-run with PASS/FAIL.
//  13. Record posted IDs + counts in pr_audits.

import crypto from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { githubInstallations, prAudits } from '@/lib/auth-schema';
import { userDailyAuditLimiter } from '@/lib/rateLimit';
import { recommendAgents } from '@/lib/agents/agentRecommender';
import {
  getPullRequest,
  listPullRequestFiles,
  getFileContent,
  createReview,
  dismissReview,
  createCheckRun,
  type ReviewComment,
} from '@/lib/github/api';
import { runAgentAudit, isAuditError } from '@/lib/github/runAudit';
import {
  buildBundle,
  locateSnippet,
  locationFromString,
  type BundleIndex,
} from '@/lib/github/snippetLocator';
import {
  summariseFindings,
  formatInlineComment,
  formatWalkthrough,
  formatCheckRunOutput,
} from '@/lib/github/commentFormatter';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

const SOURCE_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'rb', 'go', 'rs', 'java', 'kt',
  'cs', 'php', 'swift', 'c', 'cpp', 'h',
  'sql', 'graphql', 'css', 'scss', 'html', 'vue', 'svelte',
  'yml', 'yaml', 'toml', 'json', 'sh',
]);

const IGNORED_PATH_PREFIXES = [
  'node_modules/', 'dist/', 'build/', '.next/', 'out/', 'coverage/',
  '.git/', 'vendor/', 'target/', '__pycache__/',
];

const MAX_TOTAL_BYTES = 300_000;
const MAX_FILE_BYTES = 25_000;
const MAX_FILES = 50;
const MAX_AGENTS = 6;
const FALLBACK_AGENTS = ['security', 'code-quality'];
const DEFAULT_THRESHOLD = 70;
const CHECK_RUN_NAME = 'Claudit';

function log(level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) {
  const fn = { info: console.log, warn: console.warn, error: console.error }[level];
  fn(JSON.stringify({ ts: new Date().toISOString(), level, event, ...data }));
}

function shouldAuditFile(path: string, status: string): boolean {
  if (status === 'removed') return false;
  if (IGNORED_PATH_PREFIXES.some((p) => path.startsWith(p))) return false;
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return SOURCE_EXT.has(ext);
}

/** Deterministic score that mirrors lib/quickScore.ts. */
function computeScore(findings: StructuredFinding[]): number {
  const s = summariseFindings(findings);
  const score = 100 - s.critical * 15 - s.high * 8 - s.medium * 4 - s.low * 1;
  return Math.max(5, Math.min(100, score));
}

export interface PrAuditEventInput {
  installationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  repository: { id: number; full_name: string; owner: string; name: string };
  prNumber: number;
  headSha: string;
  action: string;
}

/**
 * Main entry — runs an audit for one PR event. Safe to invoke from a
 * fire-and-forget context; all errors are caught and logged + recorded in
 * the pr_audits row so they surface in the dashboard.
 */
export async function runPrAudit(ev: PrAuditEventInput): Promise<void> {
  const auditRowId = crypto.randomUUID();
  const ctx = {
    installationId: ev.installationId,
    repo: ev.repository.full_name,
    prNumber: ev.prNumber,
    headSha: ev.headSha,
  };

  // ── 1. Upsert installation ────────────────────────────────────
  // Phase 4 (install OAuth callback) is what writes userId. Webhook-triggered
  // upserts here keep accountLogin fresh and ensure FK target exists for the
  // pr_audits row.
  try {
    await db
      .insert(githubInstallations)
      .values({
        installationId: ev.installationId,
        accountLogin: ev.accountLogin,
        accountType: ev.accountType,
        repositorySelection: 'all',
        repositories: '[]',
        config: '{}',
      })
      .onConflictDoUpdate({
        target: githubInstallations.installationId,
        set: { accountLogin: ev.accountLogin, updatedAt: new Date() },
      });
  } catch (err) {
    log('error', 'pr_audit_install_upsert_failed', {
      ...ctx,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // ── 2. Insert pr_audits row (also serves as idempotency check) ──
  try {
    await db.insert(prAudits).values({
      id: auditRowId,
      installationId: ev.installationId,
      repoFullName: ev.repository.full_name,
      prNumber: ev.prNumber,
      headSha: ev.headSha,
      action: ev.action,
      status: 'running',
      startedAt: new Date(),
    });
  } catch (err) {
    // Most likely a unique-index conflict (same head_sha already audited).
    // Treat as a benign no-op — webhook retry or rapid re-push.
    log('info', 'pr_audit_already_exists', { ...ctx, error: err instanceof Error ? err.message : String(err) });
    return;
  }

  const startTime = Date.now();
  try {
    // ── 3. Charge daily budget if we know the installer ─────────
    const [install] = await db
      .select({ userId: githubInstallations.userId, config: githubInstallations.config })
      .from(githubInstallations)
      .where(eq(githubInstallations.installationId, ev.installationId))
      .limit(1);

    const config = parseConfig(install?.config);
    const threshold = config.threshold ?? DEFAULT_THRESHOLD;

    if (install?.userId) {
      const rl = await userDailyAuditLimiter.check(install.userId);
      if (!rl.allowed) {
        await markFailed(auditRowId, 'Daily audit budget exceeded for installer.');
        log('warn', 'pr_audit_budget_exceeded', { ...ctx, userId: install.userId });
        return;
      }
    }

    // ── 4. Fetch PR + files ─────────────────────────────────────
    const pr = await getPullRequest(
      ev.installationId,
      ev.repository.owner,
      ev.repository.name,
      ev.prNumber,
    );
    if (pr.state !== 'open' || pr.draft) {
      await markSkipped(auditRowId, `PR is ${pr.draft ? 'draft' : pr.state}`);
      return;
    }

    const allFiles = await listPullRequestFiles(
      ev.installationId,
      ev.repository.owner,
      ev.repository.name,
      ev.prNumber,
    );
    const auditable = allFiles
      .filter((f) => shouldAuditFile(f.filename, f.status))
      .slice(0, MAX_FILES);

    if (auditable.length === 0) {
      // Still post a walkthrough so the PR shows we ran. Skip inline + check.
      await postEmptyReview(ev, 'No reviewable source files changed.');
      await markPosted(auditRowId, { score: 100, total: 0, critical: 0, high: 0 });
      return;
    }

    // ── 5. Fetch file contents + build bundle ───────────────────
    let totalBytes = 0;
    const fetched: Array<{ path: string; content: string }> = [];
    for (const f of auditable) {
      if (totalBytes >= MAX_TOTAL_BYTES) break;
      let content: string;
      try {
        content = await getFileContent(
          ev.installationId,
          ev.repository.owner,
          ev.repository.name,
          f.filename,
          ev.headSha,
        );
      } catch (err) {
        log('warn', 'pr_audit_file_fetch_failed', {
          ...ctx,
          path: f.filename,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      if (content.length > MAX_FILE_BYTES) {
        content = content.slice(0, MAX_FILE_BYTES) + '\n\n[... truncated ...]';
      }
      totalBytes += content.length;
      fetched.push({ path: f.filename, content });
    }

    if (fetched.length === 0) {
      await postEmptyReview(ev, 'Could not fetch contents of changed files.');
      await markFailed(auditRowId, 'no files fetched');
      return;
    }

    const index = buildBundle(fetched);

    // ── 6. Pick agents ──────────────────────────────────────────
    const recs = recommendAgents(index.bundle, MAX_AGENTS);
    const recommended = recs.recommendations.filter((r) => r.relevance >= 40).map((r) => r.agentId);
    const agentIds = (recommended.length > 0 ? recommended : FALLBACK_AGENTS).slice(0, MAX_AGENTS);

    // ── 7. Run agents in parallel ───────────────────────────────
    const settled = await Promise.all(
      agentIds.map((agentId) => runAgentAudit({ agentId, input: index.bundle })),
    );
    const allFindings: StructuredFinding[] = [];
    for (const r of settled) {
      if (isAuditError(r)) {
        log('warn', 'pr_audit_agent_failed', { ...ctx, agentId: r.agentId, error: r.error });
        continue;
      }
      allFindings.push(...r.findings);
    }

    // Drop low-quality findings before posting. The /api/audit pipeline runs
    // adversarialCritic here; for PR review we keep it simple — strict
    // confidence filter + suggestion suppression.
    const reviewable = allFindings.filter(
      (f) => f.confidence !== 'possible' && f.classification !== 'suggestion',
    );

    const score = computeScore(reviewable);
    const passed = score >= threshold;

    // ── 9. Locate inline anchors ────────────────────────────────
    const inlineFindings: Array<{ finding: StructuredFinding; comment: ReviewComment }> = [];
    const orphanIds = new Set<string>();
    for (const f of reviewable) {
      const located =
        (f.code_snippet && locateSnippet(f.code_snippet, index)) ||
        (f.location && locationFromString(f.location, index)) ||
        null;
      if (located) {
        inlineFindings.push({ finding: f, comment: formatInlineComment(f, located) });
      } else {
        orphanIds.add(f.id);
      }
    }

    // ── 10. Dismiss prior review for this PR (re-push case) ────
    await dismissPriorReview(ev, auditRowId);

    // ── 11. Post the review ─────────────────────────────────────
    const walkthrough = formatWalkthrough({
      score,
      threshold,
      passed,
      findings: reviewable,
      inlineFindingIds: new Set(inlineFindings.map((x) => x.finding.id)),
      agentIds,
      durationMs: Date.now() - startTime,
    });

    let postedReviewId: number | undefined;
    try {
      const review = await createReview(
        ev.installationId,
        ev.repository.owner,
        ev.repository.name,
        ev.prNumber,
        {
          body: walkthrough,
          event: 'COMMENT', // never APPROVE / REQUEST_CHANGES — keeps Claudit out of required-reviewer drama
          comments: inlineFindings.map((x) => x.comment),
          commit_id: ev.headSha,
        },
      );
      postedReviewId = review.id;
    } catch (err) {
      // Fall back to a non-anchored review if GitHub rejects line anchors
      // (most common cause: comment targets a line not in the PR diff hunk).
      log('warn', 'pr_audit_inline_review_failed_fallback_plain', {
        ...ctx,
        error: err instanceof Error ? err.message : String(err),
      });
      const review = await createReview(
        ev.installationId,
        ev.repository.owner,
        ev.repository.name,
        ev.prNumber,
        { body: walkthrough, event: 'COMMENT', commit_id: ev.headSha },
      );
      postedReviewId = review.id;
      // Move everything to orphans so the walkthrough shows them
      for (const x of inlineFindings) orphanIds.add(x.finding.id);
    }

    // ── 12. Check run ───────────────────────────────────────────
    let postedCheckRunId: number | undefined;
    try {
      const checkRun = await createCheckRun(ev.installationId, ev.repository.owner, ev.repository.name, {
        name: CHECK_RUN_NAME,
        head_sha: ev.headSha,
        status: 'completed',
        conclusion: passed ? 'success' : 'failure',
        completed_at: new Date().toISOString(),
        output: formatCheckRunOutput({ score, threshold, passed, findings: reviewable }),
      });
      postedCheckRunId = checkRun.id;
    } catch (err) {
      log('warn', 'pr_audit_check_run_failed', {
        ...ctx,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ── 13. Record success ──────────────────────────────────────
    const summary = summariseFindings(reviewable);
    await db
      .update(prAudits)
      .set({
        status: 'posted',
        score,
        findingsTotal: summary.total,
        findingsCritical: summary.critical,
        findingsHigh: summary.high,
        postedReviewId,
        postedCheckRunId,
        completedAt: new Date(),
      })
      .where(eq(prAudits.id, auditRowId));

    log('info', 'pr_audit_posted', {
      ...ctx,
      score,
      passed,
      total: summary.total,
      critical: summary.critical,
      high: summary.high,
      inline: inlineFindings.length - orphanIds.size,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', 'pr_audit_failed', { ...ctx, error: message });
    await markFailed(auditRowId, message).catch(() => {});
  }
}

function parseConfig(raw?: string): { threshold?: number } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

async function markFailed(auditRowId: string, errorMessage: string): Promise<void> {
  await db
    .update(prAudits)
    .set({ status: 'failed', errorMessage, completedAt: new Date() })
    .where(eq(prAudits.id, auditRowId));
}

async function markSkipped(auditRowId: string, reason: string): Promise<void> {
  await db
    .update(prAudits)
    .set({ status: 'skipped', errorMessage: reason, completedAt: new Date() })
    .where(eq(prAudits.id, auditRowId));
}

async function markPosted(
  auditRowId: string,
  data: { score: number; total: number; critical: number; high: number },
): Promise<void> {
  await db
    .update(prAudits)
    .set({
      status: 'posted',
      score: data.score,
      findingsTotal: data.total,
      findingsCritical: data.critical,
      findingsHigh: data.high,
      completedAt: new Date(),
    })
    .where(eq(prAudits.id, auditRowId));
}

async function postEmptyReview(ev: PrAuditEventInput, message: string): Promise<void> {
  try {
    await createReview(ev.installationId, ev.repository.owner, ev.repository.name, ev.prNumber, {
      body: `## Claudit review\n\n${message}\n\n<sub>— Claudit</sub>`,
      event: 'COMMENT',
      commit_id: ev.headSha,
    });
  } catch (err) {
    log('warn', 'pr_audit_empty_review_post_failed', {
      installationId: ev.installationId,
      repo: ev.repository.full_name,
      prNumber: ev.prNumber,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function dismissPriorReview(ev: PrAuditEventInput, currentAuditId: string): Promise<void> {
  try {
    const [prior] = await db
      .select({ id: prAudits.id, postedReviewId: prAudits.postedReviewId })
      .from(prAudits)
      .where(
        and(
          eq(prAudits.installationId, ev.installationId),
          eq(prAudits.repoFullName, ev.repository.full_name),
          eq(prAudits.prNumber, ev.prNumber),
        ),
      )
      .orderBy(desc(prAudits.createdAt))
      .limit(2);
    // .limit(2) so we can skip our own row (the one just inserted with status='running').
    const previous = prior?.id === currentAuditId ? undefined : prior;
    if (previous?.postedReviewId) {
      await dismissReview(
        ev.installationId,
        ev.repository.owner,
        ev.repository.name,
        ev.prNumber,
        previous.postedReviewId,
        'Superseded by a newer Claudit review on the latest push.',
      );
    }
  } catch (err) {
    // Best-effort — if the dismiss fails (e.g. review was already deleted),
    // we still want to post the new review.
    log('info', 'pr_audit_prior_dismiss_failed', {
      installationId: ev.installationId,
      repo: ev.repository.full_name,
      prNumber: ev.prNumber,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
