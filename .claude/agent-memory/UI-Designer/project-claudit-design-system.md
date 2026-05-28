---
name: project-claudit-design-system
description: Claudit design system tokens and conventions — dark theme, violet accent, aurora blobs, landing page patterns
metadata:
  type: project
---

Claudit (claudit.consulting) uses a strict dark design language. All values are production-verified from HeroSection.tsx and globals.css.

**Core tokens:**
- Body: `bg-zinc-950 text-zinc-100`
- Card: `bg-zinc-900 border border-zinc-800 rounded-2xl`
- Terminal/code surface: `bg-zinc-950`
- Primary accent: `violet-400` (text), `violet-600` (bg/button)
- Secondary: `indigo-600`
- Muted text: `text-zinc-400`, `text-zinc-500`

**CSS utilities (globals.css):**
- `.text-gradient` — static white→violet gradient (135deg, #fff 0%, #c4b5fd 40%, #818cf8 100%)
- `.text-gradient-animated` — cycling gradient (300% bg-size, gradient-x 6s keyframe)
- `.glow-violet` — multi-layer box-shadow: 0 0 0 1px rgba(139,92,246,0.15), 0 8px 32px -8px rgba(139,92,246,0.45), 0 0 60px -20px rgba(139,92,246,0.3)
- `.glow-violet-sm` — 0 4px 20px -4px rgba(139,92,246,0.35)
- `.glass` — bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm border border-white/40 dark:border-zinc-700/50
- `.bg-grid-pattern` — radial-gradient dot grid, 24px×24px, rgba(255,255,255,0.06)
- `@keyframes aurora` — 0%,100% opacity:0.6 scale(1) translateY(0) → 50% opacity:1 scale(1.08) translateY(-12px)

**Landing page badge pattern (HeroSection.tsx:25):**
`bg-violet-950/60 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full border border-violet-800/50`
Pulsing dot: `w-1.5 h-1.5 bg-violet-400 rounded-full motion-safe:animate-pulse`

**CTA button pattern (HeroSection.tsx:52):**
`bg-violet-600 hover:bg-violet-500 rounded-xl hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-900/40`

**Why:** Site uses landing-page patterns as source of truth; CodeAuditPanel.tsx was built before design system solidified so it uses lighter grays (bg-gray-50, border-gray-300) that don't match the dark brand.

**How to apply:** When redesigning any page component, use tokens from this system. bg-gray-50/border-gray-300 on dark surfaces should be replaced with bg-zinc-950/border-zinc-800.
