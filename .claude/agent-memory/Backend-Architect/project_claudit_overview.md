---
name: project-claudit-overview
description: Claudit project context — what it is, the dismissal-learning subsystem, current major surfaces
metadata:
  type: project
---

**Claudit** is an AI code audit platform. Users submit code, server streams findings from Anthropic-backed audit agents, score + structured findings are stored in `audit.result` (text column with `<!-- STRUCTURED_FINDINGS_START -->` markers).

**Key subsystems (as of 2026-05):**
- **Baseline / diff** (`lib/baselines/*`) — `hashFinding()` produces a stable identity across line shifts. `diffAgainstBaseline()` splits new vs pre-existing.
- **Dismissal learning** (`lib/baselines/dismissalLearning.ts`) — net dismiss-minus-restore per `findingHash`; threshold drives suppression today, demotion design added 2026-05-28.
- **Org support** — Better Auth org plugin; dashboard pattern is `statsOwnerId = activeOrgId ?? userId`. Org membership is validated against the `member` table on every audit POST.
- **Audit pipeline** (`app/api/audit/route.ts`) — streams from Anthropic, on completion validates findings against source code, runs adversarial critique, reconciles score, prioritizes, persists.
- **GitHub App** (phase 4 just shipped) — PR audits, install flow, integrations settings.
- **Scheduled audits + webhook pre-deploy gates** — cron-driven runs + CI-blocking webhook.

**Why this shape:**
- Findings are append-only events; current state is reconstructed by replaying dismiss/restore.
- Hash is stable across line shifts but invalidates on rewrite (correct: a fixed bug should re-surface only if reintroduced).
- Scores are reconciled against a deterministic formula because models drift.

**How to apply:**
- New finding-related features should attach to the structured-findings flow inside `makeStream` (between critique and prioritization), not as a separate post-audit pass.
- Org-scoped reads should mirror the `activeOrgId ?? userId` pattern, not invent a new owner abstraction.
- Anything that touches the streamed result must round-trip through JSON in `audit.result` — no binary, no separate columns unless the dashboard queries it directly.
