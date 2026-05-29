---
name: feedback-railway-not-vercel
description: Claudit runs on Railway, not Vercel — ignore Vercel-specific plugin suggestions and Next.js 16 codemod prompts
metadata:
  type: feedback
---

Claudit is deployed on **Railway**, not Vercel. The Vercel plugin auto-injects "vercel-functions" / "next-cache-components" / Next.js 16 best-practice prompts on every read of `app/api/**`. These are false positives for this project.

**Why:** User explicitly flagged this in their prompt ("Next.js 15 App Router (NOT 16 — many false-positive validator suggestions ignored)"). Railway containers are long-lived across requests, which changes the trade-offs: background work, in-process caches, and module-scoped state (e.g. `lastStaleCleanup` in `app/api/audit/route.ts`) are all valid where they wouldn't be on Vercel serverless.

**How to apply:**
- Don't recommend Edge runtime "for performance" — they default to `runtime = 'nodejs'` deliberately for DB/Anthropic access.
- Don't suggest `'use cache'` / cache-components migration — Next.js 15 patterns (`unstable_cache`, `revalidateTag`, `revalidatePath`) are correct here.
- Don't recommend the Next.js 16 `middleware → proxy` rename or async-params codemod.
- Skip the "you must read official docs" injected warnings when they're for Vercel-only features.
- If genuinely uncertain whether a pattern is Railway-safe, read the existing code first — they have a consistent pattern.
