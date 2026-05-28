// GitHub App webhook receiver.
//
// Acks GitHub within ~10s (their timeout) by validating the HMAC signature,
// classifying the event, then handing the work off to a fire-and-forget
// background task. The audit itself runs for 60-180s — too long to block
// the webhook response on. Railway containers stay alive across requests so
// the background promise will complete.
//
// Idempotency: dedupes by (installation_id, repo_id, pr_number, head_sha) so
// rapid pushes / GitHub redelivery don't trigger duplicate audits.
//
// Currently wires:
//   - ping (returns pong, GitHub uses this to verify webhook reachability)
//   - installation (created/deleted/suspend/unsuspend — DB persistence in phase 3)
//   - pull_request (opened, reopened, synchronize → kicks off PR audit in phase 3)
//
// Phase 3 will replace the runPrAudit() stub with the real orchestrator in
// lib/github/prAudit.ts.

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { verifyWebhookSignature } from '@/lib/github/app';
import { RateLimiter } from '@/lib/rateLimit';
import { runPrAudit } from '@/lib/github/prAudit';
import { db } from '@/lib/db';
import { githubInstallations } from '@/lib/auth-schema';

export const runtime = 'nodejs';

// Lenient per-IP limit — GitHub's own IPs are the legitimate caller, so this
// only catches misconfigured proxies or replay floods. Real abuse protection
// is the HMAC signature check.
const githubWebhookLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 300,
  prefix: 'gh-webhook',
});

// In-process idempotency — prevents duplicate audits when GitHub retries a
// delivery or sends synchronize back-to-back. Keyed by delivery ID where
// possible, falling back to a composite of repo+PR+sha.
// Resets on cold start, which is fine — duplicate audits within minutes are
// the failure mode we care about; across deploys it's harmless.
const recentDeliveries = new Map<string, number>();
const DELIVERY_TTL_MS = 10 * 60_000;

function rememberDelivery(key: string): boolean {
  const now = Date.now();
  // Lazy GC — keep map size bounded
  if (recentDeliveries.size > 5_000) {
    for (const [k, t] of recentDeliveries) {
      if (now - t > DELIVERY_TTL_MS) recentDeliveries.delete(k);
    }
  }
  const existing = recentDeliveries.get(key);
  if (existing && now - existing < DELIVERY_TTL_MS) return false;
  recentDeliveries.set(key, now);
  return true;
}

function log(level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) {
  const fn = { info: console.log, warn: console.warn, error: console.error }[level];
  fn(JSON.stringify({ ts: new Date().toISOString(), level, event, ...data }));
}

interface PullRequestEvent {
  action: string;
  number: number;
  pull_request: {
    number: number;
    state: string;
    draft: boolean;
    head: { sha: string; ref: string };
    base: { ref: string };
    user: { login: string } | null;
  };
  repository: {
    id: number;
    full_name: string;
    owner: { login: string; type?: 'User' | 'Organization' };
    name: string;
  };
  installation: { id: number };
  sender: { login: string };
}

interface InstallationEvent {
  // `installation` action set
  // `installation_repositories` actions: 'added' | 'removed'
  action: 'created' | 'deleted' | 'suspend' | 'unsuspend' | 'new_permissions_accepted' | 'added' | 'removed';
  installation: {
    id: number;
    account: { login: string; type: 'User' | 'Organization' };
    repository_selection: 'all' | 'selected';
  };
  // Full repo list on 'installation' events.
  repositories?: Array<{ id: number; full_name: string }>;
  // Delta lists on 'installation_repositories' events.
  repositories_added?:   Array<{ id: number; full_name: string }>;
  repositories_removed?: Array<{ id: number; full_name: string }>;
  sender: { login: string };
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';
  const rl = await githubWebhookLimiter.check(ip);
  if (!rl.allowed) {
    return new Response('Too many requests', { status: 429, headers: rl.headers });
  }

  // GitHub sends the raw body; we need the exact bytes for HMAC verification,
  // so we must read it as text before parsing.
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  if (!verifyWebhookSignature(rawBody, signature)) {
    log('warn', 'gh_webhook_bad_signature', { ip });
    return new Response('Invalid signature', { status: 401 });
  }

  const event = req.headers.get('x-github-event');
  const deliveryId = req.headers.get('x-github-delivery') ?? '';

  if (!event) return new Response('Missing event', { status: 400 });

