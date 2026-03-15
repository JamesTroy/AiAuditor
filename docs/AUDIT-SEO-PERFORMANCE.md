# SEO & Performance Audit — Content Collection

**URL being audited:** https://claudit.dev (all public routes)
**Page type:** SaaS landing page + multi-page app (50 audit agent pages, dashboard, auth)
**Framework:** Next.js 15.5.12 (App Router, SSR + SSG + ISR), React 19.2.4, TypeScript 5.9
**Target keywords:** "AI code audit", "code quality audit", "security audit tool", "AI-powered code review"
**Known concerns:** Home page is `'use client'` (no SSR), no OG images, no JSON-LD structured data, no analytics

---

## --- HTML `<head>` ---

### Root layout metadata (`app/layout.tsx`)

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.dev';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Claudit — AI-Powered Code Audits',
    template: '%s | Claudit',
  },
  description:
    'Instant AI-powered audits for code quality, security, and performance. 50 specialized agents powered by Claude.',
  icons: { icon: '/logo.svg' },
  openGraph: {
    type: 'website',
    siteName: 'Claudit',
    title: 'Claudit — AI-Powered Code Audits',
    description:
      'Instant AI-powered audits for code quality, security, and performance. 50 specialized agents powered by Claude.',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary',
    title: 'Claudit — AI-Powered Code Audits',
    description:
      'Instant AI-powered audits for code quality, security, and performance. 50 specialized agents powered by Claude.',
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

**Rendered `<html>` tag:** `<html lang="en" className="dark">`

### Title tags by page

| Page | Title | Source |
|------|-------|--------|
| Home `/` | `Claudit — AI-Powered Code Audits` | Root layout default |
| Stack `/stack` | `Tech Stack \| Claudit` | `app/stack/page.tsx` metadata |
| Dashboard `/dashboard` | `Dashboard \| Claudit` | `app/dashboard/page.tsx` metadata |
| Site Audit `/site-audit` | `Full Site Audit \| Claudit` | `app/site-audit/layout.tsx` metadata |
| Agent pages `/audit/[agent]` | `{Agent Name} Audit \| Claudit` | Dynamic `generateMetadata()` |
| Login `/login` | Inherits default (no override) | — |
| Signup `/signup` | Inherits default (no override) | — |

### Meta description

**Root:** `Instant AI-powered audits for code quality, security, and performance. 50 specialized agents powered by Claude.`

**Per page overrides:**
- Stack: `The full technology stack behind Claudit — Next.js 15, React 19, Claude Sonnet 4.6, Better Auth, Drizzle ORM, and Tailwind CSS.`
- Dashboard: `View your audit history, scores, and trends.`
- Site Audit: `Enter a website URL and get an instant AI-powered audit across security, SEO, accessibility, performance, responsive design, and code quality.`
- Agent pages: Dynamic — uses `agent.description` from registry

### Open Graph tags

- **og:type:** `website`
- **og:site_name:** `Claudit`
- **og:title:** `Claudit — AI-Powered Code Audits` (root), `{Agent Name} — Claudit` (agent pages)
- **og:description:** Same as meta description
- **og:url:** `https://claudit.dev` (root only)
- **og:image:** **MISSING** — No OG image configured anywhere

### Twitter Card tags

- **twitter:card:** `summary` (not `summary_large_image`)
- **twitter:title:** `Claudit — AI-Powered Code Audits`
- **twitter:description:** Same as meta description
- **twitter:image:** **MISSING**
- **twitter:site / twitter:creator:** **MISSING**

### Canonical URL

- No explicit `<link rel="canonical">` — relies on `metadataBase` + Next.js automatic canonical generation
- `metadataBase` set to `https://claudit.dev`

### Hreflang tags

- **NONE** — Single language (English only)

### Preconnect / preload / prefetch hints

- **NONE explicitly configured** in any layout or page
- Next.js auto-preloads the Inter font from Google Fonts
- No preconnect to `fonts.googleapis.com` or `fonts.gstatic.com` (handled internally by `next/font/google`)

### Font loading

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });
// Applied via: <body className={inter.className}>
```

- **Font:** Inter (Google Fonts, self-hosted by Next.js)
- **Subsets:** Latin only
- **font-display:** `swap` (Next.js default for `next/font`)
- **No additional @font-face rules** in globals.css

### Favicon / icons

```typescript
icons: { icon: '/logo.svg' }
```

- Single SVG favicon at `public/logo.svg`
- **No apple-touch-icon** declared
- **No manifest.json / site.webmanifest**
- **No favicon.ico fallback**

---

## --- HTML `<body>` ---

### Body structure (`app/layout.tsx`)

```html
<body class="{inter.className} bg-gray-50 dark:bg-zinc-950 transition-colors duration-200">
  <ThemeProvider>
    <SmoothScroll />
    <div class="flex flex-col min-h-screen">
      <Navbar />           <!-- sticky nav with skip-to-content link -->
      <main id="main-content" class="flex-1">{children}</main>
      <Footer />
    </div>
  </ThemeProvider>
