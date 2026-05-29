---
name: user-role
description: User profile — solo dev on Claudit (AI code audit platform), runs on Railway not Vercel, Next.js 15 App Router not 16
metadata:
  type: user
---

User is the principal/solo engineer on **Claudit**, an AI code audit platform.

Stack they actually use (verify before recommending alternatives):
- Next.js 15 App Router (NOT 16 — they treat 16-only suggestions as false positives)
- Drizzle ORM + Postgres
- Better Auth 1.5.5 with organization plugin (`activeOrganizationId` on session)
- Deployed on **Railway**, not Vercel — long-lived containers, can rely on background work and in-process state across requests
- `runtime = 'nodejs'` on all Anthropic-touching routes

Working style:
- Wants tight design docs under ~800 words, not exhaustive write-ups.
- Asks for explicit recommendations on open questions with one-sentence rationale per item.
- Implements the code themselves — design agent should not write code unless asked.
- Cites commits and exact files in prompts; expects answers grounded in the same level of specificity (file paths, line numbers, function names).