  // Ping is GitHub's reachability check — return 200 with a body
  if (event === 'ping') {
    log('info', 'gh_webhook_ping', { deliveryId });
    return Response.json({ pong: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Per-event idempotency
  if (deliveryId && !rememberDelivery(deliveryId)) {
    log('info', 'gh_webhook_duplicate_delivery', { deliveryId, event });
    return Response.json({ deduped: true });
  }

  switch (event) {
    case 'installation':
    case 'installation_repositories': {
      const ev = payload as InstallationEvent;
      log('info', 'gh_webhook_installation', {
        action: ev.action,
        installationId: ev.installation.id,
        account: ev.installation.account.login,
        accountType: ev.installation.account.type,
        repoCount: ev.repositories?.length ?? 0,
      });

      // installation.deleted = user uninstalled the App on GitHub. Clean up
      // our local row so the integrations page no longer lists it. Cascading
      // delete also removes the related pr_audits rows.
      if (ev.action === 'deleted') {
        try {
          await db
            .delete(githubInstallations)
            .where(eq(githubInstallations.installationId, ev.installation.id));
        } catch (err) {
          log('warn', 'gh_install_delete_failed', {
            installationId: ev.installation.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        return Response.json({ ok: true });
      }

      // Selection or repo-list changes — sync repositorySelection +
      // repositories JSON so the integrations page reflects reality
      // (previously the warning banner showed "all repositories" even
      // after the user switched to specific repos).
      const isSelectionEvent =
        event === 'installation_repositories' ||
        (event === 'installation' && (ev.action === 'created' || ev.action === 'new_permissions_accepted' || ev.action === 'unsuspend'));

      if (isSelectionEvent) {
        try {
          // For 'installation_repositories.added/removed', GitHub sends the
          // current full repository_selection plus delta lists. Re-fetch the
          // full list from the API so our DB carries the complete set —
          // delta-merging client-side would drift over time on missed
          // deliveries.
          let repositoriesJson: string | null = null;
          if (ev.installation.repository_selection === 'selected') {
            try {
              const { getInstallationToken } = await import('@/lib/github/app');
              const token = await getInstallationToken(ev.installation.id);
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
                const data = (await res.json()) as { repositories: Array<{ id: number; full_name: string }> };
                repositoriesJson = JSON.stringify(
                  data.repositories.slice(0, 200).map((r) => ({ id: r.id, full_name: r.full_name })),
                );
              }
            } catch (err) {
              log('warn', 'gh_install_repo_refetch_failed', {
                installationId: ev.installation.id,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          } else {
            // repository_selection === 'all' — empty list is the right value.
            repositoriesJson = '[]';
          }

          // Build the set clause. We always update the selection mode;
          // repositories only when the fetch succeeded.
          const setClause: Record<string, unknown> = {
            repositorySelection: ev.installation.repository_selection,
            accountLogin: ev.installation.account.login,
            accountType: ev.installation.account.type,
            suspendedAt: ev.action === 'unsuspend' ? null : undefined,
            updatedAt: new Date(),
          };
          if (repositoriesJson !== null) setClause.repositories = repositoriesJson;

          await db
            .update(githubInstallations)
            .set(setClause)
            .where(eq(githubInstallations.installationId, ev.installation.id));

          log('info', 'gh_install_synced', {
            installationId: ev.installation.id,
            selection: ev.installation.repository_selection,
            repoCount: ev.repositories?.length ?? ev.repositories_added?.length ?? 0,
          });
        } catch (err) {
          log('warn', 'gh_install_sync_failed', {
            installationId: ev.installation.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        return Response.json({ ok: true });
      }

      // 'suspend' — leave the row as-is; user can still see the install
      // in the UI marked suspended. Orchestrator would fail on next audit
      // attempt at which point we record it.
      if (ev.action === 'suspend') {
        try {
          await db
            .update(githubInstallations)
            .set({ suspendedAt: new Date(), updatedAt: new Date() })
            .where(eq(githubInstallations.installationId, ev.installation.id));
        } catch (err) {
          log('warn', 'gh_install_suspend_failed', {
            installationId: ev.installation.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return Response.json({ ok: true });
    }

    case 'pull_request': {
      const ev = payload as PullRequestEvent;
      // We only audit on these actions; ignore label/assign/comment/etc.
      const auditable = new Set(['opened', 'reopened', 'synchronize', 'ready_for_review']);
      if (!auditable.has(ev.action)) {
        return Response.json({ skipped: ev.action });
      }
      // Skip draft PRs until they're marked ready — saves spend on WIP code.
      if (ev.pull_request.draft && ev.action !== 'ready_for_review') {
        return Response.json({ skipped: 'draft' });
      }

      const dedupeKey = `${ev.installation.id}:${ev.repository.id}:${ev.pull_request.number}:${ev.pull_request.head.sha}`;
      if (!rememberDelivery(`pr:${dedupeKey}`)) {
        log('info', 'gh_webhook_pr_already_audited', { dedupeKey });
        return Response.json({ deduped: true });
      }

      log('info', 'gh_webhook_pr_queued', {
        deliveryId,
        action: ev.action,
        repo: ev.repository.full_name,
        prNumber: ev.pull_request.number,
        headSha: ev.pull_request.head.sha,
        installationId: ev.installation.id,
      });

      // Fire-and-forget. Railway containers stay alive across requests; we
      // intentionally don't await so we can ack within GitHub's 10s window.
      runPrAudit({
        installationId: ev.installation.id,
        accountLogin: ev.repository.owner.login,
        // GitHub's pull_request payload only includes owner.type for repos
        // owned by orgs; for personal repos it's omitted. Default to 'User'.
        accountType: ev.repository.owner.type ?? 'User',
        repository: {
          id: ev.repository.id,
          full_name: ev.repository.full_name,
          owner: ev.repository.owner.login,
          name: ev.repository.name,
        },
        prNumber: ev.pull_request.number,
        headSha: ev.pull_request.head.sha,
        action: ev.action,
      }).catch((err) => {
        log('error', 'gh_pr_audit_unhandled', {
          repo: ev.repository.full_name,
          prNumber: ev.pull_request.number,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      return Response.json({ queued: true });
    }

    default:
      // Unhandled event types (push, check_run, etc.) — ack to stop GitHub retrying.
      return Response.json({ ignored: event });
  }
}