</body>
```

### Heading hierarchy

**Home page (`/`) — `'use client'`:**
- H1: `Claudit` (text-[clamp(1.875rem,4vw+0.5rem,3.5rem)])
- H2: `⭐ Pinned` (conditional, if pinned agents exist)
- H2: `Code Quality`, `Security & Privacy`, `Performance`, `Infrastructure`, `Design` (category sections)
- H3: Agent names within AgentCard components (50 cards)
- **Issue:** "How it works" section uses `<p>` tags with `font-semibold`, not semantic headings

**Stack page (`/stack`) — Server Component:**
- H1: `The Stack Behind Claudit`
- H2: `How Claudit Works`, `The Full Stack`, `Why This Beats the Alternatives`, `What Better Auth Gives You Out of the Box`, `Cost: ~$30/mo`, `Get Started in 5 Minutes`, `Architecture`
- **Good heading hierarchy** — well-structured

**Dashboard (`/dashboard`) — Server Component (async):**
- H1: `Dashboard`
- H2: `Recent audits`

**Site Audit (`/site-audit`) — `'use client'`:**
- H1: `Full Site Audit`
- H2: `6 agents will analyze your site` (conditional, idle state only)

**Agent pages (`/audit/[agent]`) — Server Component (SSG+ISR):**
- Breadcrumb nav: Agents / Category / Agent Name
- H1: `{agent.name}` (dynamic)
- No H2s — content is in AuditInterface streaming area

### Image tags

**No `<img>` or `next/image` `<Image>` components found in the entire codebase.**

All visual elements are:
- Inline SVGs (Logo component with `aria-hidden="true"`)
- Emoji icons in AgentCard (with `role="img"` and `aria-label`)
- CSS gradients and patterns (decorative)

**No raster images, no srcset, no alt text issues (because no images exist)**

### Internal links

**Navbar (5 links):**
- `/` → Agents
- `/site-audit` → Site Audit
- `/dashboard` → Dashboard
- `/history` → History
- `/stack` → Stack

**Home page:** 50 agent links → `/audit/{agent.id}` (via Next.js `<Link>`)

**Footer:**
- `/` → Claudit logo
- `/stack` → Stack

**Agent pages:** Breadcrumb with link to `/` (Agents)

### External links

- `https://github.com/JamesTroy/AiAuditor` — Footer, has `target="_blank" rel="noopener noreferrer"`
- `https://better-auth.com/docs/plugins` — Stack page, has `target="_blank" rel="noopener noreferrer"`

### Lazy loading / infinite scroll

- **No lazy-loaded content**
- **No infinite scroll**
- Loading skeletons via Next.js `loading.tsx` files (5 total):
  - `app/loading.tsx`, `app/site-audit/loading.tsx`, `app/dashboard/loading.tsx`, `app/audit/[agent]/loading.tsx`, `app/history/loading.tsx`
  - All use `animate-pulse` Tailwind class

---

## --- Structured Data (JSON-LD) ---

**NONE** — No JSON-LD, microdata, or RDFa markup found anywhere in the codebase.

Missing opportunities:
- `SoftwareApplication` schema for the product
- `Organization` schema for Claudit
- `BreadcrumbList` schema on agent pages (breadcrumbs exist in HTML but no structured data)
- `WebSite` schema with `SearchAction` (search exists on home page)
- `FAQPage` or `HowTo` schema for the Stack page content

---

## --- robots.txt ---

**Source:** `app/robots.ts` (dynamic generation)

```typescript
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/settings', '/history'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
```

**Rendered output:**
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard
Disallow: /settings
Disallow: /history

Sitemap: https://claudit.dev/sitemap.xml
```

**Notes:**
- `/site-audit` is **allowed** for crawling (correct — it's a public feature page)
- `/audit/*` agent pages are **allowed** (correct — they're the main content)
- Auth pages (`/login`, `/signup`) are **allowed** — present in sitemap too
- No crawl-delay specified

---

## --- sitemap.xml ---

**Source:** `app/sitemap.ts` (dynamic generation)

```typescript
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/stack`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const agentRoutes = agents.map((agent) => ({
    url: `${BASE_URL}/audit/${agent.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...agentRoutes];
}
```

**Issues:**
- `/site-audit` page is **MISSING** from sitemap (public feature page, should be included)
- `lastModified` is always `new Date()` (current time) — not reflecting actual content changes
- Login/signup pages have low priority (0.3) — consider removing from sitemap entirely since they have no SEO value
- No agent category or tag pages in sitemap

---

## --- Redirects / Rewrites ---

**next.config.ts:** No redirects or rewrites configured. Only security headers.

**middleware.ts redirects:**
- Unauthenticated users → `/login?callbackUrl={path}` (for protected routes: `/dashboard`, `/settings`, `/admin`)
- Authenticated users → `/dashboard` (when visiting `/login`, `/signup`, `/forgot-password`)

---

## --- Security Headers ---

**next.config.ts (static headers, all routes):**
```
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**middleware.ts (dynamic, per-request):**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{nonce}' 'strict-dynamic' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com;
  connect-src 'self';
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests
```

---

## --- Performance Metrics ---

### `next build` output — Page sizes

```
Route (app)                                 Size  First Load JS
┌ ƒ /                                    14.2 kB         220 kB
├ ƒ /_not-found                            161 B         102 kB
├ ● /audit/[agent]                         981 B         246 kB
├ ƒ /audit/custom/[id]                   1.63 kB         247 kB
├ ƒ /dashboard                             161 B         106 kB
├ ƒ /forgot-password                     1.29 kB         107 kB
├ ƒ /history                             3.22 kB         142 kB
├ ƒ /login                                2.5 kB         123 kB
├ ○ /robots.txt                            161 B         102 kB
├ ƒ /settings                            1.85 kB         119 kB
├ ƒ /signup                               2.6 kB         123 kB
├ ƒ /site-audit                          3.63 kB         140 kB
├ ○ /sitemap.xml                           161 B         102 kB
├ ƒ /stack                                 161 B         102 kB
└ ƒ /two-factor                          1.24 kB         118 kB
+ First Load JS shared by all             102 kB
  ├ chunks/255-ebd51be49873d76c.js         46 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.92 kB

ƒ Middleware                               64 kB
```

### Rendering strategy per page

| Page | Strategy | Notes |
|------|----------|-------|
| `/` | `ƒ` Dynamic (client) | `'use client'` — entire home page is client-rendered |
| `/stack` | `ƒ` Dynamic (server) | Server Component but not statically generated |
| `/audit/[agent]` | `●` SSG + ISR | `revalidate: 3600` (1 hour), `generateStaticParams()` for 50 agents |
| `/site-audit` | `ƒ` Dynamic (client) | `'use client'` — streaming UI |
| `/dashboard` | `ƒ` Dynamic (server) | `async`, requires auth session |
| `/login`, `/signup` | `ƒ` Dynamic (client) | `'use client'` |
| `/robots.txt`, `/sitemap.xml` | `○` Static | Prerendered |

### First Load JS analysis

- **Shared JS bundle:** 102 kB (all pages load this)
- **Home page:** 220 kB total (14.2 kB page + 102 kB shared + motion + agent data)
- **Audit pages:** 246 kB total (heaviest — includes AuditInterface + markdown renderer)
- **Stack page:** 102 kB total (server-rendered, no page JS)

### Key JS dependencies contributing to bundle

| Package | Purpose | Size impact |
|---------|---------|-------------|
| `motion` (12.36.0) | Hover/tap animations on AgentCard | ~20 kB |
| `lenis` (1.3.18) | Smooth scrolling | ~8 kB |
| `react-markdown` (9.1.0) | Markdown rendering in audit results | ~30 kB |
| `zod` (4.3.6) | Schema validation | ~12 kB |

### Build warnings

```
./node_modules/jose/dist/webapi/lib/deflate.js
A Node.js API is used (CompressionStream at line: 10) which is not supported in the Edge Runtime.
```
(From better-auth's cookie handling — only affects middleware, not pages)

---

## --- CSS ---

### globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom keyframes: fade-up, star-pop, blink, shimmer, slide-in */
/* Focus utility: .focus-ring */
/* Grid pattern: .bg-grid-pattern (radial-gradient) */
/* Text gradient: .text-gradient */

html { scroll-padding-top: 4rem; }

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### PostCSS config

```javascript
{ plugins: { tailwindcss: {}, autoprefixer: {} } }
```

---

## --- Analytics / Tracking ---

**NONE** — No analytics scripts found:
- No Google Analytics / gtag
- No Segment
- No Hotjar / Clarity
- No Facebook Pixel
- No Plausible / Fathom / Umami
- No performance monitoring (no Web Vitals reporting)

---

## --- Dependencies ---

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "0.78.0",
    "better-auth": "1.5.5",
    "drizzle-orm": "0.45.1",
    "lenis": "^1.3.18",
    "motion": "^12.36.0",
    "next": "15.5.12",
    "postgres": "3.4.8",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-markdown": "9.1.0",
    "resend": "6.9.3",
    "zod": "4.3.6"
  },
  "devDependencies": {
    "@tailwindcss/typography": "0.5.19",
    "autoprefixer": "10.4.27",
    "drizzle-kit": "^0.31.9",
    "postcss": "8.5.8",
    "tailwindcss": "3.4.19",
    "typescript": "5.9.3",
    "vitest": "^4.1.0"
  }
}
```

---

## --- Don't Forget Checklist ---

- [x] **Rendered HTML vs JSX:** Home page is `'use client'` — search engines with JS rendering will see content, but initial HTML payload contains no agent data. Agent pages (`/audit/[agent]`) are SSG — full HTML rendered at build time.
- [x] **Alt text:** No `<img>` tags exist. SVGs use `aria-hidden="true"`. Emoji icons use `role="img"` with `aria-label`.
- [x] **Server-rendered vs client:** Mixed — see rendering strategy table above. Home page (most important for SEO) is client-only.
- [x] **A/B test scripts:** None
- [x] **Marketing tags:** None
- [x] **Primary CTA:** "Start audit →" on each AgentCard → links to `/audit/{id}`
- [x] **Conversion goal:** Get users to run an AI audit (paste code → stream results)

---

## --- Summary of Key Gaps ---

1. **Home page is `'use client'`** — no SSR, Google must render JS to see agent cards and headings
2. **No OG image** — social shares show no preview image
3. **No JSON-LD structured data** — missing SoftwareApplication, Organization, BreadcrumbList schemas
4. **No analytics** — no way to measure organic traffic, Core Web Vitals, or conversions
5. **Missing from sitemap:** `/site-audit` page not included
6. **No apple-touch-icon or favicon.ico** — only SVG favicon
7. **220 kB First Load JS on home** — `motion` and `lenis` add weight for decorative animations
8. **"How it works" section uses `<p>` not `<h2>`** — missed heading hierarchy on home page
9. **Twitter card is `summary`** not `summary_large_image` — smaller preview in social feeds
10. **`lastModified` in sitemap is always `new Date()`** — not reflecting actual content change dates
