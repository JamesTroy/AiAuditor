// ARCH-005: Registry metadata only — system prompts live in ./prompts.ts.
import { AgentConfig } from '../types';
import { SYSTEM_PROMPTS } from './prompts';

export const agents: AgentConfig[] = [
  {
    id: 'code-quality',
    name: 'Code Quality',
    description: 'Detects bugs, anti-patterns, and style issues across any language.',
    category: 'Code Quality',
    accentClass: 'text-blue-400 hover:bg-blue-500/10',
    buttonClass: 'bg-blue-700 hover:bg-blue-600',
    placeholder: 'Paste your code here...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['code-quality'],
    prepPrompt: `I'm preparing code for a **Code Quality** audit. Please help me collect and format the relevant files from my project.

## Project context (fill in)
- Language / framework: [e.g. TypeScript + Next.js 15, Python + FastAPI, Go 1.22]
- Module being reviewed: [e.g. "the billing module", "our GraphQL resolvers"]
- Known concerns: [e.g. "complex conditional logic in checkout flow", "tech debt from rapid prototyping"]

## Files to gather

### 1. Core source files
- The source files for the feature or module I want reviewed
- Any shared utilities, helpers, or base classes those files depend on
- Type definitions, interfaces, or shared enums

### 2. Configuration & linting
- tsconfig.json / jsconfig.json (or the language-equivalent compiler config)
- .eslintrc.* / .prettierrc / biome.json / ruff.toml — linter and formatter configs
- package.json / pyproject.toml / go.mod — for dependency context

### 3. Tests (if reviewing test quality too)
- Test files that correspond to the source files above (*.test.ts, *_test.go, etc.)
- Any shared test utilities, fixtures, or factories

### 4. Recently changed files (optional but valuable)
Run \`git diff --name-only HEAD~10\` and include any files from the reviewed module that changed recently — these are most likely to contain fresh issues.

## Formatting rules

Format each file like this:
\`\`\`
--- path/to/filename.ext ---
[full file contents]
\`\`\`

Separate files with a blank line.

## Don't forget
- [ ] Include files from the BOTTOM of the import chain (leaf modules), not just the top-level entry point
- [ ] Include any custom ESLint rules or shared configs if the project has them
- [ ] If the module uses dependency injection, include the container/provider setup
- [ ] Note any files you omitted and why

If the total exceeds 30,000 characters, prioritise the files most central to the feature being reviewed, include the first 100 lines of long files, and note which were truncated or omitted.`,
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Identifies vulnerabilities, attack surfaces, and insecure patterns.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-700 hover:bg-red-600',
    placeholder: 'Paste your code or describe your system architecture...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['security'],
    prepPrompt: `I'm preparing code for a **Security** audit. Please help me collect and format the relevant files.

## Project context (fill in)
- Language / framework: [e.g. Node.js + Express, Django 5, Rails 7]
- Deployment target: [e.g. Vercel, AWS ECS, self-hosted]
- Auth mechanism: [e.g. JWT, session cookies, OAuth2 + PKCE, API keys]
- Known concerns: [e.g. "recently added file upload", "migrating from REST to GraphQL"]

## Files to gather

### 1. Authentication & authorisation
- Login, signup, password reset, and MFA handlers
- Session/token creation, validation, and refresh logic
- Middleware that enforces auth on routes (e.g. requireAuth, withSession)
- Role/permission checks and RBAC/ABAC policy files

### 2. Input handling & data flow
- API route handlers — ALL endpoints, not just the "risky" ones (the audit finds risks you didn't expect)
- Input validation and sanitisation code (Zod schemas, Joi, express-validator, etc.)
- File upload handlers and processing logic
- Any code that constructs HTML, SQL, shell commands, or URLs from user input

### 3. Database & ORM
- Database query files, repository layers, ORM model definitions
- Raw SQL queries or query-builder calls
- Migration files that alter permissions or add sensitive columns

### 4. Configuration & secrets
- Security-relevant config: CORS setup, CSP headers, cookie attributes, rate limiting
- Environment variable usage (show the code that reads from process.env, NOT the .env file itself)
- Dependencies list (package.json, requirements.txt, go.mod)

### 5. Infrastructure (if applicable)
- Dockerfile and docker-compose.yml
- CI/CD pipeline config (secrets handling, deploy steps)
- Any reverse proxy config (nginx.conf, Caddyfile)

## Formatting rules

Format each file:
\`\`\`
--- path/to/filename.ext ---
[full file contents]
\`\`\`

## Don't forget
- [ ] Include BOTH the happy path AND error handling code for each endpoint
- [ ] Include any custom middleware (logging, rate limiting, CORS)
- [ ] Show how environment variables are loaded (dotenv config, etc.)
- [ ] If you use an ORM, include the model definitions AND the raw queries
- [ ] DO NOT include actual secret values — replace with [REDACTED]
- [ ] Note which endpoints are public vs. authenticated vs. admin-only

Keep total under 30,000 characters. Omit purely presentational or styling files.`,
  },
  {
    id: 'seo-performance',
    name: 'SEO / Performance',
    description: 'Analyzes HTML and page structure for search rankings and load speed.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your page HTML or describe your page structure and content...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-performance'],
    prepPrompt: `I'm preparing a page for an **SEO & Performance** audit. Please help me collect the relevant content.

## Page context (fill in)
- URL being audited: [e.g. https://example.com/pricing]
- Page type: [e.g. landing page, blog post, product listing, SPA]
- Framework: [e.g. Next.js SSG, Nuxt SSR, static HTML, WordPress]
- Target keywords: [e.g. "project management software", "AI code review"]
- Known concerns: [e.g. "low organic traffic", "poor mobile Lighthouse score"]

## Content to gather

### 1. HTML head section (complete)
- \`<title>\` tag
- \`<meta name="description">\` tag
- \`<meta name="robots">\` and \`<meta name="googlebot">\` tags
- Canonical URL: \`<link rel="canonical">\`
- Open Graph tags: og:title, og:description, og:image, og:type, og:url
- Twitter Card tags: twitter:card, twitter:title, twitter:image
- Hreflang tags (if multi-language)
- Preconnect / preload / prefetch hints
- Font loading: \`<link rel="preload" as="font">\`, @font-face rules, font-display strategy
- Favicon and apple-touch-icon declarations

### 2. HTML body structure
- The full rendered HTML body (or the JSX/template source)
- Heading hierarchy: all h1–h6 tags with their text content
- Image tags with src, alt, width, height, loading, decoding, fetchpriority, and srcset attributes
- Internal and external link hrefs (check for broken or nofollow patterns)
- Any lazy-loaded content or infinite scroll implementations

### 3. Structured data
- JSON-LD scripts (paste the full \`<script type="application/ld+json">\` blocks)
- Microdata or RDFa markup if used instead of JSON-LD
- Breadcrumb markup

### 4. Performance data (if available)
Run these and include the output:
- Lighthouse report: \`npx lighthouse [URL] --output=json --quiet\` (or paste the scores)
- Core Web Vitals: LCP, FID/INP, CLS values from PageSpeed Insights or CrUX
- Page weight breakdown: total KB, number of requests, JS/CSS/image sizes
- \`next build\` output showing page sizes (if Next.js)

### 5. Technical SEO files
- robots.txt (full contents)
- sitemap.xml (or the generator config)
- Any redirect rules (next.config.ts rewrites/redirects, _redirects, .htaccess)

## Formatting rules

Format each section clearly labelled:
\`\`\`
--- HTML <head> ---
--- HTML <body> ---
--- Structured Data (JSON-LD) ---
--- robots.txt ---
--- Performance Metrics ---
\`\`\`

## Don't forget
- [ ] Include the RENDERED HTML (view-source), not just the JSX template — SSR/SSG output matters
- [ ] Check that alt text is included for every \`<img>\` tag, even if empty
- [ ] Note if the page is server-rendered, statically generated, or client-only
- [ ] Include any A/B test scripts or marketing tags that add to page weight
- [ ] Mention the page's primary CTA and conversion goal

Keep total under 30,000 characters.`,
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'Checks HTML against WCAG 2.2 AA criteria and ARIA best practices.',
    category: 'Code Quality',
    accentClass: 'text-green-400 hover:bg-green-500/10',
    buttonClass: 'bg-green-800 hover:bg-green-700',
    placeholder: 'Paste your HTML here...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['accessibility'],
    prepPrompt: `I'm preparing a UI component or page for an **Accessibility (WCAG 2.2 AA)** audit. Please help me collect the relevant markup and behaviour.

## Component context (fill in)
- Component/page name: [e.g. "Checkout form", "Dashboard sidebar", "Data table"]
- Purpose: [e.g. "Users fill out shipping and payment info to complete a purchase"]
- Framework: [e.g. React 19, Vue 3, Svelte 5, plain HTML]
- Known concerns: [e.g. "modal doesn't trap focus", "colour contrast on disabled buttons"]

## Content to gather

### 1. Rendered HTML (preferred over source JSX)
- The full rendered HTML of the component or page
- Run in browser DevTools: right-click → Inspect → copy outerHTML of the root element
- If you only have JSX, include both the JSX and a note about dynamic rendering

### 2. Interactive elements (exhaustive list)
- All \`<button>\`, \`<a>\`, \`<input>\`, \`<select>\`, \`<textarea>\` elements
- Custom interactive elements (divs with onClick, role="button", etc.)
- Modal/dialog components: how they open, close, and manage focus
- Dropdown menus, accordions, tabs, carousels, tooltips, toasts
- Drag-and-drop interactions

### 3. ARIA usage
- Every ARIA attribute used: role, aria-label, aria-labelledby, aria-describedby, aria-expanded, aria-selected, aria-live, aria-hidden, aria-controls, aria-owns, aria-current
- Any aria-live regions for dynamic content updates (toast notifications, form errors, loading states)

### 4. Forms
- All form fields with their associated \`<label>\` elements (check for htmlFor/id linkage)
- Required field indicators and how they're communicated
- Error message markup and how errors are announced (aria-describedby, aria-invalid, role="alert")
- Multi-step form navigation if applicable

### 5. Focus management code
- Any JavaScript that calls \`.focus()\`, manages tabIndex, or implements focus trapping
- Skip-to-content links
- Focus restoration after modal close or route change
- Tab order customisations (tabindex values other than 0 or -1)

### 6. Visual/CSS considerations
- CSS that hides or shows content: \`display:none\`, \`visibility:hidden\`, \`sr-only\` / \`visually-hidden\` patterns
- Colour combinations used for text-on-background (include hex values if possible)
- Any content conveyed by colour alone (status indicators, form validation)
- Motion/animation CSS: transitions, keyframes, prefers-reduced-motion handling
- Touch target sizes (min 44×44px per WCAG 2.5.8)

### 7. Media
- Images: check every \`<img>\` has meaningful alt text (or alt="" for decorative)
- Icons: SVGs with role="img" and aria-label, or aria-hidden if decorative
- Video/audio: captions, transcripts, audio descriptions
- Any \`<canvas>\` elements and their text alternatives

## Formatting rules

Format each section:
\`\`\`
--- Rendered HTML ---
--- Focus management JS ---
--- Relevant CSS (colour, visibility, motion) ---
--- Component purpose and user flow ---
\`\`\`

## Don't forget
- [ ] Test with keyboard only: Tab, Shift+Tab, Enter, Space, Escape, Arrow keys
- [ ] Run axe DevTools or Lighthouse accessibility audit and paste the results
- [ ] Check that the page works without CSS (content order should still make sense)
- [ ] Note the heading hierarchy (h1 → h2 → h3) — skipped levels are a finding
- [ ] Include any screen reader announcements for dynamic content changes
- [ ] Check that disabled elements are truly non-interactive (not just visually greyed out)

Keep total under 30,000 characters. Note the component name and its purpose at the top.`,
  },
  {
    id: 'sql',
    name: 'SQL Auditor',
    description: 'Finds injection risks, N+1 queries, missing indexes, and transaction issues.',
    category: 'Security & Privacy',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste your SQL queries, schema, or ORM code here...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['sql'],
    prepPrompt: `I'm preparing database code for a **SQL** audit. Please help me collect the relevant files, queries, and schema.

## Database context (fill in)
- Database engine & version: [e.g. PostgreSQL 16, MySQL 8.4, SQLite, MongoDB 7]
- ORM / query builder: [e.g. Prisma, Drizzle, SQLAlchemy, ActiveRecord, raw SQL]
- Approximate scale: [e.g. "users: 500K rows, orders: 2M rows, events: 50M rows"]
- Known concerns: [e.g. "slow dashboard query", "N+1 in order listing", "no indexes on events table"]

## Files to gather

### 1. Schema (complete)
- All CREATE TABLE / CREATE INDEX statements, OR
- Full ORM model definitions (Prisma schema, SQLAlchemy models, Django models, etc.)
- Include column types, constraints (NOT NULL, UNIQUE, CHECK, DEFAULT), and foreign keys
- Index definitions — both standalone and inline

### 2. Queries (all of them)
- Every SQL query or ORM call in the codebase, including:
  - Simple CRUD operations (they still matter for injection and index usage)
  - Complex queries: JOINs, subqueries, CTEs, window functions
  - Aggregation queries: GROUP BY, HAVING, COUNT, SUM
  - Full-text search queries
- For each query, note:
  - Where it's called from (e.g. "GET /api/users endpoint", "nightly cron job")
  - How often it runs (per request? per minute? once daily?)
  - Whether any parameters come from user input

### 3. Dynamic query construction
- Any code that builds SQL strings with concatenation or template literals (HIGH PRIORITY)
- Parameterised query usage patterns
- Any use of raw SQL escaping functions

### 4. Transaction handling
- BEGIN/COMMIT/ROLLBACK patterns
- ORM transaction blocks (\`prisma.$transaction\`, \`db.session.begin\`, etc.)
- Any manual lock acquisition (SELECT FOR UPDATE, advisory locks)
- Retry logic for deadlocks or serialisation failures

### 5. Migration files
- Recent migrations (last 5–10) showing schema evolution
- Any data migrations that run queries on large tables
- Migration ordering and dependency management

### 6. Performance evidence (if available)
- EXPLAIN ANALYZE output for slow queries
- Query execution times from APM tools or slow query logs
- Connection pool configuration (pool size, timeout, idle settings)

## Formatting rules

Format each file or section:
\`\`\`
--- schema.sql (or prisma/schema.prisma) ---
--- queries/users.ts ---
--- migrations/20240315_add_orders_index.sql ---
\`\`\`

## Don't forget
- [ ] Include ALL queries, not just the ones you think are problematic
- [ ] Show how user input flows into query parameters (the full call chain)
- [ ] Include the connection/pool configuration
- [ ] Add a one-line comment above each query describing its purpose if not obvious
- [ ] Note which queries run inside transactions and which run standalone
- [ ] If using an ORM, include both the ORM code AND the generated SQL if you can capture it

Keep total under 30,000 characters.`,
  },
  {
    id: 'api-design',
    name: 'API Design',
    description: 'Reviews REST and GraphQL APIs for conventions, versioning, and error contracts.',
    category: 'Infrastructure',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-800 hover:bg-cyan-700',
    placeholder: 'Paste your API routes, OpenAPI spec, or GraphQL schema here...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['api-design'],
    prepPrompt: `I'm preparing an API for a **Design Review**. Please help me collect the relevant files and documentation.

## API context (fill in)
- API style: [REST / GraphQL / gRPC / tRPC / mixed]
- Framework: [e.g. Express, FastAPI, Next.js API routes, Rails, Spring Boot]
- Auth strategy: [e.g. Bearer JWT, API keys, OAuth2, session cookies]
- Audience: [internal microservice consumers / public third-party developers / mobile app / SPA frontend]
- Versioning: [URL prefix /v1, header-based, none yet]
- Known concerns: [e.g. "inconsistent error formats", "no pagination on list endpoints", "breaking changes needed"]

## Files to gather

### 1. API specification (if it exists)
- OpenAPI / Swagger spec (openapi.yaml or openapi.json) — complete file
- GraphQL schema (schema.graphql or the SDL output)
- Protobuf definitions (.proto files) for gRPC
- Any Postman collection or API documentation pages

### 2. Route/endpoint definitions (all of them)
- Every route handler file — not just a sample; the audit checks for consistency across the ENTIRE API
- Include HTTP method, path, middleware chain, and handler function for each route
- For GraphQL: all resolvers, type definitions, and custom scalars

### 3. Request & response shapes
- Request body validation schemas (Zod, Joi, Pydantic models, class-validator DTOs)
- Response type definitions or serialisers
- Example request/response payloads for the most important endpoints

### 4. Cross-cutting concerns
- Authentication middleware: how tokens/keys are validated
- Authorisation middleware: role checks, permission guards, resource ownership validation
- Rate limiting configuration (limits per endpoint or globally)
- CORS configuration
- Error handling middleware: how exceptions become HTTP responses
- Request logging / audit trail middleware

### 5. Pagination, filtering, sorting
- How list endpoints handle pagination (cursor, offset, page/size)
- Query parameter parsing for filters and sort orders
- Any search endpoint implementations

### 6. Versioning & deprecation
- How versions are managed (URL prefix, Accept header, query param)
- Any deprecated endpoints and their sunset timeline
- Migration guides between versions (if they exist)

## Formatting rules

Format each file:
\`\`\`
--- routes/users.ts ---
--- middleware/auth.ts ---
--- openapi.yaml ---
--- types/api.ts ---
\`\`\`

## Don't forget
- [ ] Include the FULL route table (run your framework's route-listing command if available)
- [ ] Show error response examples — not just success responses
- [ ] Include any webhook or callback endpoint definitions
- [ ] Note which endpoints are public, authenticated, or admin-only
- [ ] If no OpenAPI spec exists, write a brief description of each endpoint's purpose
- [ ] Include rate limit values per endpoint if they differ

Keep total under 30,000 characters.`,
  },
  {
    id: 'devops',
    name: 'Docker / DevOps',
    description: 'Audits Dockerfiles, CI/CD pipelines, and infrastructure config for security and efficiency.',
    category: 'Infrastructure',
    accentClass: 'text-slate-300 hover:bg-slate-500/10',
    buttonClass: 'bg-slate-700 hover:bg-slate-600',
    placeholder: 'Paste your Dockerfile, docker-compose.yml, CI config (.github/workflows, .gitlab-ci.yml), or IaC here...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['devops'],
    prepPrompt: `I'm preparing infrastructure and deployment config for a **Docker / DevOps** audit. Please help me collect the relevant files.

## Infrastructure context (fill in)
- Cloud provider: [e.g. AWS, GCP, Azure, self-hosted, Vercel, Railway]
- Container orchestration: [e.g. Docker Compose, Kubernetes, ECS, none]
- CI/CD platform: [e.g. GitHub Actions, GitLab CI, Jenkins, CircleCI]
- Environments: [e.g. dev, staging, prod — how many and how they differ]
- Known concerns: [e.g. "slow CI builds", "no staging environment", "secrets in plaintext"]

## Files to gather

### 1. Container configuration
- Dockerfile(s) — every Dockerfile in the repo, including multi-stage builds
- docker-compose.yml / docker-compose.override.yml
- .dockerignore
- Any entrypoint scripts (docker-entrypoint.sh)
- Health check definitions

### 2. CI/CD pipeline configuration
- All workflow/pipeline files:
  - GitHub Actions: .github/workflows/*.yml
  - GitLab CI: .gitlab-ci.yml
  - Jenkins: Jenkinsfile
  - CircleCI: .circleci/config.yml
- Any reusable workflow or shared action definitions
- Branch protection rules (describe them if not in code)

### 3. Infrastructure-as-code
- Terraform files: *.tf and terraform.tfvars (with secrets REDACTED)
- Helm charts: Chart.yaml, values.yaml, templates/*.yaml
- Kubernetes manifests: deployments, services, ingresses, configmaps, secrets
- Pulumi, CDK, or CloudFormation templates
- Any Ansible playbooks or Chef/Puppet configs

### 4. Secrets and environment management
- How secrets are injected at build time vs. runtime
- .env.example or .env.template (NOT the actual .env file)
- Any secret management integration (AWS Secrets Manager, Vault, SOPS)
- Environment variable documentation

### 5. Deployment and operations
- Deployment scripts (Makefile targets, deploy.sh, npm scripts)
- Rollback procedures and blue/green or canary configuration
- Monitoring/alerting config referenced by infra (healthcheck URLs, Datadog agent setup)
- Backup and disaster recovery scripts
- Log aggregation configuration

### 6. Dependency management
- package.json / requirements.txt / go.mod (for supply chain context)
- Lock files (package-lock.json, yarn.lock) — first 200 lines is fine
- Any Dependabot / Renovate configuration

## Formatting rules

Format each file:
\`\`\`
--- Dockerfile ---
--- .github/workflows/deploy.yml ---
--- terraform/main.tf ---
--- k8s/deployment.yaml ---
\`\`\`

## Don't forget
- [ ] Replace actual secrets with [REDACTED] but show the variable names
- [ ] Include ALL CI workflow files, not just the main one
- [ ] Note the branching strategy (trunk-based, GitFlow, etc.)
- [ ] Include any Makefile or scripts that wrap docker/deploy commands
- [ ] Note which steps have caching configured and which don't
- [ ] Mention average CI build time if known

Keep total under 30,000 characters.`,
  },
  {
    id: 'performance',
    name: 'Performance Profiler',
    description: 'Identifies algorithmic complexity, memory leaks, and render performance bottlenecks.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your code — frontend, backend, or algorithm...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['performance'],
    prepPrompt: `I'm preparing code for a **Performance Profiler** audit. Please help me collect the relevant files and context.

## Performance context (fill in)
- Language / framework: [e.g. TypeScript + React 19, Python + FastAPI, Go 1.22]
- Runtime: [e.g. Node.js 22, Bun 1.1, CPython 3.12, browser]
- What's slow: [e.g. "Dashboard page takes 4s to load", "API p99 latency is 2s", "batch job takes 3 hours"]
- Scale: [e.g. "1000 req/s", "50K items in the list", "processing 10GB CSV files"]
- Known bottleneck area: [e.g. "suspect it's the sorting algorithm", "too many re-renders"]

## Files to gather

### 1. The hot path (most important)
- The specific function, module, or component that's slow or suspected
- ALL code it calls downstream — follow the call chain to the leaf functions
- Include loop bodies, recursive calls, and any code called repeatedly per request

### 2. Data fetching & I/O
- Database queries executed in the hot path (include the SQL or ORM calls)
- API calls to external services (HTTP clients, SDKs)
- File I/O operations (reading, writing, streaming)
- Any caching layer between the code and the data source

### 3. Frontend-specific (if applicable)
- Component tree: parent components that re-render and trigger child re-renders
- useEffect / useMemo / useCallback / React.memo usage — check dependencies arrays
- List rendering code: map() over large arrays, virtualisation (or lack thereof)
- State management: how state updates propagate (Context, Redux, Zustand, signals)
- CSS that triggers layout thrashing (reading offsetHeight then writing style)

### 4. Backend-specific (if applicable)
- Request handlers with middleware chain (how many layers does a request pass through?)
- Any serialisation/deserialisation of large payloads
- Background job or queue processing code
- Connection pool settings and concurrent request handling

### 5. Algorithm & data structure choices
- Sorting, searching, or filtering logic on large datasets
- Any O(n²) or O(n³) patterns (nested loops, repeated array scans)
- Data structure choices: Array vs. Map vs. Set, linked list vs. array

### 6. Existing measurements (if available)
- Profiler output: Chrome DevTools flame chart, Node.js --prof output, py-spy, pprof
- APM data: latency percentiles, throughput, error rates (Datadog, New Relic, etc.)
- Lighthouse scores or Core Web Vitals
- Any benchmarks you've run (even informal ones like "console.time showed 1200ms")
- \`next build\` output, webpack-bundle-analyzer output, or bundle size data

## Formatting rules

Format each file:
\`\`\`
--- components/DataTable.tsx ---
--- api/reports/route.ts ---
--- lib/sortEngine.ts ---
\`\`\`

## Don't forget
- [ ] Include the FULL call chain, not just the top-level function
- [ ] Note how frequently each code path runs (per request? per keystroke? once at startup?)
- [ ] Include input sizes: how many items, how large are the payloads
- [ ] If frontend: note which components re-render and why (React DevTools Profiler helps)
- [ ] If backend: include the middleware stack and any serialisation steps
- [ ] Mention any existing caching, debouncing, or throttling already in place

Keep total under 30,000 characters.`,
  },
  {
    id: 'privacy',
    name: 'Privacy / GDPR',
    description: 'Checks code and data flows for PII exposure, consent gaps, and GDPR/CCPA compliance.',
    category: 'Security & Privacy',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your code, data models, API routes, or privacy policy for analysis...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['privacy'],
    prepPrompt: `I'm preparing code for a **Privacy & GDPR/CCPA** audit. Please help me collect the relevant files and data flow documentation.

## Privacy context (fill in)
- Jurisdictions: [e.g. EU (GDPR), California (CCPA/CPRA), UK, Brazil (LGPD), all of the above]
- User base: [e.g. "B2C, 50K users in EU", "B2B SaaS, enterprise customers globally"]
- Data processing role: [controller / processor / both]
- Known concerns: [e.g. "no cookie consent banner", "analytics sends PII to US servers", "no data deletion endpoint"]

## Files to gather

### 1. Data models (every model that stores user data)
- Database schemas / ORM models for: users, profiles, addresses, payment info, audit logs
- Include column types — especially note any columns that store PII (email, name, phone, IP, location)
- Soft-delete vs. hard-delete implementation
- Data retention fields (created_at, deleted_at, expires_at)

### 2. Data collection points
- Signup and registration handlers
- Profile update endpoints
- Form handlers that collect user input
- File/document upload handlers
- Contact forms, feedback forms, newsletter signups

### 3. Data processing & sharing
- Any code that sends user data to third-party services:
  - Analytics (Google Analytics, Mixpanel, Amplitude, Segment)
  - Email providers (SendGrid, Mailchimp, SES)
  - Payment processors (Stripe, PayPal)
  - Advertising (Facebook Pixel, Google Ads)
  - Support tools (Intercom, Zendesk)
  - Error tracking (Sentry — check for PII in error reports)
- API endpoints that return user data (check what fields are exposed)
- Any data export or reporting features

### 4. Consent management
- Cookie consent banner implementation
- Consent storage: how and where user consent choices are recorded
- Opt-in/opt-out logic for marketing, analytics, and functional cookies
- Consent withdrawal mechanism
- Age verification or parental consent if applicable

### 5. Data subject rights implementation
- Data access/portability endpoint (GDPR Art. 15, 20 — "download my data")
- Data deletion endpoint (GDPR Art. 17 — "right to be forgotten")
- Data rectification endpoint (GDPR Art. 16 — "correct my data")
- Processing objection/restriction mechanisms (Art. 18, 21)
- Automated decision-making opt-out (Art. 22)

### 6. Security measures for personal data
- Encryption at rest and in transit (how PII is stored and transmitted)
- Access controls on personal data (who can query user tables?)
- Audit logging for access to personal data
- Data anonymisation or pseudonymisation code
- Breach notification procedures (if documented in code/config)

### 7. Legal documents
- Privacy policy text (current version)
- Terms of service (data-related sections)
- Cookie policy
- Data Processing Agreements (DPA) with sub-processors (list the processors if not in code)

## Formatting rules

Format each file:
\`\`\`
--- models/user.ts ---
--- api/analytics/route.ts ---
--- components/CookieBanner.tsx ---
--- docs/privacy-policy.md ---
\`\`\`

## Don't forget
- [ ] Replace any real personal data in examples with placeholders like [EMAIL], [NAME], [IP]
- [ ] List ALL third-party services that receive user data, even indirectly
- [ ] Include server-side logging config — logs often contain PII accidentally
- [ ] Check for PII in error messages, stack traces, and debug output
- [ ] Note data residency: where is user data stored geographically?
- [ ] Include any data retention schedules or automated cleanup jobs

Keep total under 30,000 characters.`,
  },
  {
    id: 'test-quality',
    name: 'Test Quality',
    description: 'Reviews test suites for coverage gaps, flaky patterns, and assertion quality.',
    category: 'Code Quality',
    accentClass: 'text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-800 hover:bg-teal-700',
    placeholder: 'Paste your test files, test suite, or both test and implementation code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['test-quality'],
    prepPrompt: `I'm preparing code for a **Test Quality** audit. Please help me collect both the test files and the implementation they cover.

## Test context (fill in)
- Test framework: [e.g. Jest, Vitest, pytest, Go testing, JUnit 5, RSpec]
- Test types present: [unit / integration / e2e / component / snapshot / property-based]
- Current coverage: [e.g. "~60% line coverage", "no coverage tracking", "95% but many tests are brittle"]
- CI integration: [e.g. "tests run in GitHub Actions, ~3 min total", "no CI yet"]
- Known concerns: [e.g. "flaky tests in CI", "tests pass but production bugs still slip through", "too many mocks"]

## Files to gather

### 1. Test files (the primary focus)
- All test files for the module being reviewed (*.test.ts, *.spec.ts, *_test.go, test_*.py, etc.)
- Group by type if possible: unit tests, integration tests, e2e tests

### 2. Implementation files (essential for gap analysis)
- The implementation file(s) each test file covers — THIS IS CRITICAL
- The audit compares tests against actual code paths to find coverage gaps
- Include every branch, error case, and edge case in the implementation

### 3. Test infrastructure
- Test configuration: jest.config.ts, vitest.config.ts, pytest.ini, conftest.py, setupTests.ts
- Shared test utilities, helpers, or custom matchers
- Test fixtures, factories, or builders (e.g. createMockUser(), buildOrder())
- Mock/stub/spy definitions if they live in separate files
- Global test setup and teardown scripts

### 4. Test data
- Fixture data files (JSON, SQL seeds, factory definitions)
- Any test database setup or migration scripts
- Mock API response files

### 5. Coverage and CI data (if available)
- Coverage report output: \`npx jest --coverage\` or \`npx vitest --coverage\`
- CI pipeline test step configuration
- Any flaky test tracking or retry configuration
- Test execution time breakdown (which tests are slowest?)

## Formatting rules

Format each file with clear labels:
\`\`\`
--- src/lib/auth.ts (IMPLEMENTATION) ---
--- src/lib/auth.test.ts (TESTS) ---
--- src/lib/auth.integration.test.ts (INTEGRATION TESTS) ---
--- test/helpers/mockAuth.ts (TEST UTILITY) ---
--- jest.config.ts (CONFIG) ---
\`\`\`

## Don't forget
- [ ] Include BOTH implementation AND test files for each module — the audit is useless without both
- [ ] Include ALL test files, not just the ones you think are good — the audit finds what's missing
- [ ] Show the test configuration including: module resolution, transform settings, coverage thresholds
- [ ] Include any custom matchers or assertion helpers
- [ ] Note which tests are currently skipped/disabled (.skip, @pytest.mark.skip) and why
- [ ] If tests use a real database, include the test DB setup configuration
- [ ] Mention any known flaky tests and their symptoms

Keep total under 30,000 characters.`,
  },
  {
    id: 'architecture',
    name: 'Architecture Review',
    description: 'Evaluates system design for coupling, cohesion, dependency direction, and scalability.',
    category: 'Code Quality',
    accentClass: 'text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste your system description, architecture diagram description, module structure, or key source files...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['architecture'],
    prepPrompt: `I'm preparing a system for an **Architecture Review**. Please help me collect a representative snapshot of the codebase structure.

## System context (fill in)
- System purpose: [e.g. "E-commerce platform", "Real-time analytics dashboard", "Multi-tenant SaaS"]
- Tech stack: [e.g. Next.js + PostgreSQL + Redis, Go microservices + gRPC + Kafka]
- Team size: [e.g. "3 engineers", "cross-functional team of 12"]
- Age: [e.g. "6 months old", "5 years, originally a monolith"]
- Scale: [e.g. "1K DAU", "50K req/s", "processing 1TB/day"]
- Architectural style: [monolith / modular monolith / microservices / serverless / hybrid]
- Known pain points: [e.g. "everything depends on the User module", "no clear service boundaries"]

## Files to gather

### 1. Directory structure (essential)
Run this and include the output:
\`\`\`bash
find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.go" -o -name "*.java" -o -name "*.rs" \\) | grep -v node_modules | grep -v .git | grep -v __pycache__ | sort
\`\`\`

### 2. Entry points and bootstrapping
- Main entry file: index.ts, main.py, main.go, App.tsx
- Router/route registration: where all routes are defined
- App bootstrapping: dependency injection setup, middleware registration, database connection
- Any service registry or module loading system

### 3. Module boundaries
- The top-level directory for each logical module/domain/bounded context
- Index/barrel files that define each module's public API
- Any explicit module boundary enforcement (dependency rules, import restrictions)

### 4. Key abstraction layers (include 1–2 representative files from each)
- Controllers / handlers / resolvers (input layer)
- Services / use cases (business logic layer)
- Repositories / data access (persistence layer)
- Domain models / entities (core domain)
- DTOs / view models / serialisers (data transfer)

### 5. Cross-cutting concerns
- Middleware stack (auth, logging, error handling, CORS, rate limiting)
- Event bus / message queue producers and consumers
- Scheduled jobs / cron tasks
- Shared utilities that many modules import

### 6. External integration points
- Third-party API clients (payment, email, analytics, etc.)
- Database client configuration and connection management
- Message broker setup (Kafka, RabbitMQ, SQS)
- Cache layer configuration (Redis, Memcached)

### 7. Dependency graph highlights
Run if available:
- \`npx madge --image graph.png src/\` or \`npx madge --circular src/\` for circular dependency detection
- Or manually note: which files are imported by 10+ other files? Which modules import from 3+ other modules?

## Also write (3–5 sentences each)

**System overview**: What does this system do? Who uses it? What are the primary user journeys?

**Architecture decisions**: Any significant decisions and their rationale (e.g. "chose PostgreSQL over MongoDB because we need transactions", "went serverless to reduce ops burden")

**Current challenges**: What architectural problems exist? What's hard to change? Where do bugs cluster?

## Formatting rules

Format:
\`\`\`
--- Directory tree ---
--- src/index.ts (entry point) ---
--- src/modules/users/UserService.ts (service layer example) ---
--- src/modules/users/UserRepository.ts (data access example) ---
\`\`\`

## Don't forget
- [ ] Include the FULL directory tree — the structure IS the architecture
- [ ] Show dependency direction: which modules import from which other modules
- [ ] Include configuration for dependency injection or service location if present
- [ ] Note any circular dependencies you're aware of
- [ ] Include the database schema or entity relationships (even as a text diagram)
- [ ] Show how errors propagate across module boundaries
- [ ] Note planned architectural changes or migrations in progress

Keep total under 30,000 characters. Prefer BREADTH (many files, first 30 lines each) over depth (fewer files, complete contents).`,
  },
  {
    id: 'documentation',
    name: 'Documentation Quality',
    description: 'Audits inline comments, JSDoc/TSDoc, README completeness, and API reference quality.',
    category: 'Code Quality',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your source files, README, JSDoc comments, or API reference...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['documentation'],
    prepPrompt: `I'm preparing code and documentation for a **Documentation Quality** audit. Please help me collect the relevant files.

## Documentation context (fill in)
- Project type: [e.g. open-source library, internal SaaS, developer tool, API service]
- Target audience: [e.g. "external developers integrating our API", "new team members onboarding", "open-source contributors"]
- Documentation tools: [e.g. JSDoc, TypeDoc, Sphinx, Storybook, Docusaurus, none]
- Known concerns: [e.g. "README is outdated", "no API docs", "comments contradict the code"]

## Files to gather

### 1. README and top-level docs
- README.md (the full file — this is the front door of your project)
- CONTRIBUTING.md, CODE_OF_CONDUCT.md
- CHANGELOG.md or HISTORY.md (last 10 entries)
- LICENSE file
- Any Architecture Decision Records (ADRs) in docs/decisions/

### 2. Source files with documentation
- 3–5 representative source files from the PUBLIC API surface (exported functions, classes, hooks)
- Include files with JSDoc/TSDoc/docstrings AND files without them — the audit finds gaps
- Focus on files that new developers would need to understand first
- Any auto-generated documentation output (TypeDoc, Sphinx, Swagger UI)

### 3. API documentation
- OpenAPI/Swagger spec (if it exists)
- GraphQL schema with descriptions
- Any standalone API reference pages or markdown files
- Example code in docs/ or examples/ directories

### 4. Inline documentation patterns
- Files that represent your BEST documentation (so the audit can identify the standard)
- Files that represent your WORST documentation (so the audit can identify gaps)
- Any shared types or interfaces that are heavily imported but poorly documented

### 5. Developer experience files
- .env.example with descriptions of each variable
- Setup/installation instructions
- Any Storybook stories (*.stories.tsx) or example files
- Configuration file documentation (what each config option does)
- Any troubleshooting guides or FAQ documents

### 6. Code comments analysis
Run this to see comment density:
\`\`\`bash
# TypeScript/JavaScript
find src -name "*.ts" -o -name "*.tsx" | xargs grep -c "//" | sort -t: -k2 -n
# Python
find . -name "*.py" | xargs grep -c "#" | sort -t: -k2 -n
\`\`\`

## Formatting rules

Format each file:
\`\`\`
--- README.md ---
--- src/lib/auth.ts (public API, well-documented) ---
--- src/lib/billing.ts (public API, poorly documented) ---
--- docs/api-reference.md ---
--- CHANGELOG.md (last 10 entries) ---
\`\`\`

## Don't forget
- [ ] Include files with NO documentation — the audit catches what's missing, not just what's wrong
- [ ] Include the README even if you think it's fine — external perspective finds blind spots
- [ ] Show how types/interfaces are documented (are generics explained? are constraints noted?)
- [ ] Include any auto-generated docs AND their source (to check if they stay in sync)
- [ ] Note which docs are manually written vs. auto-generated
- [ ] Include error messages shown to users — these are documentation too

Keep total under 30,000 characters. Prioritise public API surfaces and onboarding-critical files.`,
  },
  {
    id: 'dependency-security',
    name: 'Dependency Security',
    description: 'Scans for CVEs, outdated packages, license risks, and supply-chain vulnerabilities.',
    category: 'Security & Privacy',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your package.json, package-lock.json, requirements.txt, go.mod, or similar...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['dependency-security'],
    prepPrompt: `I'm preparing dependency files for a **Dependency & Supply Chain Security** audit. Please help me collect the relevant manifests and configuration.

## Project context (fill in)
- Language / package manager: [e.g. Node.js + npm, Python + pip, Go modules, Java + Maven]
- Deployment target: [e.g. production web app, internal tool, open-source library]
- Last dependency update: [e.g. "2 months ago", "we use Renovate bot weekly", "never audited"]
- Known concerns: [e.g. "using an old version of lodash", "unsure about license compatibility", "got a Dependabot alert"]

## Files to gather

### 1. Package manifests (primary)
- package.json — the FULL file including devDependencies, peerDependencies, optionalDependencies
- package-lock.json / yarn.lock / pnpm-lock.yaml (first 500 lines, or better: run \`npm ls --all --json > deps.json\`)
- requirements.txt / Pipfile / Pipfile.lock / pyproject.toml (Python)
- go.mod / go.sum (Go)
- pom.xml / build.gradle / build.gradle.kts (Java/Kotlin)
- Gemfile / Gemfile.lock (Ruby)
- Cargo.toml / Cargo.lock (Rust)

### 2. Audit output (run these and include results)
\`\`\`bash
# Node.js
npm audit --json
# or
npx auditjs ossi  # for OSS Index
# Python
pip-audit --format json
# or
safety check --json
# Go
govulncheck ./...
# Ruby
bundle-audit check
\`\`\`

### 3. Registry and install configuration
- .npmrc / .yarnrc / .yarnrc.yml — especially registry URLs, scoped package configs
- pip.conf or pip.ini
- Any private registry configuration (Artifactory, Nexus, GitHub Packages)
- Any postinstall scripts in package.json (these execute arbitrary code during install!)

### 4. Dependency usage context
- Which dependencies are used in production code vs. dev-only vs. build-time-only
- Any vendored or copied source code (files copied from npm packages instead of installing)
- Any patches applied to dependencies (patch-package, pnpm patches)
- Any git dependencies (dependencies pointing to GitHub URLs instead of npm registry)

### 5. Update and automation config
- Dependabot configuration (.github/dependabot.yml)
- Renovate configuration (renovate.json, .renovaterc)
- Any .nvmrc, .node-version, .python-version, .tool-versions files
- Engine constraints in package.json (engines field)

### 6. License information
Run and include:
\`\`\`bash
# Node.js
npx license-checker --json --production | head -100
# Python
pip-licenses --format=json
\`\`\`

## Formatting rules

Format each file:
\`\`\`
--- package.json ---
--- npm audit output ---
--- .npmrc ---
--- .github/dependabot.yml ---
\`\`\`

## Don't forget
- [ ] Include the LOCK file, not just the manifest — transitive dependencies are where most CVEs hide
- [ ] Run \`npm audit\` or equivalent and paste the FULL output
- [ ] Include postinstall and preinstall scripts — these are a supply chain attack vector
- [ ] Note any dependencies pinned to exact versions and why
- [ ] Check for deprecated packages: \`npm outdated\` output is valuable
- [ ] Include any forked or patched dependencies
- [ ] Do NOT include node_modules/ or the full dependency tree dump

Keep total under 30,000 characters.`,
  },
  {
    id: 'auth-review',
    name: 'Auth & Session Review',
    description: 'Deep-dives on authentication flows, JWT/session handling, OAuth, and credential security.',
    category: 'Security & Privacy',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your authentication code, JWT logic, session handling, or OAuth implementation...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['auth-review'],
    prepPrompt: `I'm preparing authentication code for an **Auth & Session Security** audit. Please help me collect the relevant files.

## Auth context (fill in)
- Auth strategy: [e.g. JWT + refresh tokens, server-side sessions, OAuth2 + PKCE, magic links, passkeys]
- Auth library: [e.g. NextAuth/Auth.js, Passport.js, Django allauth, Firebase Auth, custom implementation]
- Session storage: [e.g. HTTP-only cookies, localStorage, Redis, database, in-memory]
- Identity providers: [e.g. Google, GitHub, Azure AD, custom username/password, SAML]
- MFA: [enabled / not yet / planned — which method: TOTP, SMS, WebAuthn]
- Known concerns: [e.g. "refresh tokens don't rotate", "no rate limiting on login", "session doesn't expire"]

## Files to gather

### 1. Authentication flows (the core)
- Login handler: the full request → validate credentials → create session/token → respond flow
- Signup/registration handler: input validation, password hashing, email verification
- Password reset: request handler, token generation, reset confirmation, token expiry
- Logout handler: how sessions/tokens are invalidated
- Magic link / passwordless flow (if applicable)

### 2. Token/session management
- JWT creation: what's in the payload? What algorithm (HS256, RS256)? What's the expiry?
- JWT validation: where and how are tokens verified? Is the algorithm enforced?
- Refresh token logic: rotation, revocation, storage, expiry
- Session middleware: how is the session loaded on each request?
- Cookie configuration: httpOnly, secure, sameSite, domain, path, maxAge values

### 3. OAuth/OIDC integration
- Provider configuration (client ID handling, redirect URIs, scopes requested)
- Callback handler: how the auth code is exchanged, what user info is stored
- State parameter validation (CSRF protection in OAuth flow)
- Account linking logic (what happens if a user signs up with email, then uses OAuth with same email?)

### 4. Authorisation (separate from authentication)
- Role/permission definitions and how they're assigned to users
- Middleware that checks permissions on routes (RBAC, ABAC, or custom)
- Resource ownership checks (can user A access user B's data?)
- Admin/superuser escalation paths
- API key generation, validation, and scoping

### 5. MFA implementation (if present)
- TOTP secret generation and storage
- TOTP verification logic (time window, replay protection)
- Recovery codes: generation, storage (hashed?), usage
- SMS/email OTP: generation, delivery, expiry, rate limiting
- WebAuthn/passkey registration and verification

### 6. Security controls around auth
- Rate limiting on login/signup/reset endpoints (thresholds and lockout policy)
- Account lockout after failed attempts (how many? how long? how to unlock?)
- CAPTCHA or bot protection on auth endpoints
- Brute-force detection and alerting
- Password policy enforcement (length, complexity, breach database check)
- Credential stuffing protections

### 7. Session lifecycle
- Session creation: what data is stored? Where? How is the ID generated?
- Session expiry: absolute timeout, idle timeout, sliding window
- Session invalidation: logout, password change, suspicious activity
- Concurrent session handling: are multiple sessions allowed? Can users see/revoke sessions?
- Session fixation protection: is the session ID regenerated after login?

## Formatting rules

Format each file:
\`\`\`
--- app/api/auth/login/route.ts ---
--- lib/jwt.ts ---
--- middleware/auth.ts ---
--- lib/session.ts ---
--- config/auth.ts (NextAuth/Auth.js config) ---
\`\`\`

## Don't forget
- [ ] Replace actual secrets, signing keys, and client secrets with [REDACTED]
- [ ] Include the FULL login flow from request to response, not just the handler
- [ ] Show password hashing: which algorithm (bcrypt, argon2, scrypt)? What parameters (rounds, memory)?
- [ ] Include error messages returned to users — do they leak information? ("user not found" vs "invalid credentials")
- [ ] Show how auth state is checked on EVERY request (the middleware), not just the login endpoint
- [ ] Include any "remember me" or persistent login implementation
- [ ] Note which endpoints are exempt from auth and why

Keep total under 30,000 characters.`,
  },
  {
    id: 'frontend-performance',
    name: 'Frontend Performance',
    description: 'Analyzes bundle size, Core Web Vitals risk, rendering bottlenecks, and resource loading.',
    category: 'Performance',
    accentClass: 'text-lime-400 hover:bg-lime-500/10',
    buttonClass: 'bg-lime-800 hover:bg-lime-700',
    placeholder: 'Paste your component code, build config, HTML, or Lighthouse report...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['frontend-performance'],
    prepPrompt: `I'm preparing frontend code for a **Frontend Performance** audit. Please help me collect the relevant files and measurements.

## Frontend context (fill in)
- Framework: [e.g. Next.js 15, Remix 2, Vue 3 + Nuxt, SvelteKit, plain React + Vite]
- Rendering strategy: [SSG / SSR / CSR / ISR / streaming / hybrid]
- Hosting: [e.g. Vercel, Cloudflare Pages, AWS S3 + CloudFront, self-hosted Nginx]
- Target users: [e.g. "global, mostly mobile", "enterprise desktop users on fast networks"]
- Current performance: [e.g. "Lighthouse 62, LCP 3.8s, CLS 0.12", "feels slow but no measurements"]
- Known concerns: [e.g. "large JS bundle", "images not optimized", "hydration takes too long"]

## Files to gather

### 1. Build configuration
- next.config.ts / vite.config.ts / webpack.config.js — the FULL file
- package.json (scripts section and dependencies)
- Any custom Babel or SWC configuration
- PostCSS config (postcss.config.js) and Tailwind config if used

### 2. Critical rendering path
- The root layout/shell component (app/layout.tsx, App.vue, +layout.svelte)
- The HTML \`<head>\` section: all \`<link>\`, \`<script>\`, \`<style>\` tags and their attributes
- The above-the-fold components for the most important page (hero, nav, CTA)
- Any code that blocks rendering: synchronous scripts, render-blocking CSS

### 3. Resource loading
- Image usage: all \`<img>\` tags with src, alt, width, height, loading, decoding, fetchpriority, srcset, sizes attributes
- Font loading strategy: @font-face rules, font-display value, preload hints
- Third-party scripts: analytics, chat widgets, ads, social embeds — show the script tags
- Dynamic imports and code splitting boundaries (React.lazy, next/dynamic, defineAsyncComponent)

### 4. JavaScript performance
- Large components that import many dependencies (check import statements)
- Client-side data fetching: useEffect + fetch, SWR, React Query, tRPC calls
- State management setup: Context providers, Redux store, Zustand stores
- Any Web Workers or service worker registration
- Event handlers on scroll, resize, or mousemove (potential layout thrashing)

### 5. CSS performance
- Total CSS size and how it's delivered (one bundle? per-route? utility-first?)
- Any CSS-in-JS runtime (styled-components, Emotion) and its configuration
- Animations that trigger layout or paint (vs compositor-only transforms/opacity)
- Large CSS selectors or deeply nested rules

### 6. Measurements (run and include)
\`\`\`bash
# Next.js build output (shows page sizes)
npm run build 2>&1 | tail -50

# Bundle analysis
ANALYZE=true npm run build  # if next-bundle-analyzer is configured
# or
npx @next/bundle-analyzer

# Lighthouse CLI
npx lighthouse http://localhost:3000 --output=json --chrome-flags="--headless" | jq '{performance: .categories.performance.score, FCP: .audits["first-contentful-paint"].numericValue, LCP: .audits["largest-contentful-paint"].numericValue, CLS: .audits["cumulative-layout-shift"].numericValue, TBT: .audits["total-blocking-time"].numericValue}'
\`\`\`

## Formatting rules

Format each file:
\`\`\`
--- app/layout.tsx (root layout) ---
--- components/HeroSection.tsx (above-the-fold) ---
--- next.config.ts ---
--- Build output (page sizes) ---
--- Lighthouse scores ---
\`\`\`

## Don't forget
- [ ] Include the build output showing page/chunk sizes — this is the single most valuable input
- [ ] List ALL third-party scripts (analytics, chat, ads) with their loading strategy
- [ ] Show how images are handled: next/image, manual optimization, CDN, or raw \`<img>\`
- [ ] Include font files and their sizes, plus the font-display strategy
- [ ] Note if there's a service worker or PWA configuration
- [ ] Check for \`use client\` boundaries in Next.js/React Server Components
- [ ] Mention the target device: mobile 3G, desktop broadband, or both

Keep total under 30,000 characters.`,
  },
  {
    id: 'caching',
    name: 'Caching Strategy',
    description: 'Reviews HTTP cache headers, CDN config, Redis patterns, and cache invalidation logic.',
    category: 'Performance',
    accentClass: 'text-sky-400 hover:bg-sky-500/10',
    buttonClass: 'bg-sky-700 hover:bg-sky-600',
    placeholder: 'Paste your API routes, cache configuration, Redis code, or CDN settings...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['caching'],
    prepPrompt: `I'm preparing caching code and configuration for a **Caching Strategy** audit. Please help me collect the relevant files.

## Caching context (fill in)
- Application type: [e.g. e-commerce, content site, API service, dashboard]
- Current caching layers: [e.g. CDN + Redis + browser, none, just browser cache, ISR]
- CDN provider: [e.g. Cloudflare, CloudFront, Fastly, Vercel Edge, none]
- Cache backend: [e.g. Redis, Memcached, in-memory Map, node-cache, none]
- Traffic pattern: [e.g. "read-heavy, 95% GET", "50/50 read/write", "spiky traffic during sales"]
- Known concerns: [e.g. "stale data shown after updates", "cache stampede during deploys", "no CDN configured"]

## Files to gather

### 1. HTTP cache headers
- API route handlers — show the Cache-Control, ETag, Last-Modified, Vary headers being set
- Static asset configuration (how CSS/JS/images are cached)
- Any middleware that sets cache headers globally
- Reverse proxy config (nginx.conf, Caddyfile) if it sets cache headers

### 2. CDN configuration
- Cloudflare page rules / cache rules / Workers that modify caching
- CloudFront distribution config: behaviors, TTLs, origin settings, invalidation
- Fastly VCL or Compute@Edge config
- Vercel/Netlify edge config or headers file
- Any CDN cache purge/invalidation automation

### 3. Application-level cache
- Redis/Memcached client setup: connection config, cluster settings, sentinel config
- Cache read patterns: get, check-then-fetch, look-aside
- Cache write patterns: set, setex (with TTL), invalidate-on-write
- Cache key generation logic (how keys are constructed — watch for key collisions)
- TTL values for different data types
- Any cache warming or preloading logic

### 4. Framework-specific caching
- Next.js: revalidate values, unstable_cache usage, ISR configuration, fetch cache options
- React Query / SWR: staleTime, gcTime, refetchInterval settings
- Any GraphQL caching (Apollo cache policies, persisted queries)
- ORM query caching (Prisma, Django cache_page, Rails fragment caching)

### 5. Cache invalidation (the hard part)
- How is the cache cleared when data changes?
- Event-driven invalidation: webhook handlers, pub/sub consumers that purge cache
- Time-based invalidation: TTL strategies, stale-while-revalidate patterns
- Tag-based invalidation (Next.js revalidateTag, CloudFront cache tags)
- Cache versioning strategies (key prefixing, cache-busting)
- What happens during deployment? Does the cache get flushed?

### 6. Cache monitoring (if available)
- Redis INFO output or dashboard screenshots (hit rate, memory usage, eviction count)
- CDN analytics: cache hit ratio, origin requests, bandwidth savings
- Any custom cache metrics or logging

## Formatting rules

Format each file:
\`\`\`
--- app/api/products/route.ts (shows Cache-Control headers) ---
--- lib/cache.ts (Redis wrapper) ---
--- infrastructure/cloudfront.tf (CDN config) ---
--- next.config.ts (ISR / revalidate settings) ---
\`\`\`

## Don't forget
- [ ] Show cache headers for ALL endpoint types (API, pages, static assets) — not just one
- [ ] Include the Vary header usage — incorrect Vary causes cache fragmentation
- [ ] Show cache invalidation code, not just cache setting code — invalidation is where bugs live
- [ ] Note cache sizes: how much data is cached? Are there memory limits or eviction policies?
- [ ] Include any cache stampede / thundering herd protection (locks, coalescing)
- [ ] Check if sensitive data (user-specific, auth tokens) could be cached and served to wrong users
- [ ] Note what happens to the cache during deployments

Keep total under 30,000 characters.`,
  },
  {
    id: 'memory-profiler',
    name: 'Memory & Leak Detection',
    description: 'Identifies memory leaks, unbounded caches, listener accumulation, and heap growth patterns.',
    category: 'Performance',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-800 hover:bg-cyan-700',
    placeholder: 'Paste your component code, Node.js modules, heap snapshot summary, or profiler output...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['memory-profiler'],
    prepPrompt: `I'm preparing code for a **Memory & Leak Detection** audit. Please help me collect the relevant files and diagnostics.

## Memory context (fill in)
- Runtime: [e.g. Node.js 22, Bun 1.1, Chrome/Firefox browser, Deno]
- Framework: [e.g. React 19, Next.js 15, Express, Fastify, plain Node.js]
- Observed symptoms: [e.g. "heap grows from 200MB to 2GB over 24h", "browser tab crashes after 30 min", "OOM kills in production every 3 days"]
- Memory limit: [e.g. "--max-old-space-size=4096", "container has 512MB", "default"]
- When it happens: [e.g. "under load", "after many page navigations", "idle server over time"]
- Known suspects: [e.g. "WebSocket connections", "in-memory cache", "event listeners on DOM"]

## Files to gather

### 1. Components/modules with subscription patterns (highest priority)
- React useEffect hooks with:
  - addEventListener / removeEventListener
  - setInterval / setTimeout (check cleanup)
  - WebSocket connections
  - EventEmitter .on() / .off() subscriptions
  - Observable subscriptions (RxJS, etc.)
  - AbortController and fetch cleanup
- Vue watch/watchEffect with cleanup
- Svelte onMount/onDestroy pairs

### 2. In-memory stores and caches
- Any custom Map, Set, Object, or Array used as a cache or store
- LRU cache implementations (check: is there a max size? Is eviction working?)
- Global singletons that accumulate data over time
- Module-level variables that grow (arrays pushed to, maps added to, never cleared)
- Rate limiter stores, session stores, connection pools

### 3. Event system code
- EventEmitter usage: .on() calls (check every .on() has a matching .off())
- DOM event listeners in server-side code (rare but catastrophic)
- Message queue consumers that buffer messages
- Stream handling: readable/writable/transform streams (are they properly destroyed?)

### 4. Long-running processes
- Background workers, job processors, cron tasks
- WebSocket server connection management (how are disconnected clients cleaned up?)
- File watcher code (fs.watch, chokidar)
- Database connection pool lifecycle

### 5. Closure and reference patterns
- Functions that close over large objects (data, DOM nodes, components)
- Callbacks stored in arrays or maps that are never removed
- Promise chains that hold references to large intermediate results
- Circular references between objects

### 6. Diagnostics (run and include if possible)

\`\`\`bash
# Node.js heap snapshot (take two, 5 minutes apart, compare)
node --inspect your-app.js
# In Chrome DevTools: Memory tab → Take heap snapshot

# Node.js process memory
node -e "const used = process.memoryUsage(); Object.entries(used).forEach(([k,v]) => console.log(k, (v/1024/1024).toFixed(1) + 'MB'))"

# Check for EventEmitter warnings
# Look for: "MaxListenersExceededWarning" in logs

# Browser: Performance Monitor tab in Chrome DevTools
# Watch: JS heap size, DOM nodes, event listeners count over time
\`\`\`

## Formatting rules

Format each file:
\`\`\`
--- components/RealtimeChart.tsx (suspected leak: WebSocket) ---
--- lib/eventBus.ts (module-level EventEmitter) ---
--- lib/cache.ts (in-memory Map, no max size) ---
--- workers/jobProcessor.ts (long-running) ---
--- Heap snapshot comparison (if available) ---
\`\`\`

## Don't forget
- [ ] For EVERY .on() / addEventListener, check there's a corresponding .off() / removeEventListener
- [ ] For EVERY setInterval, check there's a clearInterval in cleanup/unmount
- [ ] For EVERY new Map() / new Set() at module level, check if entries are ever deleted
- [ ] Include the CLEANUP code (useEffect return, componentWillUnmount, onDestroy) — missing cleanup IS the leak
- [ ] Note the process memory over time if you have monitoring data
- [ ] Check for "MaxListenersExceededWarning" in server logs — it's a direct leak indicator
- [ ] Include any connection pool configuration (max connections, idle timeout)

Keep total under 30,000 characters.`,
  },
  {
    id: 'cloud-infra',
    name: 'Cloud Infrastructure',
    description: 'Reviews IAM policies, network exposure, storage security, and resilience for AWS/GCP/Azure.',
    category: 'Infrastructure',
    accentClass: 'text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-800 hover:bg-teal-700',
    placeholder: 'Paste your Terraform, CDK, CloudFormation, or cloud config files...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['cloud-infra'],
    prepPrompt: `I'm preparing cloud infrastructure code for a **Cloud Infrastructure Security & Architecture** review. Please help me collect the relevant files.

## Cloud context (fill in)
- Cloud provider(s): [e.g. AWS, GCP, Azure, multi-cloud]
- IaC tool: [e.g. Terraform, CDK, CloudFormation, Pulumi, Bicep, manual console]
- Architecture: [e.g. "ECS Fargate behind ALB", "Lambda + API Gateway", "GKE cluster", "EC2 instances"]
- Environments: [e.g. dev, staging, prod — are they in separate accounts/projects?]
- Compliance requirements: [e.g. SOC 2, HIPAA, PCI-DSS, FedRAMP, none yet]
- Known concerns: [e.g. "overly permissive IAM", "S3 buckets might be public", "no encryption at rest"]

## Files to gather

### 1. IAM and access control (highest security priority)
- IAM role definitions: trust policies and permission policies
- IAM user definitions (ideally there are none — flag if users exist)
- Service accounts and their assigned roles
- Cross-account access configurations
- Any wildcard (*) permissions in policies
- Resource-based policies (S3 bucket policies, SQS policies, KMS key policies)

### 2. Network configuration
- VPC definitions: CIDR blocks, subnets (public/private), route tables
- Security groups: inbound and outbound rules (check for 0.0.0.0/0)
- Network ACLs
- NAT Gateway / NAT Instance configuration
- VPN or Direct Connect / ExpressRoute configuration
- VPC peering or Transit Gateway setup
- Load balancer configuration: listeners, target groups, health checks, SSL/TLS settings

### 3. Compute resources
- EC2 / ECS / EKS / Lambda / Cloud Run definitions
- Auto-scaling configuration (min, max, scaling policies)
- Container task definitions (CPU, memory, port mappings, environment variables)
- Lambda function configuration (runtime, memory, timeout, VPC attachment, layers)
- Instance profiles and execution roles

### 4. Storage and data
- S3 / GCS / Azure Storage bucket configuration:
  - Public access settings (block all public access?)
  - Bucket policies and ACLs
  - Encryption settings (SSE-S3, SSE-KMS, CMK)
  - Versioning and lifecycle rules
  - CORS configuration
  - Logging configuration
- RDS / CloudSQL / Azure SQL configuration:
  - Encryption at rest and in transit
  - Public accessibility
  - Backup configuration (retention, point-in-time recovery)
  - Multi-AZ or read replica setup

### 5. Secrets and encryption
- Secrets Manager / SSM Parameter Store / Key Vault usage
- KMS key definitions and key policies
- How secrets are injected into applications (environment variables, mounted volumes, SDK calls)
- Certificate management (ACM, Let's Encrypt)

### 6. Monitoring and compliance
- CloudTrail / Cloud Audit Logs configuration
- Config Rules / Security Hub / GuardDuty settings
- CloudWatch alarms / Cloud Monitoring alerts
- Any compliance scanning tools (Prowler, ScoutSuite, Checkov output)

### 7. Disaster recovery
- Backup configuration across services
- Cross-region replication setup
- Recovery point objective (RPO) and recovery time objective (RTO) targets
- Any disaster recovery runbooks or automation

## Formatting rules

Format each file:
\`\`\`
--- terraform/iam.tf ---
--- terraform/networking.tf ---
--- terraform/s3.tf ---
--- terraform/ecs.tf ---
--- terraform/rds.tf ---
\`\`\`

## Don't forget
- [ ] Replace real account IDs, ARNs, IP addresses, and secrets with [ACCOUNT_ID], [REDACTED]
- [ ] Include ALL IAM policies — overly permissive IAM is the #1 cloud security issue
- [ ] Check security groups for 0.0.0.0/0 ingress rules (especially on SSH/RDP ports)
- [ ] Include S3 bucket public access block configuration
- [ ] Show how environment-specific configs differ (dev vs prod)
- [ ] Include any Terraform state backend configuration (is the state file encrypted?)
- [ ] Note which resources are in public vs private subnets

Keep total under 30,000 characters.`,
  },
  {
    id: 'observability',
    name: 'Observability & Monitoring',
    description: 'Audits logging structure, metrics coverage, alerting rules, tracing, and incident readiness.',
    category: 'Infrastructure',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your logging code, Prometheus rules, alert configs, or OpenTelemetry setup...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['observability'],
    prepPrompt: `I'm preparing observability code and configuration for an **Observability & Monitoring** audit. Please help me collect the relevant files.

## Observability context (fill in)
- Observability stack: [e.g. Datadog, Prometheus + Grafana, New Relic, CloudWatch, ELK, self-hosted]
- Error tracking: [e.g. Sentry, Rollbar, Bugsnag, none]
- Log aggregation: [e.g. CloudWatch Logs, Loki, Elasticsearch, Papertrail, console only]
- Tracing: [e.g. OpenTelemetry, Jaeger, X-Ray, Datadog APM, none]
- On-call setup: [e.g. PagerDuty, OpsGenie, just Slack alerts, no on-call rotation]
- Known concerns: [e.g. "no alerting on error rates", "logs are unstructured", "can't trace requests across services"]

## Files to gather

### 1. Logging
- Logger initialization and configuration (Winston, Pino, Bunyan, Python logging, slog)
- Log format: structured JSON vs plain text? What fields are included?
- Log levels: how are they configured per environment?
- Request logging middleware (what's logged per request: method, path, status, duration, user ID?)
- Error logging: how are exceptions logged? Is the stack trace included?
- Any log sampling or rate limiting configuration
- Log shipping configuration: how do logs get from the app to the aggregation platform?

### 2. Metrics
- Custom metric definitions (counters, gauges, histograms)
- Prometheus client setup and /metrics endpoint
- Business metrics: revenue, signups, active users, conversion rates tracked in code
- Infrastructure metrics: how are CPU, memory, disk, network monitored?
- SLI/SLO definitions if they exist
- Metric naming conventions and label/tag strategies

### 3. Alerting
- Alert rule definitions (Prometheus alerting rules, Datadog monitors, CloudWatch alarms)
- Alert routing: how alerts reach the right person (PagerDuty policies, Slack channels, email)
- Alert thresholds and their rationale
- Escalation policies and severity levels
- Any on-call schedules and rotation config

### 4. Distributed tracing
- OpenTelemetry SDK setup (instrumentation, exporters, sampling)
- Trace context propagation (how trace IDs flow between services)
- Custom span creation for business-critical operations
- Trace sampling strategy (head-based, tail-based, always-on)

### 5. Health checks and readiness
- Health check endpoint implementation (/health, /healthz, /readiness, /liveness)
- What does the health check actually verify? (database connectivity, Redis, external deps, or just 200 OK?)
- Kubernetes liveness and readiness probe configuration
- Load balancer health check settings

### 6. Error tracking
- Sentry / Rollbar / Bugsnag SDK initialization and configuration
- Error boundary components (React error boundaries)
- Unhandled rejection and uncaught exception handlers
- Source map upload configuration (for readable stack traces in production)
- Error grouping and fingerprinting rules

### 7. Dashboards and runbooks
- Dashboard definitions (Grafana JSON, Datadog dashboard YAML) or screenshots/descriptions
- Runbook documentation: what to do when specific alerts fire
- Incident response procedures
- Post-mortem templates

## Formatting rules

Format each file:
\`\`\`
--- lib/logger.ts ---
--- lib/metrics.ts ---
--- monitoring/alerts.yaml ---
--- app/api/health/route.ts ---
--- config/sentry.ts ---
--- docs/runbooks/high-error-rate.md ---
\`\`\`

## Don't forget
- [ ] Include the logger setup AND a sample of how it's used throughout the codebase
- [ ] Show what a typical log line looks like in production (paste a few redacted examples)
- [ ] Include ALL alert rules — missing alerts are a finding too
- [ ] Check that sensitive data (passwords, tokens, PII) is NOT logged
- [ ] Include health check code — "return 200" without checking dependencies is a common anti-pattern
- [ ] Note any log retention policies (how long are logs kept?)
- [ ] Include error tracking config AND verify source maps are uploaded

Keep total under 30,000 characters.`,
  },
  {
    id: 'database-infra',
    name: 'Database Infrastructure',
    description: 'Reviews schema design, indexing, connection pooling, migrations, backup, and replication.',
    category: 'Infrastructure',
    accentClass: 'text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste your schema SQL, migration files, ORM config, or database infrastructure code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['database-infra'],
    prepPrompt: `I'm preparing database infrastructure code for a **Database Infrastructure** audit. Please help me collect the relevant files.

## Database context (fill in)
- Database engine & version: [e.g. PostgreSQL 16, MySQL 8.4, MongoDB 7, DynamoDB, CockroachDB]
- Hosting: [e.g. AWS RDS, Cloud SQL, PlanetScale, Supabase, self-hosted on EC2, local SQLite]
- ORM / driver: [e.g. Prisma, Drizzle, TypeORM, SQLAlchemy, ActiveRecord, raw pg/mysql2 driver]
- Size: [e.g. "20 tables, largest has 5M rows", "100GB total", "small but growing fast"]
- Traffic: [e.g. "200 queries/sec peak", "mostly reads", "write-heavy event ingestion"]
- Replication: [e.g. "primary + 2 read replicas", "single instance", "multi-region"]
- Known concerns: [e.g. "slow queries on orders table", "no backups configured", "connection pool exhaustion"]

## Files to gather

### 1. Schema (complete and current)
- Full schema definition: CREATE TABLE, CREATE INDEX, CREATE TYPE, CREATE FUNCTION
- OR the ORM schema: Prisma schema, Django models, SQLAlchemy models, ActiveRecord migrations
- Include ALL constraints: PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, NOT NULL, DEFAULT
- Include ALL indexes: B-tree, GIN, GiST, partial indexes, expression indexes
- Enum and custom type definitions
- Views and materialised views

### 2. Migration files
- All migration files in chronological order (or at least the last 15-20)
- Any data migration scripts (not just schema changes)
- Migration runner configuration (how migrations are executed in production)
- Any rollback scripts or down migrations

### 3. Connection and pool configuration
- Database client setup: connection string pattern (host, port, database, SSL mode)
- Connection pool settings: min, max, idle timeout, connection timeout, statement timeout
- Read replica routing: how are reads directed to replicas?
- Connection retry and reconnection logic
- Any PgBouncer, ProxySQL, or RDS Proxy configuration

### 4. Query patterns and performance
- The 5-10 most frequently run queries (from APM or pg_stat_statements)
- Any known slow queries and their EXPLAIN ANALYZE output
- N+1 query patterns or batch loading (DataLoader, includes, prefetch_related)
- Full-text search setup (tsvector, GIN indexes, Elasticsearch integration)
- Any query result caching layer

### 5. Backup and recovery
- Automated backup configuration: frequency, retention period, storage location
- Point-in-time recovery (PITR) configuration
- Backup verification: how are backups tested? When was the last restore test?
- Any manual backup scripts (pg_dump, mysqldump)
- Cross-region backup replication

### 6. Monitoring and maintenance
- Slow query log configuration and threshold
- Database monitoring: pg_stat_statements, performance_schema, MongoDB profiler
- Automated maintenance: VACUUM, ANALYZE, index rebuild schedules
- Storage monitoring and growth projections
- Alerting on connection count, replication lag, disk usage, long-running queries

### 7. Security
- Database user roles and permissions (who has superuser? who has read-only?)
- Row-level security (RLS) policies if used
- Encryption at rest configuration
- SSL/TLS for connections (sslmode=require, certificate configuration)
- Audit logging for data access

## Formatting rules

Format each file:
\`\`\`
--- prisma/schema.prisma (or schema.sql) ---
--- migrations/20240315_add_orders_table.sql ---
--- lib/db.ts (connection/pool config) ---
--- Slow query examples (EXPLAIN ANALYZE output) ---
--- infrastructure/rds.tf (or equivalent) ---
\`\`\`

## Don't forget
- [ ] Include the FULL schema, not just the tables you think are relevant — the audit catches missing indexes and constraints you didn't consider
- [ ] Include connection pool settings: wrong pool sizes cause cascading failures under load
- [ ] Show how migrations are run in production (manually? CI? automatic on deploy?)
- [ ] Include EXPLAIN ANALYZE for any queries you suspect are slow
- [ ] Note approximate row counts for each table — indexing advice depends on data size
- [ ] Include any seed or fixture data that reveals expected data patterns
- [ ] Note if you use connection pooling proxies (PgBouncer, ProxySQL) and their config

Keep total under 30,000 characters.`,
  },
  {
    id: 'ux-review',
    name: 'UX Review',
    description: 'Evaluates user flows, interaction patterns, cognitive load, and usability heuristics.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your component HTML/JSX, describe a user flow, or paste a screen description...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['ux-review'],
    prepPrompt: `I'm preparing a UI for a **UX Review** (Nielsen's heuristics + modern interaction design). Please help me collect the relevant markup and context.

## UX context (fill in)
- Product type: [e.g. SaaS dashboard, e-commerce store, mobile app, developer tool, content site]
- Target users: [e.g. "non-technical small business owners", "senior developers", "first-time shoppers"]
- User goal on this screen: [e.g. "find and purchase a product", "configure a deployment", "review audit results"]
- Device context: [e.g. desktop-primary, mobile-first, responsive both]
- Known UX concerns: [e.g. "users abandon at step 3 of checkout", "confusion about pricing tiers", "too many clicks to reach settings"]

## Content to gather

### 1. The UI being reviewed
- The rendered HTML or JSX of the component, page, or flow
- Include the FULL page, not just the component in isolation — surrounding context matters for navigation and information hierarchy
- Screenshots or screen descriptions if visual layout is important

### 2. All states of the UI
- Default/normal state
- Empty state (no data yet — is there guidance for the user?)
- Loading state (spinner, skeleton, progress bar — how long does it typically take?)
- Error state (validation errors, API failures, network errors — what does the user see?)
- Success state (confirmation, next steps, celebration)
- Partial state (some data loaded, some pending)
- Edge cases: very long text, many items, single item, zero items

### 3. Interactive elements and their behaviour
- All buttons, links, and CTAs — what happens when clicked?
- Form fields: labels, placeholders, help text, validation rules, error messages
- Navigation: breadcrumbs, tabs, pagination, back buttons, menu structure
- Modals/dialogs: what triggers them? How to dismiss? Is there a backdrop click?
- Tooltips, popovers, and contextual help
- Drag-and-drop, swipe, or gesture interactions
- Keyboard shortcuts (if any)

### 4. Information architecture
- Page hierarchy: what information is most prominent? Is it the most important?
- Content grouping: how are related items grouped? Are groups labelled?
- Progressive disclosure: what's shown immediately vs. what requires expansion/navigation?
- Terminology: is the language consistent? Is jargon used? Are labels clear?

### 5. User flow context
- What did the user do BEFORE reaching this screen? (Previous step, entry point, referral)
- What should the user do NEXT? (Primary action, secondary options, exit paths)
- What happens if the user makes a mistake? (Undo, back, error recovery)
- How does the user know they succeeded? (Confirmation, feedback, state change)

### 6. Competitive context (optional but valuable)
- How do competitors handle this same flow?
- Any user research, analytics, or session recordings that inform the design

## Formatting rules

Format each section:
\`\`\`
--- Component: [Name] ---
--- State: [normal / error / empty / loading] ---
--- User goal: [one sentence] ---
--- User flow: [previous step] → [THIS SCREEN] → [next step] ---
\`\`\`

## Don't forget
- [ ] Include ALL states, not just the happy path — error and empty states are where UX fails most
- [ ] Show the full page context, not just the isolated component
- [ ] Include actual copy/text (labels, instructions, error messages) — wording is a UX decision
- [ ] Note the primary action and how visually prominent it is compared to secondary actions
- [ ] Describe any animations or transitions between states
- [ ] If it's a multi-step flow, include ALL steps, not just one
- [ ] Mention what analytics show about this page (bounce rate, drop-off, time on page) if available

Keep total under 30,000 characters.`,
  },
  {
    id: 'design-system',
    name: 'Design System',
    description: 'Audits design tokens, component APIs, variant coverage, and documentation completeness.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your design tokens, component code, Storybook stories, or token JSON...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['design-system'],
    prepPrompt: `I'm preparing a design system for a **Design System** audit. Please help me collect the relevant files.

## Design system context (fill in)
- System name: [e.g. "Acme DS", unnamed, using a third-party like shadcn/ui or Chakra]
- Scope: [e.g. "10 components", "full system with 50+ components", "just started"]
- Consumer: [e.g. "single product", "3 products sharing the system", "open-source"]
- Framework: [e.g. React, Vue, Web Components, framework-agnostic CSS]
- Documentation tool: [e.g. Storybook, Docusaurus, Styleguidist, none]
- Known concerns: [e.g. "inconsistent spacing", "no dark mode tokens", "components are hard to customise"]

## Files to gather

### 1. Token definitions (the foundation)
- Colour tokens: CSS custom properties (:root variables), Tailwind config theme, tokens.json, or Figma tokens export
- Include the FULL colour palette: primary, secondary, neutral, semantic (success, warning, error, info), and surface colours
- Spacing scale: 4px base? t-shirt sizes? How many steps?
- Typography scale: font families, size scale, line heights, letter spacing, font weights
- Border radius values
- Shadow/elevation definitions
- Z-index scale
- Motion/animation tokens: duration, easing curves
- Breakpoint definitions

### 2. Component files (3-5 representative components)
Choose components that show different patterns:
- A simple component (Button, Badge, Tag)
- A composite component (Card, Dialog, Dropdown)
- A form component (Input, Select, Checkbox)
- A layout component (Stack, Grid, Container)
- A complex interactive component (DataTable, DatePicker, Autocomplete)

For each component, include:
- The component source code with full prop interface/types
- All variant definitions (size, colour, state)
- Default props and prop validation
- Accessibility attributes (role, aria-*, keyboard handling)
- The component's CSS/styles (or Tailwind classes)

### 3. Component documentation
- Storybook stories (*.stories.tsx) for the representative components above
- Usage examples and code snippets
- Prop documentation (auto-generated or manual)
- Do's and don'ts guidelines
- Migration guides between versions (if the system has been versioned)

### 4. System infrastructure
- Component index file / barrel exports (shows the full public API surface)
- Build configuration (how components are bundled for consumers)
- Package.json with peer dependencies (what consumers need to install)
- Theme provider or context provider setup
- Any theming or customisation API (createTheme, extendTheme, CSS variable overrides)

### 5. Consistency audit data
Run these if applicable:
\`\`\`bash
# Find all unique colour values used (Tailwind projects)
grep -roh 'text-[a-z]*-[0-9]*' src/ | sort | uniq -c | sort -rn | head -30
grep -roh 'bg-[a-z]*-[0-9]*' src/ | sort | uniq -c | sort -rn | head -30

# Find all unique font sizes used
grep -roh 'text-[a-z]*' src/ | sort | uniq -c | sort -rn | head -20

# Find all unique spacing values
grep -roh '[pm][trblxy]-[0-9]*' src/ | sort | uniq -c | sort -rn | head -30
\`\`\`

### 6. Design-code sync
- Figma file link or screenshot of the component library (if applicable)
- Any Figma-to-code pipeline (Style Dictionary, Tokens Studio, custom scripts)
- Documentation of which tokens map to which Figma styles

## Formatting rules

Format each file:
\`\`\`
--- tokens/colors.css (or tailwind.config.ts theme section) ---
--- components/Button/Button.tsx ---
--- components/Button/Button.stories.tsx ---
--- components/Dialog/Dialog.tsx ---
--- components/index.ts (barrel exports) ---
\`\`\`

## Don't forget
- [ ] Include the FULL token set, not just colours — spacing and typography tokens matter as much
- [ ] Show component variants: every size, colour, and state combination
- [ ] Include at least one component that has accessibility concerns (modals, dropdowns, tabs)
- [ ] Show how consumers import and use the components (the developer experience)
- [ ] Include the theming/customisation API if it exists
- [ ] Note any inconsistencies you've already noticed (one-off spacing values, hardcoded colours)
- [ ] Include components that deviate from the system (using hardcoded values instead of tokens)

Keep total under 30,000 characters.`,
  },
  {
    id: 'responsive-design',
    name: 'Responsive Design',
    description: 'Reviews breakpoints, fluid layouts, touch targets, and cross-device behaviour.',
    category: 'Design',
    accentClass: 'text-sky-400 hover:bg-sky-500/10',
    buttonClass: 'bg-sky-700 hover:bg-sky-600',
    placeholder: 'Paste your CSS, Tailwind classes, or component code for responsive analysis...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['responsive-design'],
    prepPrompt: `I'm preparing CSS and layout code for a **Responsive Design** audit. Please help me collect the relevant files.

## Responsive context (fill in)
- Target devices: [e.g. "mobile-first, must work on 320px+", "desktop-primary with tablet support", "all devices"]
- Breakpoints: [e.g. "Tailwind defaults: sm 640, md 768, lg 1024, xl 1280", "custom: mobile 480, tablet 768, desktop 1200"]
- Current state: [e.g. "desktop only, adding mobile", "responsive but some components break on tablet", "mobile-first and mostly working"]
- Testing approach: [e.g. "Chrome DevTools only", "BrowserStack", "real devices", "no testing"]
- Known issues: [e.g. "navigation hamburger doesn't work", "text too small on mobile", "horizontal scroll on narrow screens"]

## Files to gather

### 1. Layout system
- Root layout / shell component (app/layout.tsx, _app.tsx, App.vue)
- The Tailwind config (tailwind.config.ts) — FULL file, especially screens/breakpoints and container config
- Global CSS with media queries or container queries
- Any custom grid system or layout utility classes
- CSS for the page being reviewed

### 2. Navigation (often the hardest responsive challenge)
- Desktop navigation component
- Mobile navigation / hamburger menu component
- How the switch between them works (media query? JS? both?)
- Any off-canvas, drawer, or sheet implementations

### 3. Content components (the responsive meat)
- Hero sections with responsive image and text sizing
- Card grids/lists that change layout across breakpoints
- Data tables that need to work on mobile (horizontal scroll? stacked? hide columns?)
- Forms that need to reflow on narrow screens
- Any component that hides or shows based on screen size

### 4. Typography at all breakpoints
- Heading sizes: are they fluid (clamp()) or stepped (sm:text-2xl lg:text-4xl)?
- Body text: does line length stay readable (45-75 characters)?
- Minimum font sizes (is anything below 14px on mobile?)

### 5. Touch targets and interaction
- Button and link sizes: do they meet 44×44px minimum on touch devices?
- Spacing between tap targets: is there enough room to avoid mistaps?
- Hover-dependent interactions: do they have touch/keyboard alternatives?
- Swipe or gesture interactions on mobile

### 6. Images and media
- Responsive images: srcset, sizes, picture element usage
- Art direction: do images change crop or aspect ratio across breakpoints?
- Video embeds: are they responsive (aspect-ratio or padding-bottom trick)?
- Icons: do they scale appropriately?

### 7. Testing evidence (if available)
- Screenshots at key breakpoints: 320px, 375px, 768px, 1024px, 1440px
- Browser DevTools responsive mode findings
- Any real-device testing results
- PageSpeed Insights mobile vs desktop scores

## Formatting rules

Format each section:
\`\`\`
--- tailwind.config.ts (full file) ---
--- app/layout.tsx (root layout) ---
--- components/Navigation/MobileNav.tsx ---
--- components/HeroSection.tsx ---
--- styles/responsive-overrides.css (if any) ---
\`\`\`

## Don't forget
- [ ] Include the viewport meta tag from \`<head>\` — missing or wrong viewport breaks everything
- [ ] Test at 320px wide (iPhone SE) — this is the narrowest realistic target
- [ ] Show how hiding/showing content works across breakpoints (hidden sm:block patterns)
- [ ] Include overflow handling: what happens when content is wider than the viewport?
- [ ] Check that fixed/sticky elements don't cover content on mobile
- [ ] Note if the site uses container queries vs viewport queries
- [ ] Include any responsive utility CSS (sr-only, responsive spacing, etc.)
- [ ] Check for horizontal scrolling at any breakpoint — paste any overflow-x findings

Keep total under 30,000 characters.`,
  },
  {
    id: 'color-typography',
    name: 'Color & Typography',
    description: 'Checks contrast ratios, type scales, palette harmony, and WCAG color compliance.',
    category: 'Design',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your color tokens, CSS variables, Tailwind config, or typography definitions...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['color-typography'],
    prepPrompt: `I'm preparing design tokens for a **Color & Typography** audit (WCAG contrast + visual design). Please help me collect the relevant definitions and usage examples.

## Design context (fill in)
- Visual style: [e.g. "dark theme SaaS", "light & minimal", "bold & colorful", "corporate / conservative"]
- Brand colours: [e.g. "primary: #2563EB, secondary: #10B981", "brand kit attached"]
- Typography: [e.g. "Inter for UI, serif for headings", "system fonts only", "custom typeface"]
- Dark mode: [yes — auto / manual toggle / system preference | no | planned]
- Accessibility target: [WCAG AA (4.5:1) / AAA (7:1) / not yet considered]
- Known concerns: [e.g. "low contrast on disabled states", "too many font sizes", "dark mode colours don't feel right"]

## Content to gather

### 1. Complete colour palette
- All colour tokens/variables organised by role:
  - **Brand/primary**: main brand colour and its tints/shades
  - **Secondary/accent**: secondary actions, highlights
  - **Neutral/gray**: backgrounds, borders, text — every shade from white to black
  - **Semantic**: success (green), warning (amber/yellow), error/danger (red), info (blue)
  - **Surface**: background, card, overlay, modal colours
- Include the hex values, HSL, or Tailwind colour names for each
- Dark mode equivalents for every colour above

### 2. Typography scale (complete)
- Font families: primary (UI), secondary (headings/display), monospace (code)
- Include font weights available for each family
- Size scale: every step from smallest (caption) to largest (display/hero)
  - Include the actual px/rem values AND the Tailwind class or CSS variable name
- Line height for each size step
- Letter spacing values
- Font weight usage guidelines (which weights are used where?)
- Any fluid typography (clamp() functions)

### 3. Colour-on-colour combinations (THE MOST IMPORTANT SECTION)
List every text-on-background combination actually used in the product. For each, provide:
- Text colour (hex)
- Background colour (hex)
- Where it's used (e.g. "body text on page background", "button label on primary button")
- Font size at which it appears (contrast requirements differ for large text)

Common combinations to check:
- Body text on page background (light mode AND dark mode)
- Headings on page background
- Placeholder text on input backgrounds
- Link text on page background (default, hover, visited)
- Button text on button background (primary, secondary, destructive, disabled)
- Text on coloured badges/tags (success, warning, error, info)
- Icon colour on backgrounds
- Border colour contrast against background
- Disabled state text and backgrounds
- Error text on form backgrounds
- Navigation text on header background
- Footer text on footer background
- Text on hover/focus states

### 4. Colour usage in context
- How is colour used to convey meaning? (status indicators, form validation, severity)
- Are there non-colour indicators too? (icons, text, patterns — WCAG 1.4.1 requires it)
- How do interactive state changes use colour? (hover, focus, active, selected, disabled)

### 5. Design tokens source
- tailwind.config.ts theme.colors and theme.fontSize sections
- CSS custom properties (:root { --color-*, --font-* })
- Any tokens.json or Style Dictionary configuration
- Figma styles export (if available)

### 6. Real-world samples
If possible, include:
- A screenshot or HTML of the most text-heavy page (for typography review)
- A screenshot or HTML showing all button/badge variants (for contrast review)
- The landing page or hero section (for visual hierarchy review)

## Formatting rules

Format each section:
\`\`\`
--- Colour palette (all tokens with hex values) ---
--- Typography scale (all sizes with px/rem values) ---
--- Colour combinations (text hex on background hex, where used) ---
--- Dark mode overrides ---
--- tailwind.config.ts (theme section) ---
\`\`\`

## Don't forget
- [ ] Include EVERY colour combination actually used — don't assume they all pass contrast
- [ ] Check BOTH light mode AND dark mode combinations
- [ ] Include disabled state colours — these almost always fail contrast checks
- [ ] Note the font SIZE for each combination — large text (18px+ or 14px+ bold) has a lower contrast requirement (3:1 vs 4.5:1)
- [ ] Include placeholder text colours — these frequently fail
- [ ] Check that colour is never the ONLY way to convey information (add icons, text, or patterns)
- [ ] Include any gradient backgrounds with text over them (contrast varies across the gradient)
- [ ] Note if any colours are hardcoded in components instead of using tokens

Keep total under 30,000 characters.`,
  },
  {
    id: 'motion-interaction',
    name: 'Motion & Interaction',
    description: 'Reviews animations, transitions, micro-interactions, and reduced-motion accessibility.',
    category: 'Design',
    accentClass: 'text-lime-400 hover:bg-lime-500/10',
    buttonClass: 'bg-lime-800 hover:bg-lime-700',
    placeholder: 'Paste your CSS animations, Framer Motion code, or JavaScript animation logic...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['motion-interaction'],
    prepPrompt: `I'm preparing animation and transition code for a **Motion & Interaction** audit. Please help me collect the relevant files.

## Motion context (fill in)
- Animation library: [e.g. CSS-only, Framer Motion, GSAP, React Spring, Web Animations API, Lottie]
- Framework: [e.g. React 19, Next.js 15, Vue 3, Svelte 5]
- Motion philosophy: [e.g. "minimal, functional transitions only", "expressive and playful", "no animations yet"]
- Reduced motion: [handled / not handled / partially handled]
- Known concerns: [e.g. "janky scroll animations", "transitions feel slow", "no loading feedback", "motion-sick users complaining"]

## Files to gather

### 1. CSS animations and transitions
- All @keyframes definitions in the codebase
- All transition properties on interactive elements (hover, focus, expand, collapse)
- Any CSS custom properties for animation timing (--duration-*, --ease-*)
- Tailwind animation configuration (tailwind.config.ts animation section)

### 2. JavaScript animation code
- Framer Motion: variants, AnimatePresence, useSpring, useInView usage
- GSAP: timeline definitions, ScrollTrigger setups
- React Spring: useSpring, useTransition calls
- Web Animations API: element.animate() calls
- requestAnimationFrame usage
- Any animation orchestration (sequencing, staggering, chaining)

### 3. Transition patterns by type
For each of these categories, include the code if it exists:

**Page/route transitions**
- How does content change between routes? (instant, fade, slide, shared element)
- Loading states during navigation

**Component mount/unmount**
- How do modals appear and disappear?
- Toast/notification entrance and exit
- Dropdown/popover open and close
- Accordion expand and collapse
- List item add and remove animations

**Micro-interactions**
- Button hover, press, and click feedback
- Input focus and blur transitions
- Checkbox/toggle/switch animations
- Progress bars and loading spinners
- Success/error state transitions
- Skeleton loading shimmer effects
- Scroll-triggered animations (parallax, fade-in-on-scroll)

**Data visualisation motion** (if applicable)
- Chart animations (bar growth, line drawing, pie rotation)
- Number counting/odometer effects
- Data transition animations (filtering, sorting)

### 4. Reduced motion handling
- All \`@media (prefers-reduced-motion: reduce)\` rules
- Any JavaScript check for \`matchMedia('(prefers-reduced-motion: reduce)')\`
- What specifically changes when reduced motion is active?
- Is reduced motion binary (all or nothing) or do you have nuanced levels?

### 5. Performance considerations
- Any animations using \`transition-all\` (should be explicit properties)
- Animations triggering layout (top/left/width/height instead of transform)
- \`will-change\` usage (is it applied and then removed?)
- GPU-promoted layers (transform: translateZ(0), will-change: transform)
- Any \`requestAnimationFrame\` loops or continuous animations

### 6. Animation timing and easing
- Duration values: are they consistent across the system? (100ms micro, 200ms normal, 300ms emphasis)
- Easing functions: what curves are used? (ease-out for enter, ease-in for exit?)
- Delay values: are any animations delayed unnecessarily?
- Stagger timing for list items or sequential reveals

### 7. Interactive feedback
- Hover states: what visual changes occur? (colour, scale, shadow, translate)
- Focus states: visible focus rings, focus-within patterns
- Active/pressed states: does the UI respond to touch/click immediately?
- Disabled states: do they animate differently?
- Drag interactions: cursor changes, position feedback, drop targets

## Formatting rules

Format each file:
\`\`\`
--- app/globals.css (keyframes and transitions) ---
--- tailwind.config.ts (animation section) ---
--- components/Modal.tsx (mount/unmount animation) ---
--- components/Button.tsx (micro-interaction) ---
--- hooks/useReducedMotion.ts (if it exists) ---
\`\`\`

## Don't forget
- [ ] Check EVERY \`transition-all\` usage — replace with specific properties for performance
- [ ] Verify ALL animations have a \`prefers-reduced-motion\` alternative
- [ ] Check animation durations: nothing should exceed 500ms for UI transitions (except page-level)
- [ ] Ensure no animation blocks interaction (user should never wait for an animation to finish before they can act)
- [ ] Look for infinite animations (spinners, pulsing dots) — they must stop when reduced motion is active
- [ ] Check that focus ring transitions are smooth but not distracting
- [ ] Include scroll-triggered animations — these are a common motion sickness trigger
- [ ] Note any animations that auto-play (carousels, video backgrounds) and their pause mechanism

Keep total under 30,000 characters.`,
  },
  {
    id: 'data-security',
    name: 'Data Security',
    description: 'Audits encryption, key management, secrets handling, DLP, and secure data lifecycle.',
    category: 'Security & Privacy',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your database config, encryption code, secrets management setup, or data flow architecture...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['data-security'],
    prepPrompt: `I'm preparing code and configuration for a **Data Security** audit. Please help me collect the relevant files.

## Data security context (fill in)
- Application type: [e.g. SaaS platform, fintech API, healthcare portal, e-commerce]
- Data sensitivity: [e.g. "handles payment data (PCI)", "stores PHI (HIPAA)", "user PII only"]
- Cloud provider: [e.g. AWS, GCP, Azure, self-hosted]
- Database(s): [e.g. PostgreSQL, MongoDB, DynamoDB, Redis]
- Compliance requirements: [e.g. SOC 2, ISO 27001, PCI DSS, HIPAA, none yet]
- Known concerns: [e.g. "secrets in env vars", "no field-level encryption", "logging PII"]

## Files to gather

### 1. Encryption configuration
- Database connection setup (connection strings, SSL/TLS config)
- Any field-level or column-level encryption code
- TLS/SSL certificate configuration
- File encryption for uploads or exports
- Any custom encryption utilities or wrappers

### 2. Key & secrets management
- Environment variable files (.env.example — NEVER the real .env)
- Vault/KMS configuration (AWS KMS, GCP KMS, HashiCorp Vault setup)
- Secret injection in CI/CD (GitHub Actions secrets, Docker secrets)
- Key rotation scripts or automation
- Any hardcoded keys, tokens, or credentials in source code

### 3. Authentication & credential storage
- Password hashing configuration (bcrypt rounds, argon2 params)
- JWT signing key management
- OAuth client secret storage
- API key generation and storage logic
- Session token management

### 4. Database security
- Database user permissions and roles
- Row-level security (RLS) policies
- Database migration files that handle sensitive columns
- Backup configuration and encryption settings
- Connection pooling with credential management

### 5. Data flow & access controls
- API middleware that handles sensitive data
- Authorization logic for data access
- Data serialization — what fields are exposed in API responses
- Logging configuration — what gets logged and what's redacted
- Error handling — what data appears in error messages/stack traces

### 6. Data lifecycle
- Data retention policies (code or config)
- Deletion/anonymization scripts
- Audit logging implementation
- Data export functionality (GDPR data portability)
- Backup retention and encryption

### 7. Infrastructure security config
- Docker/container security (secrets mounting, no-root user)
- Network policies, firewall rules, security groups
- WAF or API gateway configuration
- CDN security headers configuration

## Formatting rules

Format each file:
\`\`\`
--- lib/db.ts (database connection) ---
--- lib/encryption.ts (encryption utilities) ---
--- .env.example (environment variables template) ---
--- middleware/auth.ts (authentication) ---
--- docker-compose.yml (container config) ---
\`\`\`

## Don't forget
- [ ] NEVER include real secrets, passwords, or API keys — use .env.example or redact them
- [ ] Include ALL database connection configurations (main DB, Redis, message queues)
- [ ] Show how secrets are injected in production vs development
- [ ] Include logging config — this is where PII commonly leaks
- [ ] Check for hardcoded credentials in test files and seed scripts
- [ ] Include error handling code — stack traces can expose sensitive data
- [ ] Show backup and disaster recovery configuration
- [ ] Note which compliance frameworks apply (SOC 2, PCI DSS, HIPAA, etc.)

Keep total under 30,000 characters.`,
  },
  {
    id: 'error-handling',
    name: 'Error Handling',
    description: 'Finds swallowed errors, missing catch blocks, unhandled rejections, and poor recovery patterns.',
    category: 'Code Quality',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste your code with try/catch blocks, error boundaries, or async error handling...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['error-handling'],
    prepPrompt: `I'm preparing code for an **Error Handling** audit. Please help me collect the relevant files.

## Project context (fill in)
- Language / framework: [e.g. TypeScript + Next.js, Python + FastAPI, Go]
- Error handling approach: [e.g. "try/catch everywhere", "Result types", "no consistent pattern"]
- Known concerns: [e.g. "silent failures in production", "users see raw stack traces", "missing error boundaries"]

## Files to gather

### 1. Error-prone code paths
- API route handlers — show all try/catch blocks and error responses
- Database query code — how are query failures handled?
- External API calls — what happens when third-party services fail?
- File I/O operations — upload, download, parse operations

### 2. Error handling infrastructure
- Global error handler / middleware (Express errorHandler, Next.js error.tsx)
- React Error Boundaries (if applicable)
- Logging configuration — how are errors logged?
- Custom error classes or error factory functions

### 3. Async code
- Promise chains — are .catch() handlers present?
- async/await blocks — are they wrapped in try/catch?
- Event handlers and callbacks — what happens on error?
- Stream/WebSocket error handlers

### 4. User-facing error handling
- Error pages (404, 500, custom error pages)
- Form validation error display
- Toast/notification error messages
- Loading/error state components

## Formatting rules

Format each file:
\`\`\`
--- api/route.ts (API error handling) ---
--- components/ErrorBoundary.tsx ---
--- lib/api-client.ts (external API calls) ---
--- middleware/errorHandler.ts ---
\`\`\`

## Don't forget
- [ ] Include ALL catch blocks, even empty ones — especially empty ones
- [ ] Show what error messages users actually see
- [ ] Include any retry logic or circuit breaker patterns
- [ ] Check for unhandled promise rejections in event handlers
- [ ] Look for \`catch (e) {}\` or \`catch (e) { console.log(e) }\` patterns

Keep total under 30,000 characters.`,
  },
  {
    id: 'typescript-strictness',
    name: 'TypeScript Strictness',
    description: 'Finds unsafe any types, missing strict flags, weak generics, and type assertion risks.',
    category: 'Code Quality',
    accentClass: 'text-blue-400 hover:bg-blue-500/10',
    buttonClass: 'bg-blue-700 hover:bg-blue-600',
    placeholder: 'Paste your TypeScript code, tsconfig.json, or type definitions...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['typescript-strictness'],
    prepPrompt: `I'm preparing TypeScript code for a **TypeScript Strictness** audit. Please help me collect the relevant files.

## Project context (fill in)
- TypeScript version: [e.g. 5.9, 5.5, 4.9]
- Framework: [e.g. Next.js 15, Express, NestJS, plain Node]
- Strict mode status: [e.g. "strict: true", "partial strict flags", "no strict mode"]
- Known concerns: [e.g. "lots of any types", "migrated from JS recently", "type assertions everywhere"]

## Files to gather

### 1. TypeScript configuration
- tsconfig.json — the FULL file with all compiler options
- Any extended tsconfig files (tsconfig.base.json, tsconfig.node.json)

### 2. Source files with type concerns
- Files with the most \`any\` usage
- Files with type assertions (\`as\`, \`!\`, \`<Type>\`)
- Files with \`@ts-ignore\` or \`@ts-expect-error\`
- Complex generic functions or utility types

### 3. Type definitions
- Shared type files (types.ts, interfaces.ts)
- API response types — are they validated at runtime?
- Database model types — do they match the actual schema?
- Third-party type augmentations (*.d.ts files)

### 4. API boundaries
- Code that receives external data (API responses, user input, env vars)
- Runtime validation (Zod schemas, io-ts codecs)
- Serialization/deserialization code

## Formatting rules

Format each file:
\`\`\`
--- tsconfig.json ---
--- lib/types.ts ---
--- api/handlers.ts ---
--- lib/validation.ts ---
\`\`\`

## Don't forget
- [ ] Include the FULL tsconfig.json — strict flag settings are critical
- [ ] Search for \`any\` across the codebase and include the worst offenders
- [ ] Include runtime validation code (Zod, io-ts) at API boundaries
- [ ] Check for \`as unknown as X\` double-assertion patterns

Keep total under 30,000 characters.`,
  },
  {
    id: 'react-patterns',
    name: 'React Patterns',
    description: 'Reviews hooks, component design, state management, re-renders, and Server Component boundaries.',
    category: 'Code Quality',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-800 hover:bg-cyan-700',
    placeholder: 'Paste your React components, hooks, or state management code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['react-patterns'],
    prepPrompt: `I'm preparing React code for a **React Patterns** audit. Please help me collect the relevant files.

## Project context (fill in)
- React version: [e.g. 19.2, 18.3]
- Framework: [e.g. Next.js 15 App Router, Vite + React, Remix]
- State management: [e.g. "React Context only", "Zustand", "Redux Toolkit", "React Query"]
- Known concerns: [e.g. "slow renders", "prop drilling", "useEffect soup", "unclear client/server boundary"]

## Files to gather

### 1. Component tree
- Root layout / App component
- The largest or most complex component
- Components with many useEffect hooks
- Components with many useState calls
- Any components wrapped in React.memo

### 2. Hooks
- Custom hooks (useAuth, useFetch, useDebounce, etc.)
- Components with complex useEffect dependency arrays
- useMemo / useCallback usage — include surrounding context
- useRef usage

### 3. State management
- Context providers and their value objects
- Global state stores (Zustand, Redux, Jotai)
- Data fetching patterns (React Query, SWR, useEffect + fetch)
- Form state handling

### 4. Server/Client boundary (Next.js / RSC)
- All files with \`'use client'\` directive
- Server Components that fetch data
- Components that could be server components but are marked client

## Formatting rules

Format each file:
\`\`\`
--- components/Dashboard.tsx (largest component) ---
--- hooks/useAuth.ts (custom hook) ---
--- providers/ThemeProvider.tsx (context) ---
--- app/layout.tsx (server component) ---
\`\`\`

## Don't forget
- [ ] Include ALL useEffect hooks with their dependency arrays
- [ ] Include components that re-render frequently (parent state changes)
- [ ] Show the component hierarchy / import tree for the main page
- [ ] Include any React.memo, useMemo, or useCallback usage with context

Keep total under 30,000 characters.`,
  },
  {
    id: 'i18n',
    name: 'Internationalization',
    description: 'Finds hardcoded strings, locale-dependent formatting, RTL issues, and i18n architecture gaps.',
    category: 'Design',
    accentClass: 'text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste your UI components, translation files, or locale configuration...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['i18n'],
    prepPrompt: `I'm preparing code for an **Internationalization (i18n)** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js 15, React + Vite, Vue 3]
- Current i18n status: [e.g. "not started", "partially translated", "using next-intl"]
- Target languages: [e.g. "English + Spanish + French", "English only for now", "30+ languages"]
- RTL support needed: [yes / no / future]
- Known concerns: [e.g. "hundreds of hardcoded strings", "dates formatted inconsistently"]

## Files to gather

### 1. UI components with user-facing text
- Navigation / header / footer
- Forms (labels, placeholders, validation messages, error text)
- Modals and dialogs
- Empty states, loading states, error pages
- Email templates

### 2. i18n configuration (if it exists)
- i18n library setup (next-intl, react-intl, i18next config)
- Translation files (en.json, es.json, etc.)
- Locale detection / routing configuration
- Language switcher component

### 3. Date, number, and currency formatting
- All date formatting code (toLocaleDateString, dayjs, date-fns)
- Number formatting (toLocaleString, Intl.NumberFormat)
- Currency display code
- Relative time display ("2 hours ago")

### 4. Layout and styling
- CSS that uses left/right (vs logical properties)
- Fixed-width elements that contain text
- Text truncation patterns
- Icon-only buttons (need aria-labels)

## Formatting rules

Format each file:
\`\`\`
--- components/Navbar.tsx (user-facing strings) ---
--- lib/i18n.ts (i18n config) ---
--- locales/en.json (translation file) ---
--- components/DateDisplay.tsx (date formatting) ---
\`\`\`

## Don't forget
- [ ] Include EVERY component with user-facing strings
- [ ] Check for string concatenation used to build messages (breaks in other languages)
- [ ] Include plural handling code (if any)
- [ ] Look for text in images or SVGs
- [ ] Check that error messages are externalized too

Keep total under 30,000 characters.`,
  },
  {
    id: 'rate-limiting',
    name: 'Rate Limiting',
    description: 'Audits API throttling, abuse prevention, DDoS surface, and cost-based endpoint protection.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-700 hover:bg-red-600',
    placeholder: 'Paste your API routes, middleware, rate limiting config, or WAF rules...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['rate-limiting'],
    prepPrompt: `I'm preparing code for a **Rate Limiting** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js API routes, Express, FastAPI]
- Current rate limiting: [e.g. "none", "express-rate-limit on /api", "Cloudflare WAF"]
- Traffic volume: [e.g. "100 RPM", "10K RPM", "unknown"]
- Cost-sensitive endpoints: [e.g. "AI API calls at $0.01/request", "email sends"]
- Known concerns: [e.g. "login brute force possible", "no limits on AI endpoint", "scraping risk"]

## Files to gather

### 1. All API endpoints / route handlers
- Every route file — the audit needs the FULL endpoint inventory
- Include HTTP method, authentication requirement, and purpose

### 2. Rate limiting configuration
- Rate limiting middleware (express-rate-limit, custom middleware)
- WAF / CDN rate limit rules
- Application-level throttling code
- Per-user or per-IP limit configuration

### 3. Authentication endpoints
- Login / signup handlers
- Password reset flow
- 2FA / OTP verification
- OAuth callback handlers

### 4. Cost-incurring endpoints
- AI / LLM API call handlers
- Email / SMS sending code
- External API call handlers
- File upload handlers

## Formatting rules

Format each file:
\`\`\`
--- app/api/audit/route.ts (AI endpoint) ---
--- middleware/rateLimit.ts ---
--- app/api/auth/[...all]/route.ts ---
\`\`\`

## Don't forget
- [ ] Include ALL endpoints, not just the ones you think need rate limiting
- [ ] Show how rate limit state is stored (memory, Redis, database)
- [ ] Include any WAF or CDN configuration
- [ ] Note which endpoints are public (no auth required)

Keep total under 30,000 characters.`,
  },
  {
    id: 'logging',
    name: 'Logging & Monitoring',
    description: 'Reviews structured logging, log levels, PII exposure in logs, and audit trail completeness.',
    category: 'Infrastructure',
    accentClass: 'text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-800 hover:bg-teal-700',
    placeholder: 'Paste your logging configuration, error handlers, or code with console/logger calls...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['logging'],
    prepPrompt: `I'm preparing code for a **Logging & Monitoring** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js 15, Express, NestJS]
- Logging library: [e.g. "console.log only", "pino", "winston", "Datadog APM"]
- Log aggregation: [e.g. "none", "CloudWatch", "Datadog", "ELK stack"]
- Compliance requirements: [e.g. "SOC 2 audit trail needed", "HIPAA logging", "none"]
- Known concerns: [e.g. "PII in logs", "no structured logging", "can't debug production issues"]

## Files to gather

### 1. Logging setup
- Logger configuration / initialization
- Log formatting (JSON structured, plain text)
- Log transport / output configuration
- Environment-specific log level settings

### 2. Error handling with logging
- Global error handlers / middleware
- try/catch blocks that log errors
- Unhandled rejection / exception handlers

### 3. Business logic logging
- Authentication event logging (login, logout, failed attempts)
- API request/response logging
- Database query logging
- Payment or sensitive operation logging

### 4. Code with console.* calls
- All console.log, console.error, console.warn usage
- Debug output that might be left in production

## Formatting rules

Format each file:
\`\`\`
--- lib/logger.ts (logger setup) ---
--- middleware/requestLogger.ts ---
--- api/auth/route.ts (auth event logging) ---
\`\`\`

## Don't forget
- [ ] Search for ALL console.log/console.error calls in the codebase
- [ ] Include error handlers — are errors logged with enough context?
- [ ] Check for PII in log output (emails, IPs, tokens, passwords)
- [ ] Include any log rotation or retention configuration

Keep total under 30,000 characters.`,
  },
  {
    id: 'database-migrations',
    name: 'Database Migrations',
    description: 'Reviews migration safety, lock risks, rollback plans, and zero-downtime schema changes.',
    category: 'Infrastructure',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your migration files, schema definitions, or Drizzle/Prisma migration output...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['database-migrations'],
    prepPrompt: `I'm preparing database migrations for a **Migration Safety** audit. Please help me collect the relevant files.

## Project context (fill in)
- Database: [e.g. PostgreSQL 16, MySQL 8, SQLite]
- Migration tool: [e.g. Drizzle Kit, Prisma Migrate, Flyway, Knex, Rails migrations]
- Table sizes: [e.g. "users: 50K rows", "orders: 2M rows", "small DB < 10K rows"]
- Deployment strategy: [e.g. "zero-downtime required", "maintenance window OK", "single server"]
- Known concerns: [e.g. "adding NOT NULL column to large table", "need to rename columns", "first migration"]

## Files to gather

### 1. Migration files
- ALL migration files in order (drizzle/, prisma/migrations/, db/migrate/)
- The current schema definition file
- Any seed or data migration scripts

### 2. Schema definition
- Drizzle schema (schema.ts) or Prisma schema (schema.prisma)
- Any raw SQL migration scripts
- Index definitions

### 3. Migration configuration
- drizzle.config.ts / prisma configuration
- Migration run scripts in package.json
- CI/CD pipeline steps that run migrations

### 4. Database connection
- Connection pool configuration
- Environment-specific database URLs (.env.example)

## Formatting rules

Format each file:
\`\`\`
--- drizzle/0001_create_users.sql ---
--- lib/auth-schema.ts (Drizzle schema) ---
--- drizzle.config.ts ---
\`\`\`

## Don't forget
- [ ] Include ALL migration files, not just the latest
- [ ] Include the schema file that generates migrations
- [ ] Note the approximate row count for tables being altered
- [ ] Include the deployment process for running migrations

Keep total under 30,000 characters.`,
  },
  {
    id: 'concurrency',
    name: 'Concurrency & Async',
    description: 'Finds race conditions, deadlocks, resource leaks, and unsafe async patterns.',
    category: 'Performance',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your async code, database transactions, queue consumers, or connection pool setup...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['concurrency'],
    prepPrompt: `I'm preparing code for a **Concurrency & Async** audit. Please help me collect the relevant files.

## Project context (fill in)
- Language / runtime: [e.g. Node.js 20, Go 1.22, Python 3.12 + asyncio]
- Concurrency model: [e.g. "single-threaded event loop", "goroutines", "thread pool"]
- Database: [e.g. PostgreSQL with connection pool, Redis, MongoDB]
- Known concerns: [e.g. "race condition on user balance", "connection pool exhaustion", "fire-and-forget promises"]

## Files to gather

### 1. Async operations
- All async/await code with complex flows (parallel, sequential, conditional)
- Promise.all / Promise.allSettled / Promise.race usage
- Fire-and-forget operations (async without await)
- Stream processing code

### 2. Shared state
- In-memory caches or singletons modified by multiple requests
- Global variables accessed concurrently
- Rate limiter / counter implementations
- Session or user state management

### 3. Database transactions
- Transaction blocks (BEGIN/COMMIT/ROLLBACK)
- Connection pool configuration
- Optimistic locking / version columns
- Bulk operations (batch inserts, updates)

### 4. Queue / event processing
- Message queue consumers (Bull, SQS, RabbitMQ)
- Event emitter patterns
- Cron jobs or scheduled tasks
- WebSocket connection management

## Formatting rules

Format each file:
\`\`\`
--- lib/db.ts (connection pool) ---
--- api/transfer/route.ts (transaction code) ---
--- lib/rateLimiter.ts (shared state) ---
--- workers/emailQueue.ts (queue consumer) ---
\`\`\`

## Don't forget
- [ ] Include ALL database transaction code
- [ ] Show connection pool configuration (min, max, timeout)
- [ ] Include any in-memory state shared across requests
- [ ] Check for fire-and-forget async calls (no await, no .catch)

Keep total under 30,000 characters.`,
  },
  {
    id: 'ci-cd',
    name: 'Git & CI/CD',
    description: 'Audits pipeline security, build performance, deployment strategy, and branch protection.',
    category: 'Infrastructure',
    accentClass: 'text-slate-300 hover:bg-slate-500/10',
    buttonClass: 'bg-slate-700 hover:bg-slate-600',
    placeholder: 'Paste your GitHub Actions workflows, CI config, Dockerfile, or deployment scripts...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['ci-cd'],
    prepPrompt: `I'm preparing CI/CD configuration for a **Git & CI/CD** audit. Please help me collect the relevant files.

## Project context (fill in)
- CI/CD platform: [e.g. GitHub Actions, GitLab CI, CircleCI, Jenkins]
- Hosting: [e.g. Vercel, Railway, AWS ECS, self-hosted]
- Deployment strategy: [e.g. "push to main auto-deploys", "manual deploy", "blue-green"]
- Known concerns: [e.g. "slow builds", "no staging environment", "secrets in workflow files"]

## Files to gather

### 1. CI/CD configuration
- ALL workflow/pipeline files (.github/workflows/*.yml, .gitlab-ci.yml, Jenkinsfile)
- Build scripts in package.json (build, test, lint, deploy)
- Dockerfile and docker-compose.yml (if containerized)
- Any deployment scripts (deploy.sh, cdk.ts, terraform)

### 2. Git configuration
- Branch protection rules (describe or screenshot)
- .gitignore
- PR template (.github/pull_request_template.md)
- CODEOWNERS file

### 3. Environment & secrets
- .env.example (NOT .env — never include real secrets)
- How secrets are referenced in CI (secrets.*, env vars)
- Environment-specific configuration

### 4. Quality gates
- ESLint / Prettier configuration
- Test configuration (jest.config, vitest.config)
- Any pre-commit hooks (husky, lint-staged)
- Code coverage configuration

## Formatting rules

Format each file:
\`\`\`
--- .github/workflows/ci.yml ---
--- .github/workflows/deploy.yml ---
--- Dockerfile ---
--- .gitignore ---
\`\`\`

## Don't forget
- [ ] Include ALL workflow files, not just the main one
- [ ] Show how secrets are injected (env vars, secret stores)
- [ ] Include Docker configuration if the app is containerized
- [ ] Note the typical CI run time and any known bottlenecks

Keep total under 30,000 characters.`,
  },
  {
    id: 'regex-review',
    name: 'Regex Review',
    description: 'Detects ReDoS vulnerabilities, incorrect matches, and unreadable patterns.',
    category: 'Code Quality',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste code containing regular expressions...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['regex-review'],
    prepPrompt: `I'm preparing code for a **Regex Review** audit. Please help me collect the relevant files.

## Project context (fill in)
- Language: [e.g. JavaScript, Python, Go, Java]
- Regex engine: [e.g. V8 (JS), PCRE (PHP), RE2 (Go), re (Python)]
- Where regex is used: [e.g. input validation, URL routing, log parsing, search]
- Known concerns: [e.g. "slow regex on large input", "email validation not working", "unsure about security"]

## Files to gather
- ALL files containing regex patterns (search for /.../ or new RegExp or re.compile)
- Input validation code that uses regex
- URL routing or path matching
- Log parsing or text extraction code
- Any regex utility functions

## Don't forget
- [ ] Include the INPUT that each regex processes — is it user-controlled?
- [ ] Note which regexes run on every request (performance-critical)
- [ ] Include any regex that has been "working but we're not sure why"

Keep total under 30,000 characters.`,
  },
  {
    id: 'monorepo',
    name: 'Monorepo Structure',
    description: 'Reviews package boundaries, dependency graphs, build config, and shared code organization.',
    category: 'Code Quality',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your package.json files, workspace config, turborepo/nx config, or project structure...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['monorepo'],
    prepPrompt: `I'm preparing a monorepo for a **Structure** audit. Please help me collect the relevant files.

## Project context (fill in)
- Build system: [e.g. Turborepo, Nx, Lerna, pnpm workspaces, Bazel]
- Package count: [e.g. 5 packages, 20 packages]
- Known concerns: [e.g. "slow builds", "circular deps", "unclear package boundaries"]

## Files to gather
- Root package.json and workspace config (pnpm-workspace.yaml, turbo.json, nx.json)
- Every package's package.json
- Shared tsconfig files
- Build configuration (turbo.json pipelines, nx.json targets)
- Any shared eslint/prettier configs

## Don't forget
- [ ] Run \`ls packages/*/package.json\` to list all packages
- [ ] Include the dependency graph if your tool can generate one
- [ ] Note which packages are publishable vs internal

Keep total under 30,000 characters.`,
  },
  {
    id: 'graphql',
    name: 'GraphQL',
    description: 'Audits schema design, resolver performance, N+1 queries, field authorization, and depth limiting.',
    category: 'Infrastructure',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your GraphQL schema, resolvers, or query code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['graphql'],
    prepPrompt: `I'm preparing a GraphQL API for an audit. Please help me collect the relevant files.

## Project context (fill in)
- GraphQL framework: [e.g. Apollo Server, Yoga, Pothos, Nexus, gqlgen]
- Schema approach: [schema-first / code-first]
- Known concerns: [e.g. "N+1 queries", "no auth on fields", "slow queries"]

## Files to gather
- Full GraphQL schema (SDL or generated)
- ALL resolver files
- DataLoader setup (if any)
- Auth/permission middleware for GraphQL
- Query depth/complexity limiting config
- Any custom scalars or directives

## Don't forget
- [ ] Include the FULL schema, not just a sample
- [ ] Show how auth is applied per field/type
- [ ] Include any persisted query configuration

Keep total under 30,000 characters.`,
  },
  {
    id: 'websocket',
    name: 'WebSocket & Realtime',
    description: 'Reviews connection lifecycle, reconnection, auth on persistent connections, and backpressure.',
    category: 'Infrastructure',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your WebSocket server/client code, Socket.IO config, or SSE implementation...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['websocket'],
    prepPrompt: `I'm preparing real-time code for a **WebSocket & Realtime** audit. Please help me collect the relevant files.

## Project context (fill in)
- Library: [e.g. ws, Socket.IO, Pusher, Ably, Server-Sent Events, WebSocket API]
- Use case: [e.g. chat, live dashboard, notifications, collaborative editing]
- Known concerns: [e.g. "connections drop randomly", "no reconnection logic", "memory leaks"]

## Files to gather
- WebSocket server setup and handlers
- Client-side connection/reconnection code
- Authentication for WebSocket connections
- Message type definitions and handlers
- Any pub/sub or room management code
- Connection monitoring/health checks

## Don't forget
- [ ] Include both server AND client code
- [ ] Show how authentication works on the WebSocket connection
- [ ] Include reconnection logic (or note its absence)

Keep total under 30,000 characters.`,
  },
  {
    id: 'container-security',
    name: 'Container Security',
    description: 'Audits Dockerfiles for root users, image provenance, secret leaks, and runtime hardening.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-700 hover:bg-red-600',
    placeholder: 'Paste your Dockerfile, docker-compose.yml, or Kubernetes manifests...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['container-security'],
    prepPrompt: `I'm preparing container configuration for a **Container Security** audit. Please help me collect the relevant files.

## Project context (fill in)
- Container runtime: [e.g. Docker, Podman, containerd]
- Orchestration: [e.g. Kubernetes, Docker Compose, ECS, none]
- Registry: [e.g. Docker Hub, ECR, GCR, GHCR]
- Known concerns: [e.g. "running as root", "large image", "secrets in build args"]

## Files to gather
- ALL Dockerfiles
- docker-compose.yml / docker-compose.prod.yml
- .dockerignore
- Kubernetes manifests (deployments, services, ingress, network policies)
- Any image scanning configuration (Trivy, Snyk)
- Entrypoint/startup scripts

## Don't forget
- [ ] Include ALL Dockerfiles (dev, prod, CI)
- [ ] Note the base image and its tag/digest
- [ ] Include any secret mounting or env injection patterns

Keep total under 30,000 characters.`,
  },
  {
    id: 'cors-headers',
    name: 'CORS & Headers',
    description: 'Audits CORS policy, security headers, cookie settings, and origin-based access control.',
    category: 'Security & Privacy',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your CORS configuration, middleware, security headers, or server config...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['cors-headers'],
    prepPrompt: `I'm preparing server configuration for a **CORS & Headers** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js, Express, Fastify, Nginx]
- Deployment: [e.g. Vercel, AWS, self-hosted behind Nginx]
- API consumers: [e.g. same-origin SPA, mobile app, third-party integrations]
- Known concerns: [e.g. "CORS errors in production", "missing security headers", "cross-origin cookie issues"]

## Files to gather
- CORS middleware or configuration
- next.config.ts headers section
- middleware.ts (if it sets headers)
- nginx.conf / Caddyfile / reverse proxy config
- Cookie setting code
- Any helmet.js or security header middleware

## Don't forget
- [ ] Include ALL places where headers are set (can be multiple)
- [ ] Show cookie attributes (Secure, HttpOnly, SameSite)
- [ ] Include any CSP configuration

Keep total under 30,000 characters.`,
  },
  {
    id: 'api-security',
    name: 'API Security',
    description: 'Audits OWASP API Top 10, endpoint hardening, BOLA/BFLA, input validation, and API abuse vectors.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-700 hover:bg-red-600',
    placeholder: 'Paste your API route handlers, middleware, OpenAPI spec, or endpoint definitions...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['api-security'],
    prepPrompt: `I'm preparing API code for an **API Security** audit (OWASP API Top 10). Please help me collect the relevant files.

## API context (fill in)
- Framework: [e.g. Express, Fastify, Django REST, FastAPI, Spring Boot, Next.js API routes]
- API style: [REST / GraphQL / gRPC / WebSocket]
- Authentication: [e.g. JWT Bearer, API keys, OAuth2, session cookies]
- Authorization: [e.g. RBAC, ABAC, per-resource checks, none]
- Known concerns: [e.g. "no rate limiting", "users can access other users' data", "no input validation"]

## Files to gather

### 1. API route handlers (ALL of them)
- Every endpoint handler — not just the "risky" ones
- Include the full request → validate → authorize → process → respond flow
- Show how path/query/body parameters are used

### 2. Authentication middleware
- How tokens/sessions are verified
- How user identity is extracted from requests
- Any API key validation logic

### 3. Authorization logic
- Per-endpoint permission checks
- Object-level access control (does the user own this resource?)
- Function-level access control (is the user allowed to call this endpoint?)
- Admin vs. user role separation

### 4. Input validation
- Request body schemas (Zod, Joi, class-validator, Pydantic, etc.)
- Query parameter validation
- Path parameter validation
- File upload handling

### 5. Rate limiting & abuse prevention
- Rate limiter configuration
- Per-endpoint throttling rules
- API key usage limits

### 6. API specification (if available)
- OpenAPI/Swagger definition
- GraphQL schema
- Postman collection

## Formatting rules

Format each file:
\`\`\`
--- routes/users.ts (user endpoints) ---
--- middleware/auth.ts (authentication) ---
--- middleware/validate.ts (input validation) ---
--- lib/permissions.ts (authorization) ---
\`\`\`

## Don't forget
- [ ] Include ALL endpoints — the audit finds risks you didn't expect
- [ ] Show both the route definition AND the handler implementation
- [ ] Include error responses — these can leak internal information
- [ ] Show how object IDs in URLs are validated against the authenticated user
- [ ] Include any admin-only endpoints and how they're protected

Keep total under 30,000 characters.`,
  },
  {
    id: 'secrets-scanner',
    name: 'Secrets Scanner',
    description: 'Scans for leaked API keys, tokens, credentials, .env contents, and hardcoded secrets.',
    category: 'Security & Privacy',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-800 hover:bg-rose-700',
    placeholder: 'Paste your source code, configuration files, or .env.example for secrets scanning...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['secrets-scanner'],
    prepPrompt: `I'm preparing code for a **Secrets Scanner** audit. Please help me collect the relevant files.

## Project context (fill in)
- Language / framework: [e.g. Node.js + Next.js, Python + Django, Go]
- Secrets management: [e.g. env vars, HashiCorp Vault, AWS Secrets Manager, .env files, none]
- Cloud provider: [e.g. AWS, GCP, Azure — this helps identify key formats]
- Known concerns: [e.g. "old API key might be in git history", "not sure if .env is gitignored", "test files use real credentials"]

## Files to gather

### 1. Configuration files
- .env.example (NEVER the real .env — but note if .env is gitignored)
- .gitignore (to verify secret files are excluded)
- docker-compose.yml (environment sections)
- CI/CD workflow files (secret references)

### 2. Source code with potential secrets
- Database connection setup files
- API client initialization (where API keys are set)
- Authentication configuration (JWT secrets, OAuth client secrets)
- Email/SMS service setup (SendGrid, Twilio, etc.)
- Payment processing setup (Stripe, etc.)
- Any file referencing process.env, os.environ, or similar

### 3. Test and seed files
- Test fixtures and factories
- Database seed scripts
- Mock/stub configurations
- Integration test setup

### 4. Infrastructure files
- Terraform / CloudFormation / Pulumi files
- Kubernetes manifests (secrets, configmaps)
- Ansible playbooks / Chef recipes
- Any scripts that handle credentials

### 5. Pre-commit configuration
- .pre-commit-config.yaml
- Any secret scanning tool config (detect-secrets baseline, gitleaks.toml)

## Formatting rules

Format each file:
\`\`\`
--- .env.example ---
--- .gitignore ---
--- lib/db.ts (database connection) ---
--- lib/stripe.ts (payment setup) ---
--- docker-compose.yml ---
\`\`\`

## Don't forget
- [ ] NEVER paste real secrets — use .env.example or redact values
- [ ] Include .gitignore to verify secret file exclusion
- [ ] Show ALL files that read environment variables
- [ ] Include test files — they often contain real credentials
- [ ] Note if git history might contain previously committed secrets
- [ ] Include any existing secret scanning configuration

Keep total under 30,000 characters.`,
  },
  {
    id: 'xss-prevention',
    name: 'XSS Prevention',
    description: 'Analyzes DOM XSS, reflected/stored XSS, mutation XSS, CSP, and output encoding.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-800 hover:bg-red-700',
    placeholder: 'Paste your frontend code, templates, rendering logic, or CSP configuration...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['xss-prevention'],
    prepPrompt: `I'm preparing code for an **XSS Prevention** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. React, Vue, Angular, Next.js, Django templates, Jinja2, EJS, raw HTML]
- Auto-escaping: [yes/no — does the template engine auto-escape by default?]
- CSP: [yes/no — is Content Security Policy configured?]
- Known concerns: [e.g. "using dangerouslySetInnerHTML", "rendering user-generated HTML", "no CSP"]

## Files to gather

### 1. User input rendering
- ALL components/templates that display user-provided content
- Markdown or rich text rendering code
- Comment/review/message display components
- Profile pages that show user-submitted data
- Search results pages (reflected input)

### 2. Escape hatch usage
- Any use of dangerouslySetInnerHTML (React)
- Any use of v-html (Vue)
- Any use of {!! !!} or |raw (Blade/Twig)
- Any use of |safe or mark_safe (Django/Jinja2)
- Any use of innerHTML, outerHTML, document.write in JS

### 3. DOM manipulation
- JavaScript that modifies the DOM with user input
- URL parameter reading (location.search, URLSearchParams)
- postMessage handlers
- localStorage/sessionStorage reads rendered to DOM

### 4. CSP and security headers
- Content-Security-Policy configuration
- next.config.ts headers section
- helmet.js or similar middleware
- meta CSP tags in HTML

### 5. Sanitization libraries
- DOMPurify, sanitize-html, or similar library usage
- Custom sanitization functions
- Input validation that filters HTML/script content

## Formatting rules

Format each file:
\`\`\`
--- components/Comment.tsx (renders user content) ---
--- lib/sanitize.ts (HTML sanitization) ---
--- middleware.ts (CSP headers) ---
--- pages/search.tsx (URL params in output) ---
\`\`\`

## Don't forget
- [ ] Include ALL places where user content is rendered — not just "obvious" ones
- [ ] Show the full data path from user input to rendering
- [ ] Include CSP configuration from ALL sources (headers, meta tags, CDN)
- [ ] Note any third-party widgets that inject HTML (ads, embeds, chat widgets)
- [ ] Include any sanitization library configuration

Keep total under 30,000 characters.`,
  },
  {
    id: 'csrf-ssrf',
    name: 'CSRF & SSRF',
    description: 'Audits request forgery vectors, SameSite cookies, CSRF tokens, SSRF to internal services.',
    category: 'Security & Privacy',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your form handlers, cookie config, server-side HTTP requests, or URL fetching logic...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['csrf-ssrf'],
    prepPrompt: `I'm preparing code for a **CSRF & SSRF** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js, Express, Django, Rails, Spring Boot]
- Cookie strategy: [e.g. SameSite=Lax, SameSite=Strict, no SameSite attribute]
- Anti-CSRF: [e.g. CSRF tokens, double-submit cookie, none]
- Server-side fetching: [e.g. "we fetch user-provided URLs", "webhook delivery", "image proxy"]
- Known concerns: [e.g. "no CSRF tokens on forms", "URL parameter used in fetch()", "webhook URL not validated"]

## Files to gather

### 1. CSRF-relevant code
- All state-changing form handlers (POST, PUT, DELETE endpoints)
- Cookie configuration (session cookies, auth cookies)
- CSRF token generation and validation middleware
- Form components showing CSRF token inclusion
- Any SameSite cookie configuration

### 2. SSRF-relevant code
- Any server-side HTTP requests (fetch, axios, got, httpx, requests)
- Webhook delivery code
- URL/image proxy endpoints
- OAuth callback handlers that fetch provider URLs
- Any code that takes a URL as user input and fetches it
- PDF generation from URLs
- Screenshot/preview services

### 3. Origin validation
- Origin/Referer header checking middleware
- CORS configuration (related to CSRF bypass)
- Any allowlist/blocklist for URLs

### 4. Network configuration
- Firewall rules or security groups
- Internal service URLs and how they're accessed
- Cloud metadata endpoint blocking (169.254.169.254)

## Formatting rules

Format each file:
\`\`\`
--- middleware/csrf.ts (CSRF protection) ---
--- lib/cookies.ts (cookie configuration) ---
--- api/webhooks/route.ts (webhook delivery) ---
--- lib/fetch.ts (server-side HTTP client) ---
\`\`\`

## Don't forget
- [ ] Include ALL state-changing endpoints (POST/PUT/DELETE)
- [ ] Show cookie attributes (SameSite, Secure, HttpOnly)
- [ ] Include EVERY place the server makes outbound HTTP requests
- [ ] Note if any endpoint accepts a URL parameter from the user
- [ ] Include network/firewall configuration if available

Keep total under 30,000 characters.`,
  },
  {
    id: 'cryptography',
    name: 'Cryptography Audit',
    description: 'Audits encryption algorithms, key sizes, TLS config, password hashing, and RNG usage.',
    category: 'Security & Privacy',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste your encryption code, TLS configuration, password hashing, or key management setup...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['cryptography'],
    prepPrompt: `I'm preparing code for a **Cryptography** audit. Please help me collect the relevant files.

## Project context (fill in)
- Language / framework: [e.g. Node.js + crypto, Python + cryptography, Java + BouncyCastle]
- Encryption use cases: [e.g. password hashing, field-level encryption, TLS, JWT signing, file encryption]
- Compliance: [e.g. FIPS 140-2, PCI DSS, HIPAA — these affect algorithm requirements]
- Known concerns: [e.g. "using MD5 somewhere", "not sure about TLS version", "hardcoded encryption key"]

## Files to gather

### 1. Encryption and hashing code
- Password hashing (bcrypt, argon2, PBKDF2 calls)
- Data encryption (AES, RSA usage)
- JWT signing and verification (algorithm selection, key handling)
- HMAC generation
- Any use of crypto/subtle, node:crypto, cryptography, javax.crypto

### 2. TLS/SSL configuration
- HTTPS server setup
- TLS certificate configuration
- Minimum TLS version settings
- Cipher suite configuration
- mTLS setup (if applicable)

### 3. Key management
- Where encryption keys are stored
- Key generation code
- Key rotation scripts or automation
- KMS/Vault integration
- .env.example showing key-related variables

### 4. Random number generation
- Token generation (session IDs, password reset tokens, API keys)
- Nonce or IV generation
- Any use of Math.random() or similar non-crypto RNG

### 5. Certificate handling
- Certificate loading and validation
- Certificate pinning configuration
- HSTS configuration

## Formatting rules

Format each file:
\`\`\`
--- lib/crypto.ts (encryption utilities) ---
--- lib/auth/password.ts (password hashing) ---
--- lib/jwt.ts (JWT signing) ---
--- server.ts (TLS configuration) ---
--- .env.example (key variables) ---
\`\`\`

## Don't forget
- [ ] Include ALL files that import crypto libraries
- [ ] Show the full password hashing flow (hash + verify)
- [ ] Include TLS configuration from ALL layers (app, reverse proxy, CDN)
- [ ] Note any FIPS or compliance requirements that constrain algorithm choices
- [ ] Include random token generation for ALL security purposes

Keep total under 30,000 characters.`,
  },
  {
    id: 'cloud-iam',
    name: 'Cloud IAM',
    description: 'Audits AWS/GCP/Azure IAM permissions, least privilege, role sprawl, and trust policies.',
    category: 'Security & Privacy',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your IAM policies, Terraform IAM resources, role definitions, or cloud config...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['cloud-iam'],
    prepPrompt: `I'm preparing cloud IAM configuration for a **Cloud IAM** audit. Please help me collect the relevant files.

## Cloud context (fill in)
- Cloud provider(s): [e.g. AWS, GCP, Azure, multi-cloud]
- IaC tool: [e.g. Terraform, CloudFormation, Pulumi, CDK, none]
- Account structure: [e.g. single account, AWS Organizations, GCP Organization]
- Identity provider: [e.g. AWS SSO, Azure AD/Entra, Google Workspace, Okta]
- Known concerns: [e.g. "too many admin users", "wildcard permissions", "no MFA enforcement"]

## Files to gather

### 1. IAM policies
- ALL IAM policy documents (inline and managed)
- Terraform/CloudFormation IAM resources (aws_iam_policy, aws_iam_role, etc.)
- Role trust policies (AssumeRole conditions)
- Service control policies (SCPs) if applicable
- Permission boundaries

### 2. User and role inventory
- IAM user list with group memberships
- IAM role list with attached policies
- Service accounts / machine identities
- Cross-account role assumptions

### 3. Resource policies
- S3 bucket policies
- KMS key policies
- Lambda resource policies
- API Gateway resource policies
- Any resource-based policy

### 4. Identity federation
- SSO configuration
- SAML/OIDC provider setup
- External identity provider integration
- Group-to-role mappings

### 5. Credential management
- Access key age and rotation
- MFA enforcement configuration
- Password policy
- Programmatic access patterns

## Formatting rules

Format each file:
\`\`\`
--- terraform/iam.tf (IAM roles and policies) ---
--- policies/admin-policy.json (admin policy) ---
--- terraform/scp.tf (service control policies) ---
--- terraform/s3.tf (bucket policies) ---
\`\`\`

## Don't forget
- [ ] Include ALL IAM policies — not just the ones you think are risky
- [ ] Show role trust policies (who can assume each role)
- [ ] Include resource-based policies (S3, KMS, Lambda)
- [ ] Note any cross-account access patterns
- [ ] Include MFA and password policy configuration

Keep total under 30,000 characters.`,
  },
  {
    id: 'secure-sdlc',
    name: 'Secure SDLC',
    description: 'Audits CI/CD security, code signing, artifact integrity, SLSA compliance, and supply chain.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-800 hover:bg-red-700',
    placeholder: 'Paste your CI/CD workflows, build scripts, deployment config, or branch protection settings...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['secure-sdlc'],
    prepPrompt: `I'm preparing CI/CD configuration for a **Secure SDLC** audit. Please help me collect the relevant files.

## Project context (fill in)
- CI/CD platform: [e.g. GitHub Actions, GitLab CI, CircleCI, Jenkins]
- Artifact registry: [e.g. npm, Docker Hub, ECR, GCR, Artifactory]
- Deployment target: [e.g. Kubernetes, Vercel, AWS ECS, bare metal]
- Code signing: [yes/no — commit signing, artifact signing]
- Known concerns: [e.g. "no artifact signing", "secrets in CI logs", "no branch protection"]

## Files to gather

### 1. CI/CD pipeline configuration
- ALL workflow/pipeline files (.github/workflows/*.yml, .gitlab-ci.yml)
- Build scripts (Makefile, build.sh, package.json scripts)
- Deployment scripts and configuration
- Any custom CI actions or plugins

### 2. Branch protection and code review
- Branch protection rules (describe or screenshot from Settings)
- CODEOWNERS file
- PR template
- Required reviewers configuration

### 3. Artifact management
- Dockerfile(s) — how images are built
- Container registry authentication
- Package publishing configuration (npm publish, Docker push)
- Any artifact signing configuration (cosign, Notation, GPG)

### 4. Secret management in CI
- How secrets are injected into pipelines
- Secret rotation automation
- Environment separation (dev/staging/prod secrets)
- Any secrets that appear in build logs

### 5. Dependency management
- Lockfile presence and integrity
- Dependabot/Renovate configuration
- Pre-commit hooks (.husky, .pre-commit-config.yaml)
- SBOM generation configuration

## Formatting rules

Format each file:
\`\`\`
--- .github/workflows/ci.yml ---
--- .github/workflows/deploy.yml ---
--- Dockerfile ---
--- CODEOWNERS ---
--- .pre-commit-config.yaml ---
\`\`\`

## Don't forget
- [ ] Include ALL CI/CD workflow files
- [ ] Show how secrets flow from storage to pipeline to deployment
- [ ] Include branch protection rules (describe if can't export)
- [ ] Note any manual approval steps in the deployment process
- [ ] Include any artifact signing or SBOM generation configuration

Keep total under 30,000 characters.`,
  },
  {
    id: 'threat-modeling',
    name: 'Threat Modeling',
    description: 'Performs STRIDE analysis, attack trees, trust boundary mapping, and MITRE ATT&CK alignment.',
    category: 'Security & Privacy',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-800 hover:bg-rose-700',
    placeholder: 'Paste your architecture description, system design, data flow, or infrastructure code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['threat-modeling'],
    prepPrompt: `I'm preparing a system description for a **Threat Modeling** exercise. Please help me collect the relevant information.

## System context (fill in)
- System name: [e.g. "Customer Portal", "Payment API", "Internal Dashboard"]
- System type: [e.g. web app, API service, microservices, mobile backend]
- Users: [e.g. external customers, internal employees, API consumers, admins]
- Data sensitivity: [e.g. PII, payment data, health records, public data]
- Known threat actors: [e.g. external attackers, malicious insiders, nation-state, script kiddies]
- Known concerns: [e.g. "recently added third-party integration", "handling payment data for the first time"]

## Information to gather

### 1. Architecture overview
- System architecture diagram (or textual description of components)
- List of all services/components and their responsibilities
- External dependencies and third-party integrations
- Data stores and what they contain

### 2. Data flows
- How data enters the system (user inputs, API calls, file uploads, webhooks)
- How data moves between components (API calls, message queues, shared databases)
- How data leaves the system (API responses, exports, third-party API calls)
- What data is stored where and for how long

### 3. Trust boundaries
- Where authenticated and unauthenticated zones divide
- Where internal and external networks divide
- Where different trust levels exist (admin vs user vs anonymous)
- Third-party service integration points

### 4. Authentication and authorization
- How users authenticate
- How services authenticate to each other
- How authorization decisions are made
- Admin access patterns

### 5. Infrastructure
- Network topology (VPC, subnets, security groups)
- Deployment architecture (containers, serverless, VMs)
- Cloud services used
- CDN, WAF, load balancer configuration

### 6. Source code (key files)
- API route handlers (shows attack surface)
- Authentication middleware
- Authorization logic
- Data model definitions

## Formatting rules

Describe the architecture clearly:
\`\`\`
--- Architecture Description ---
--- Data Flow Description ---
--- api/routes.ts (attack surface) ---
--- middleware/auth.ts (trust boundary) ---
--- terraform/main.tf (infrastructure) ---
\`\`\`

## Don't forget
- [ ] Include ALL components, even "boring" internal ones — they're attack targets too
- [ ] Describe ALL data flows, especially across trust boundaries
- [ ] Note all third-party integrations and what access they have
- [ ] Include the network topology and segmentation
- [ ] Describe who the users are and what they can do

Keep total under 30,000 characters.`,
  },
  {
    id: 'zero-trust',
    name: 'Zero Trust Audit',
    description: 'Audits network segmentation, mTLS, identity-based access, and implicit trust assumptions.',
    category: 'Security & Privacy',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
    placeholder: 'Paste your network config, service mesh setup, access policies, or infrastructure code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['zero-trust'],
    prepPrompt: `I'm preparing infrastructure configuration for a **Zero Trust** audit. Please help me collect the relevant files.

## Infrastructure context (fill in)
- Architecture: [e.g. microservices on Kubernetes, monolith on EC2, serverless on Lambda]
- Service mesh: [e.g. Istio, Linkerd, Consul Connect, none]
- Identity provider: [e.g. SPIFFE/SPIRE, Kubernetes ServiceAccounts, AWS IAM roles]
- Network: [e.g. VPC with security groups, flat network, on-premise]
- Known concerns: [e.g. "services talk directly to DB", "no mTLS", "IP-based allowlists"]

## Files to gather

### 1. Network configuration
- VPC / subnet definitions
- Security groups / firewall rules
- Network policies (Kubernetes NetworkPolicy, Calico, Cilium)
- Load balancer and ingress configuration

### 2. Service-to-service authentication
- Service mesh configuration (Istio PeerAuthentication, AuthorizationPolicy)
- mTLS setup and certificate management
- Service account / identity configuration
- API authentication between services

### 3. Access control policies
- OPA/Rego policies
- Kubernetes RBAC
- IAM roles for service accounts
- Any identity-aware proxy configuration (BeyondCorp, Cloudflare Access, Tailscale)

### 4. Data flow encryption
- TLS termination points
- Internal communication encryption
- Database connection encryption
- Message queue encryption

### 5. Monitoring and verification
- Network traffic monitoring
- Access logs for service-to-service calls
- Policy enforcement logging
- Anomaly detection configuration

## Formatting rules

Format each file:
\`\`\`
--- kubernetes/network-policies.yaml ---
--- istio/peer-authentication.yaml ---
--- istio/authorization-policy.yaml ---
--- terraform/vpc.tf (network config) ---
--- opa/policies/access.rego ---
\`\`\`

## Don't forget
- [ ] Include ALL network policies and security groups
- [ ] Show how services authenticate to each other (not just to users)
- [ ] Include internal service communication patterns
- [ ] Note any services that talk directly to databases without auth
- [ ] Include any IP-based allowlists (these are anti-patterns in zero trust)

Keep total under 30,000 characters.`,
  },
  {
    id: 'incident-response',
    name: 'Incident Response',
    description: 'Audits IR playbooks, logging coverage, detection gaps, and forensic readiness.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-700 hover:bg-red-600',
    placeholder: 'Paste your logging config, alerting rules, IR playbooks, or monitoring setup...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['incident-response'],
    prepPrompt: `I'm preparing logging and monitoring configuration for an **Incident Response** readiness audit. Please help me collect the relevant files.

## System context (fill in)
- Application type: [e.g. SaaS platform, API service, e-commerce, fintech]
- Logging platform: [e.g. Datadog, Splunk, ELK, CloudWatch, Loki, none]
- Alerting: [e.g. PagerDuty, OpsGenie, Slack alerts, none]
- IR process: [e.g. "we have runbooks", "ad-hoc", "no formal process"]
- Compliance: [e.g. SOC 2, PCI DSS, HIPAA — these mandate logging requirements]
- Known concerns: [e.g. "no logging on auth events", "can't investigate incidents", "alerts are noisy"]

## Files to gather

### 1. Application logging
- Logger configuration (winston, pino, logback, structlog)
- Where logs are written (stdout, file, remote service)
- What events are logged (auth, errors, access, admin actions)
- Log format and fields included
- Any PII redaction in logs

### 2. Security event logging
- Authentication event logging (login, logout, failed login, MFA)
- Authorization failure logging (access denied events)
- Admin action audit trail
- Data access logging
- Configuration change logging

### 3. Infrastructure monitoring
- APM configuration (Datadog, New Relic, etc.)
- Metrics collection (Prometheus, CloudWatch)
- Health check endpoints
- Uptime monitoring

### 4. Alerting configuration
- Alert rules and thresholds
- Notification channels
- Escalation policies
- On-call rotation

### 5. IR documentation (if it exists)
- Incident response plan or runbooks
- Communication templates
- Severity classification criteria
- Post-incident review process

## Formatting rules

Format each file:
\`\`\`
--- lib/logger.ts (logging configuration) ---
--- middleware/auditLog.ts (security events) ---
--- monitoring/alerts.yml (alerting rules) ---
--- docs/incident-response.md (IR plan, if exists) ---
\`\`\`

## Don't forget
- [ ] Include ALL logging configuration — application, access, error, and security logs
- [ ] Show what fields are captured in each log event
- [ ] Include alerting rules and who gets notified
- [ ] Note log retention periods
- [ ] Include any existing IR documentation or runbooks
- [ ] Show how logs are protected from tampering

Keep total under 30,000 characters.`,
  },
  {
    id: 'compliance-audit',
    name: 'Compliance Audit',
    description: 'Maps controls to SOC 2, ISO 27001, PCI DSS, HIPAA, and identifies compliance gaps.',
    category: 'Security & Privacy',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your security controls, policies, infrastructure config, or access control setup...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['compliance-audit'],
    prepPrompt: `I'm preparing for a **Compliance Audit** readiness assessment. Please help me collect the relevant files and information.

## Compliance context (fill in)
- Target frameworks: [e.g. SOC 2 Type II, ISO 27001, PCI DSS v4.0, HIPAA, GDPR]
- Current status: [e.g. "pursuing SOC 2 for first time", "ISO 27001 certified, recertifying", "no formal compliance"]
- Industry: [e.g. SaaS, fintech, healthcare, e-commerce]
- Data types: [e.g. PII, payment card data, PHI, business data only]
- Known concerns: [e.g. "no formal access reviews", "logging is incomplete", "no change management process"]

## Files to gather

### 1. Access control
- Authentication configuration (MFA, password policy)
- Authorization model (RBAC, ABAC definitions)
- User provisioning and deprovisioning process
- Access review configuration or scripts
- Admin access patterns

### 2. Data protection
- Encryption at rest configuration
- Encryption in transit (TLS) configuration
- Key management setup (KMS, Vault)
- Backup configuration and encryption
- Data retention policies (code or config)

### 3. Logging and monitoring
- Audit log configuration
- Security event logging
- Log retention settings
- Alerting rules
- SIEM integration

### 4. Change management
- CI/CD pipeline configuration
- Code review / PR requirements
- Branch protection rules
- Deployment approval process
- Rollback procedures

### 5. Infrastructure security
- Network security (firewalls, security groups, network policies)
- Vulnerability scanning configuration
- Patch management process
- Container/image scanning

### 6. Policies and documentation (if they exist)
- Information security policy
- Incident response plan
- Business continuity plan
- Data classification policy
- Acceptable use policy

## Formatting rules

Format each file:
\`\`\`
--- terraform/iam.tf (access control) ---
--- lib/encryption.ts (data protection) ---
--- lib/logger.ts (audit logging) ---
--- .github/workflows/deploy.yml (change management) ---
--- docs/security-policy.md (policies, if exists) ---
\`\`\`

## Don't forget
- [ ] Include access control configuration for ALL systems (app, cloud, database)
- [ ] Show encryption configuration for data at rest AND in transit
- [ ] Include audit logging — what events are captured and retained
- [ ] Show the change management process (PR → review → deploy)
- [ ] Include any existing policies or documentation
- [ ] Note which compliance framework(s) you're targeting

Keep total under 30,000 characters.`,
  },
  {
    id: 'seo-technical',
    name: 'SEO Technical',
    description: 'Reviews meta tags, structured data, canonical URLs, sitemap, and crawlability.',
    category: 'Performance',
    accentClass: 'text-green-400 hover:bg-green-500/10',
    buttonClass: 'bg-green-800 hover:bg-green-700',
    placeholder: 'Paste your page components, layout files, head configuration, or robots.txt...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-technical'],
    prepPrompt: `I'm preparing my site for a **Technical SEO** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js 15, Nuxt 3, Astro, static HTML]
- Rendering: [SSR / SSG / CSR / hybrid]
- Current SEO status: [e.g. "basic meta tags only", "no sitemap", "good but want to improve"]
- Known concerns: [e.g. "not indexed on Google", "duplicate content", "missing structured data"]

## Files to gather
- Root layout with \`<head>\` / metadata config
- All page-level metadata (title, description, OG tags)
- robots.txt
- XML sitemap (or generation config)
- Structured data / JSON-LD
- Any SEO utility components or libraries

## Don't forget
- [ ] Include the HTML \`<head>\` output for your most important pages
- [ ] Check that every page has a unique title and description
- [ ] Include any canonical URL configuration

Keep total under 30,000 characters.`,
  },
  {
    id: 'bundle-size',
    name: 'Bundle Size',
    description: 'Finds heavy dependencies, missing code splitting, tree-shaking failures, and optimization gaps.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your build output, package.json, import statements, or bundle analysis report...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['bundle-size'],
    prepPrompt: `I'm preparing my frontend for a **Bundle Size** audit. Please help me collect the relevant files.

## Project context (fill in)
- Bundler: [e.g. webpack, Vite/Rollup, esbuild, Turbopack]
- Framework: [e.g. Next.js 15, React + Vite, Vue + Nuxt]
- Current bundle size: [e.g. "180KB shared JS", "don't know", "2MB total"]
- Known concerns: [e.g. "slow initial load", "huge node_modules", "not sure what's in the bundle"]

## Files to gather and measurements to run
- package.json (full dependencies list)
- Build output (\`npm run build\` page size table)
- Import statements from the largest page components
- next.config.ts / vite.config.ts (any bundle optimization settings)
- Any dynamic import usage

### Run these commands:
\`\`\`bash
npm run build 2>&1 | tail -50
# or for more detail:
npx @next/bundle-analyzer  # if using Next.js
\`\`\`

## Don't forget
- [ ] Include the build output showing chunk/page sizes
- [ ] List ALL dependencies from package.json
- [ ] Note any dependencies you suspect are heavy

Keep total under 30,000 characters.`,
  },
  {
    id: 'forms-validation',
    name: 'Forms & Validation',
    description: 'Reviews form UX, input validation, error messaging, accessibility, and mobile usability.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your form components, validation logic, or error handling UI...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['forms-validation'],
    prepPrompt: `I'm preparing forms for a **Forms & Validation** audit. Please help me collect the relevant files.

## Project context (fill in)
- Form library: [e.g. React Hook Form, Formik, native forms, Zod + server actions]
- Validation approach: [client-only / server-only / both]
- Known concerns: [e.g. "error messages confuse users", "forms not accessible", "no mobile optimization"]

## Files to gather
- ALL form components (login, signup, settings, checkout, etc.)
- Validation schemas (Zod, Yup, custom validation functions)
- Error display components
- Server-side validation / API route validation
- Any form utility components (Input, Select, DatePicker wrappers)

## Don't forget
- [ ] Include EVERY form in the application
- [ ] Show how errors are displayed to users
- [ ] Include both client and server validation code
- [ ] Note any multi-step or complex forms

Keep total under 30,000 characters.`,
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    description: 'Audits color contrast in both themes, flash prevention, token usage, and system preference detection.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your theme provider, CSS variables, Tailwind config, or component styles...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['dark-mode'],
    prepPrompt: `I'm preparing my theming code for a **Dark Mode** audit. Please help me collect the relevant files.

## Project context (fill in)
- Theming approach: [e.g. Tailwind dark: classes, CSS variables, styled-components ThemeProvider]
- Current status: [e.g. "dark mode only", "both themes", "adding dark mode"]
- Known concerns: [e.g. "flash of white on load", "some text invisible in dark mode", "inconsistent colors"]

## Files to gather
- Theme provider / toggle component
- Tailwind config (darkMode setting, color definitions)
- Global CSS with color variables or theme values
- Components with color-related classes/styles
- Layout component (where theme class is applied)

## Don't forget
- [ ] Include how the theme is determined on first load
- [ ] Show components that have different styles per theme
- [ ] Include any hardcoded colors (#333, rgb(255,255,255))
- [ ] Check images/icons that should change per theme

Keep total under 30,000 characters.`,
  },
  {
    id: 'email-templates',
    name: 'Email Templates',
    description: 'Reviews email rendering across clients, inline CSS, accessibility, and deliverability.',
    category: 'Design',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your email HTML templates, React Email components, or email sending config...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['email-templates'],
    prepPrompt: `I'm preparing email templates for an audit. Please help me collect the relevant files.

## Project context (fill in)
- Email framework: [e.g. React Email, MJML, raw HTML, Handlebars]
- Email service: [e.g. Resend, SendGrid, SES, Postmark]
- Email types: [e.g. verification, password reset, welcome, notifications, marketing]
- Known concerns: [e.g. "looks broken in Outlook", "going to spam", "not accessible"]

## Files to gather
- ALL email template files
- Email sending configuration / setup
- Any shared email components (header, footer, button)
- SPF/DKIM/DMARC configuration (DNS records or provider settings)

## Don't forget
- [ ] Include EVERY email template
- [ ] Show the actual rendered HTML (not just the template source)
- [ ] Include plain-text alternatives if they exist
- [ ] Note your current inbox/spam delivery rate if known

Keep total under 30,000 characters.`,
  },
  {
    id: 'env-config',
    name: 'Environment Config',
    description: 'Audits env var hygiene, config validation, .env management, and 12-factor compliance.',
    category: 'Infrastructure',
    accentClass: 'text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-800 hover:bg-teal-700',
    placeholder: 'Paste your .env.example, config validation code, or environment setup...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['env-config'],
    prepPrompt: `I'm preparing environment configuration for an audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js, Express, Django]
- Environments: [e.g. local, staging, production]
- Config management: [e.g. ".env files only", "Vault", "AWS Parameter Store"]
- Known concerns: [e.g. "no validation", "secrets in repo history", "different behavior per env"]

## Files to gather
- .env.example (NEVER the real .env file)
- Config validation code (Zod schema, envalid, custom validation)
- Any centralized config module
- .gitignore (to verify .env is ignored)
- CI/CD environment variable setup
- docker-compose env configuration

## Don't forget
- [ ] NEVER include real .env files with actual secrets
- [ ] Search for process.env / import.meta.env across the codebase
- [ ] Note which variables are required vs optional
- [ ] Include how secrets differ between environments

Keep total under 30,000 characters.`,
  },
  {
    id: 'openapi',
    name: 'OpenAPI Spec',
    description: 'Reviews spec completeness, schema accuracy, error documentation, and API consumer usability.',
    category: 'Infrastructure',
    accentClass: 'text-green-400 hover:bg-green-500/10',
    buttonClass: 'bg-green-800 hover:bg-green-700',
    placeholder: 'Paste your OpenAPI/Swagger spec (YAML or JSON), or your API route handlers...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['openapi'],
    prepPrompt: `I'm preparing my API specification for an **OpenAPI Spec** audit. Please help me collect the relevant files.

## Project context (fill in)
- OpenAPI version: [e.g. 3.1, 3.0, Swagger 2.0, "no spec yet"]
- API framework: [e.g. Next.js API routes, Express, FastAPI, NestJS]
- Audience: [e.g. internal team, public developers, mobile app]
- Known concerns: [e.g. "spec is outdated", "no error documentation", "missing examples"]

## Files to gather
- The full OpenAPI spec (openapi.yaml / openapi.json)
- ALL API route handlers (to compare against spec)
- Request/response type definitions
- API documentation pages or config

## Don't forget
- [ ] Include the FULL spec, not just a sample
- [ ] Include the actual route handlers to verify spec accuracy
- [ ] Note if the spec is auto-generated or manually maintained

Keep total under 30,000 characters.`,
  },
  {
    id: 'state-machines',
    name: 'State Machines',
    description: 'Finds impossible states, missing transitions, deadlocks, and implicit state logic.',
    category: 'Code Quality',
    accentClass: 'text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste components or modules with complex state (multi-step forms, payment flows, status tracking)...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['state-machines'],
    prepPrompt: `I'm preparing code with complex state for a **State Machine** audit. Please help me collect the relevant files.

## Project context (fill in)
- State management: [e.g. useState/useReducer, XState, Zustand, Redux]
- Complex flows: [e.g. checkout process, document editing, approval workflow]
- Known concerns: [e.g. "impossible states reachable", "users get stuck", "hard to add new states"]

## Files to gather
- Components/modules with complex state transitions
- useReducer implementations with action types
- XState machine definitions (if using)
- Multi-step form or wizard components
- Status/lifecycle management code
- Any state diagrams or documentation

## Don't forget
- [ ] Include ALL state variables that interact with each other
- [ ] Show how error states are recovered from
- [ ] Include any boolean flag combinations (isLoading, isError, isSuccess)
- [ ] Note flows where users report getting "stuck"

Keep total under 30,000 characters.`,
  },
  {
    id: 'pagination',
    name: 'Pagination & Filtering',
    description: 'Reviews cursor vs offset strategy, query performance, filter injection, and deep pagination safety.',
    category: 'Performance',
    accentClass: 'text-sky-400 hover:bg-sky-500/10',
    buttonClass: 'bg-sky-700 hover:bg-sky-600',
    placeholder: 'Paste your paginated API endpoints, database queries, or list components...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['pagination'],
    prepPrompt: `I'm preparing paginated endpoints for an audit. Please help me collect the relevant files.

## Project context (fill in)
- Database: [e.g. PostgreSQL, MySQL, MongoDB]
- ORM: [e.g. Drizzle, Prisma, Sequelize, raw SQL]
- Table sizes: [e.g. "10K rows", "1M+ rows", "growing fast"]
- Known concerns: [e.g. "slow page 100+", "inconsistent results during updates", "no cursor pagination"]

## Files to gather
- ALL API endpoints that return lists/collections
- Database queries with LIMIT/OFFSET or cursor logic
- Filter/search parameter handling
- Frontend pagination/infinite scroll components
- Any index definitions on filtered/sorted columns

## Don't forget
- [ ] Include the actual SQL queries (or ORM queries)
- [ ] Note the table size for each paginated query
- [ ] Show how filter/sort parameters flow from URL to query
- [ ] Include any search endpoint implementations

Keep total under 30,000 characters.`,
  },

  // ─── SEO Foundations ─────────────────────────────────────────────
  {
    id: 'seo-basics',
    name: 'SEO Basics',
    description: 'Audits fundamental on-page SEO: title tags, meta descriptions, headings, URL structure, and internal linking.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your page HTML, layout components, or metadata configuration...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-basics'],
    prepPrompt: `I'm preparing my site for an **SEO Basics** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js 15, WordPress, Shopify, static HTML]
- Site type: [e.g. SaaS, e-commerce, blog, portfolio]
- Known concerns: [e.g. "titles may be duplicated", "no meta descriptions on blog posts"]

## Files to gather
- Root layout / template with \`<head>\` and metadata
- All page-level title and meta description definitions
- Heading structure for key pages (render the HTML or paste the components)
- URL routing configuration (file-based or config-based routes)
- Navigation components (header, footer, sidebar links)
- Image components with alt text handling
- sitemap.xml or sitemap generator config

## Don't forget
- [ ] Include the rendered \`<head>\` output for 3–5 of your most important pages
- [ ] Note any pages you know have SEO issues
- [ ] Include robots.txt

Keep total under 30,000 characters.`,
  },
  {
    id: 'seo-search-engines',
    name: 'Search Engine Understanding',
    description: 'Analyzes how search engines crawl, render, and index your site — crawlability, JS rendering, and crawl budget.',
    category: 'SEO',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your robots.txt, sitemap, layout files, and routing configuration...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-search-engines'],
    prepPrompt: `I'm preparing my site for a **Search Engine Understanding** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js 15, Nuxt 3, Gatsby, SPA]
- Rendering: [SSR / SSG / CSR / hybrid — which pages use which strategy?]
- Known concerns: [e.g. "pages not being indexed", "Google rendering issues", "crawl budget waste"]

## Files to gather
- robots.txt (full contents)
- XML sitemap or sitemap generator config
- Root layout and \`<head>\` configuration
- Middleware or server config affecting redirects/rewrites
- Any dynamic rendering or prerendering configuration
- JavaScript-heavy page components (especially ones with client-side data fetching)
- Canonical tag implementation
- Pagination handling (rel=next/prev or alternatives)

## Don't forget
- [ ] Include the rendered HTML of a JavaScript-heavy page (view source, not inspect)
- [ ] Note any pages that are NOT appearing in Google Search Console
- [ ] Include redirect rules or chains you're aware of
- [ ] Note approximate site size (number of pages)

Keep total under 30,000 characters.`,
  },
  {
    id: 'seo-ranking-factors',
    name: 'Ranking Factors',
    description: 'Evaluates E-E-A-T signals, content quality, Core Web Vitals readiness, and on-page ranking signals.',
    category: 'SEO',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-700 hover:bg-amber-600',
    placeholder: 'Paste your page content, layout, about/author pages, and structured data...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-ranking-factors'],
    prepPrompt: `I'm preparing my site for a **Ranking Factors** audit. Please help me collect the relevant files.

## Project context (fill in)
- Site niche: [e.g. B2B SaaS, health blog, e-commerce]
- Target audience: [e.g. developers, small business owners, consumers]
- Main competitors: [list 2–3 competitor URLs if known]
- Known concerns: [e.g. "low E-E-A-T", "thin content", "slow page speed"]

## Files to gather
- Key landing pages (full rendered HTML or components)
- About page / team page / author bios
- Trust signals (testimonials, reviews, certifications)
- Privacy policy, terms of service pages
- Schema.org / structured data implementation
- Core Web Vitals related code (images, fonts, layout shift sources)
- Any Lighthouse or PageSpeed Insights reports

## Don't forget
- [ ] Include the about/author page content — E-E-A-T starts here
- [ ] Note if you have any Google Search Console data showing ranking positions
- [ ] Include content from your most important 3–5 pages

Keep total under 30,000 characters.`,
  },
  {
    id: 'seo-quick-wins',
    name: 'SEO Quick Wins',
    description: 'Identifies high-impact, low-effort SEO improvements you can implement today for measurable results.',
    category: 'SEO',
    accentClass: 'text-lime-400 hover:bg-lime-500/10',
    buttonClass: 'bg-lime-700 hover:bg-lime-600',
    placeholder: 'Paste your site HTML, metadata config, and key page content...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-quick-wins'],
    prepPrompt: `I'm looking for **SEO Quick Wins** on my site. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js, WordPress, Shopify]
- Current SEO status: [e.g. "just launched, no SEO work done", "basic SEO in place", "advanced but plateauing"]
- Traffic level: [e.g. "under 1K/mo", "10K/mo", "100K+/mo"]
- Known issues: [anything you already know is broken or missing]

## Files to gather
- Root layout with \`<head>\` / metadata
- robots.txt and sitemap.xml
- Key page content (home, top 3 landing pages, blog index)
- Image handling (alt text patterns, compression setup)
- Internal linking structure (navigation, sidebar, footer)
- Any existing structured data / JSON-LD
- Redirect configuration

## Don't forget
- [ ] Include rendered \`<head>\` from your homepage and top landing page
- [ ] Note any pages with zero or low traffic that should be performing better
- [ ] Include your Google Search Console top queries if available

Keep total under 30,000 characters.`,
  },

  // ─── SEO Research ────────────────────────────────────────────────
  {
    id: 'seo-keyword-research',
    name: 'Keyword Research',
    description: 'Analyzes keyword targeting, cannibalization, long-tail coverage, and content gaps across your pages.',
    category: 'SEO',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your page content, titles, headings, and meta descriptions...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-keyword-research'],
    prepPrompt: `I'm preparing my site for a **Keyword Research** audit. Please help me collect the relevant content.

## Project context (fill in)
- Niche/industry: [e.g. project management SaaS, fitness blog, legal services]
- Target keywords: [list your known target keywords if any]
- Competitors: [list 2–3 competitor domains]
- Known concerns: [e.g. "not sure what keywords to target", "ranking for wrong terms"]

## Content to gather
- ALL page titles and meta descriptions (a sitemap-style list)
- H1 and H2 headings for each page
- Full content of your top 5 most important pages
- Blog post titles and topics (or RSS feed)
- Any existing keyword research or target keyword list
- Google Search Console query data if available

## Don't forget
- [ ] Include EVERY unique page title — keyword cannibalization needs the full picture
- [ ] Note which pages you consider most important for conversions
- [ ] Include your site's value proposition / unique selling points

Keep total under 30,000 characters.`,
  },
  {
    id: 'seo-serp-analysis',
    name: 'SERP Analysis',
    description: 'Reviews how your pages appear in search results — rich snippets, featured snippet eligibility, and CTR optimization.',
    category: 'SEO',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste your page metadata, structured data, and content structure...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-serp-analysis'],
    prepPrompt: `I'm preparing my site for a **SERP Analysis** audit. Please help me collect the relevant files.

## Project context (fill in)
- Site type: [e.g. SaaS, blog, e-commerce, local business]
- Target queries: [list 5–10 target search queries]
- Current SERP features: [any rich results you already have?]
- Known concerns: [e.g. "low CTR despite good rankings", "no rich results"]

## Files to gather
- All \`<title>\` and \`<meta name="description">\` for key pages
- ALL structured data / JSON-LD schemas
- Open Graph and Twitter Card meta tags
- FAQ sections or Q&A content
- How-to or step-by-step content
- Product/pricing page content
- Review/testimonial structured data
- Breadcrumb implementation

## Don't forget
- [ ] Include the FULL rendered \`<head>\` for your top 5 pages
- [ ] Include any FAQ content — these are rich result opportunities
- [ ] Note your current click-through rates from Search Console if available

Keep total under 30,000 characters.`,
  },
  {
    id: 'seo-search-intent',
    name: 'Search Intent',
    description: 'Evaluates content alignment with user search intent — informational, navigational, transactional, and commercial.',
    category: 'SEO',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your page content, CTAs, and target keywords...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-search-intent'],
    prepPrompt: `I'm preparing my site for a **Search Intent** audit. Please help me collect the relevant content.

## Project context (fill in)
- Business model: [e.g. SaaS, e-commerce, lead gen, content/media]
- Target audience: [who are your customers?]
- Primary conversion: [e.g. signup, purchase, contact form, download]
- Known concerns: [e.g. "high bounce rate on landing pages", "traffic but no conversions"]

## Content to gather
- Full content of your top 10 pages (or your most important pages)
- Each page's target keyword(s) and what you think the intent is
- CTAs on each page (what action are you asking visitors to take?)
- Navigation structure (how do users flow through the site?)
- Any comparison or "vs" content
- Pricing page content
- Blog/resource content

## Don't forget
- [ ] For each page, note: what query should lead here, and what should the visitor do next?
- [ ] Include pages with high traffic but low conversion
- [ ] Note any pages where bounce rate is unexpectedly high

Keep total under 30,000 characters.`,
  },
  {
    id: 'seo-competitor-research',
    name: 'Competitor Research',
    description: 'Analyzes your SEO competitive position — content strategy gaps, technical advantages, and authority signals.',
    category: 'SEO',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your site content and structure. Mention your competitors if known...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-competitor-research'],
    prepPrompt: `I'm preparing my site for a **Competitor Research** SEO audit. Please help me collect the relevant content.

## Project context (fill in)
- Your site URL: [your domain]
- Main competitors: [list 3–5 competitor domains]
- Niche: [your industry/market]
- Your strengths: [what do you think you do better?]
- Your weaknesses: [where do you think competitors beat you?]

## Content to gather
- Your homepage, about page, and top 5 content pages (full content)
- Your structured data / schema markup
- Your sitemap (to show content breadth)
- Content topics you cover (list of blog categories / resource types)
- Trust signals: reviews, testimonials, certifications, team bios
- Technical setup: rendering strategy, page speed indicators

## Competitor data (if available)
- Screenshot or paste of competitor homepages
- Competitor blog topic lists
- Any SEO tool data (Ahrefs, Semrush, Moz) showing competitor keywords

## Don't forget
- [ ] Include your unique selling proposition — what differentiates you?
- [ ] Note your domain age and any existing authority signals
- [ ] Include content you're most proud of and content you think is weak

Keep total under 30,000 characters.`,
  },
  {
    id: 'seo-keyword-gap',
    name: 'Keyword Gap',
    description: 'Identifies untapped keyword opportunities, missing topic clusters, and content gaps to expand your search footprint.',
    category: 'SEO',
    accentClass: 'text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-800 hover:bg-teal-700',
    placeholder: 'Paste your sitemap, content index, blog posts, and target keywords...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-keyword-gap'],
    prepPrompt: `I'm preparing my site for a **Keyword Gap** analysis. Please help me collect the relevant content.

## Project context (fill in)
- Niche: [your industry/market]
- Site age: [e.g. 6 months, 3 years]
- Content volume: [e.g. "20 blog posts", "200 pages", "just a landing page"]
- Target audience: [who are you trying to reach?]
- Competitors: [list 3–5 competitor domains ranking for your target keywords]

## Content to gather
- Complete list of all pages/URLs on the site (sitemap.xml or manual list)
- Title and H1 for EVERY page (shows current keyword targeting)
- Full content of your top 10 pages
- Blog post list with titles and topics
- Any existing keyword research or target keyword list
- Google Search Console query data (top queries, impressions, clicks)
- Any SEO tool exports showing keyword rankings

## Don't forget
- [ ] Include ALL page titles — even ones you think are unimportant
- [ ] Note topics you want to rank for but don't have content for yet
- [ ] Include competitor topic lists if available (their blog categories, resource pages)
- [ ] Note your content production capacity (how many pieces per month?)

Keep total under 30,000 characters.`,
  },

  // ─── Bloat & Lean Code ──────────────────────────────────────────
  {
    id: 'code-bloat',
    name: 'Code Bloat',
    description: 'Finds dead code, over-abstraction, copy-paste duplication, unused dependencies, and unnecessary complexity.',
    category: 'Code Quality',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste the code you suspect has bloat — the more files, the better the analysis...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['code-bloat'],
    prepPrompt: `I'm preparing code for a **Code Bloat** audit. Please help me collect the right files.

## Project context (fill in)
- Language / framework: [e.g. TypeScript + Next.js, Python + Django, Go]
- Codebase age: [e.g. "2 years", "started as a prototype 6 months ago"]
- Known concerns: [e.g. "bundle is 2MB", "lots of unused utilities", "over-abstracted service layer"]

## Files to gather

### 1. Suspected bloat areas
- Files or modules you suspect have dead code or unnecessary complexity
- Utility/helper files (these often accumulate unused functions)
- Base classes, abstract factories, or "framework" code written for the project

### 2. Dependency manifest
- package.json / requirements.txt / go.mod / Cargo.toml
- Lock file if available (for size analysis)

### 3. Configuration files
- Build config (webpack, vite, tsconfig, etc.)
- CI/CD pipeline config
- Linter/formatter configs
- Any custom scripts in package.json

### 4. Entry points & imports
- Main entry points so we can trace what's actually used
- barrel files (index.ts) that re-export everything

### 5. Recently untouched files (high bloat signal)
Run \`git log --format=format: --name-only --diff-filter=M --since="6 months ago" | sort | uniq\` and compare against \`find src -name "*.ts"\` — files NOT in the first list haven't been touched in 6 months.

## Don't forget
- [ ] Include ALL utility/helper files — bloat hides here
- [ ] Include package.json with full dependency list
- [ ] Include barrel/index files that re-export
- [ ] Note which modules feel "too complex for what they do"

Keep total under 30,000 characters.`,
  },

  // ─── Pain Point Audits ─────────────────────────────────────────
  {
    id: 'marketing-pain-points',
    name: 'Marketing Pain Points',
    description: 'Finds conversion killers: unclear positioning, weak CTAs, missing trust signals, and messaging friction.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your landing page HTML, marketing copy, or page components...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-pain-points'],
    prepPrompt: `I'm preparing my site for a **Marketing Pain Points** audit. Please help me collect the relevant materials.

## Project context (fill in)
- Site type: [e.g. SaaS, e-commerce, agency, marketplace]
- Target audience: [e.g. "engineering managers at mid-size companies", "small business owners"]
- Primary conversion goal: [e.g. free trial signup, demo request, purchase]
- Known concerns: [e.g. "high bounce rate on landing page", "low trial-to-paid conversion"]

## Content to gather

### 1. Landing / home page
- Full HTML or component source for the landing page
- Hero section with headline, sub-headline, and CTA
- All sections visible to a first-time visitor

### 2. Key conversion pages
- Pricing page (if applicable)
- Signup / registration flow
- Any "how it works" or product tour pages

### 3. Marketing copy
- Navigation labels and footer links
- Meta titles and descriptions (what appears in Google results)
- Any email signup or lead magnet copy

### 4. Social proof
- Testimonials, reviews, or case study sections
- Trust badges, partner logos, or press mentions
- Any metrics displayed ("10K users", "99.9% uptime")

### 5. Competitor context (optional but valuable)
- URLs of 2-3 direct competitors
- Screenshots of their hero sections

## Don't forget
- [ ] Include the FULL page, not just the hero — objection handling often lives below the fold
- [ ] Include mobile layout if different from desktop
- [ ] Note your current conversion rate if known
- [ ] Include any A/B test results from previous experiments

Keep total under 30,000 characters.`,
  },

  // ─── Marketing Audits ─────────────────────────────────────────
  {
    id: 'marketing-copywriting',
    name: 'Copywriting Audit',
    description: 'Audits headlines, CTAs, value props, and persuasion structure using AIDA, PAS, and direct-response frameworks.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your marketing copy, landing page text, ad creative, or email copy...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-copywriting'],
    prepPrompt: `I'm preparing copy for a **Copywriting Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Copy type: [e.g. landing page, ad creative, email sequence, product page]
- Target audience: [e.g. "SaaS founders", "e-commerce shoppers", "enterprise IT buyers"]
- Primary conversion goal: [e.g. free trial signup, purchase, demo request]
- Known concerns: [e.g. "low click-through rate", "high bounce rate on hero section"]

## Content to gather

### 1. Headlines & subheads
- All headlines, subheadlines, and section headers
- Hero section copy (headline + subhead + CTA)

### 2. Body copy
- Full page copy in reading order
- Feature/benefit sections
- About or "how it works" sections

### 3. CTAs & micro-copy
- All button text and CTA copy
- Form labels and helper text
- Navigation labels

### 4. Social proof copy
- Testimonial text
- Case study excerpts
- Trust badge copy

### 5. Competitor copy (optional but valuable)
- 2-3 competitor hero sections for comparison

## Don't forget
- [ ] Include ALL copy, not just the hero — persuasion structure matters end-to-end
- [ ] Note which copy is performing poorly (low CTR, high bounce)
- [ ] Include the CTA button text AND surrounding context

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-landing-pages',
    name: 'Landing Page Audit',
    description: 'Optimizes landing pages for conversion: layout, messaging hierarchy, CTAs, trust signals, and mobile experience.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your landing page HTML, component code, or page copy...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-landing-pages'],
    prepPrompt: `I'm preparing a landing page for a **Landing Page Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Page type: [e.g. product landing page, lead gen page, pricing page, webinar registration]
- Primary traffic source: [e.g. Google Ads, organic search, email campaign, social media]
- Conversion goal: [e.g. free trial, demo request, email signup, purchase]
- Current conversion rate: [if known]

## Content to gather

### 1. Full page source
- Complete HTML or component source code
- Or the full page copy in reading order (hero → sections → footer)

### 2. Above-the-fold elements
- Hero headline, subhead, CTA, and imagery description
- Navigation structure

### 3. Page sections (in order)
- Each content section with headers and body copy
- Feature/benefit blocks
- Social proof sections
- FAQ or objection-handling sections

### 4. Conversion elements
- All CTA buttons and their surrounding context
- Forms with field names and labels
- Any multi-step flows

### 5. Traffic context (optional but valuable)
- Ad copy or email that drives traffic to this page
- Analytics data (bounce rate, time on page, scroll depth)

## Don't forget
- [ ] Include the COMPLETE page, not just the hero
- [ ] Note any A/B test history on this page
- [ ] Include mobile-specific layouts if they differ

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-email-campaigns',
    name: 'Email Campaign Audit',
    description: 'Audits email campaigns for subject lines, deliverability, copy persuasion, CTA effectiveness, and segmentation.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your email HTML, subject lines, campaign copy, or email sequence...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-email-campaigns'],
    prepPrompt: `I'm preparing emails for an **Email Campaign Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Email type: [e.g. welcome sequence, promotional campaign, newsletter, re-engagement]
- Audience segment: [e.g. "new signups", "trial users", "churned customers"]
- ESP/tool: [e.g. Mailchimp, SendGrid, HubSpot, Customer.io]
- Known concerns: [e.g. "low open rates", "high unsubscribe rate", "landing in spam"]

## Content to gather

### 1. Email content
- Subject lines and preview text for each email
- Full email HTML or copy
- From name and email address

### 2. Campaign structure
- Sequence timing (when each email sends)
- Trigger conditions (what causes the email to send)
- Segment definitions

### 3. Performance data (if available)
- Open rates, click rates, unsubscribe rates
- Deliverability metrics
- Conversion rates from email

### 4. Technical setup
- Authentication records (SPF, DKIM, DMARC) if known
- List hygiene practices
- Suppression list management

## Don't forget
- [ ] Include subject lines AND preview text for every email
- [ ] Include the full email, not just the hero section
- [ ] Note any deliverability issues you've experienced

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-social-media',
    name: 'Social Media Audit',
    description: 'Evaluates social media profiles, content strategy, engagement patterns, and growth tactics across platforms.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your social media profiles, recent posts, content calendar, or analytics...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-social-media'],
    prepPrompt: `I'm preparing for a **Social Media Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Platforms active on: [e.g. LinkedIn, Twitter/X, Instagram, TikTok]
- Target audience: [e.g. "B2B SaaS decision-makers", "DTC consumers age 25-35"]
- Business goals: [e.g. brand awareness, lead generation, community building]
- Known concerns: [e.g. "low engagement", "not growing followers", "unclear content strategy"]

## Content to gather

### 1. Profile information
- Bio text for each platform
- Profile/banner images (describe them)
- Link in bio content

### 2. Recent content (last 10-20 posts per platform)
- Post copy and format (image, video, carousel, text)
- Engagement metrics (likes, comments, shares, saves)
- Posting frequency and timing

### 3. Content strategy (if documented)
- Content pillars or themes
- Content calendar
- Brand voice guidelines

### 4. Analytics overview
- Follower count and growth trend
- Engagement rate by post type
- Top-performing content

## Don't forget
- [ ] Include posts that performed well AND poorly
- [ ] Include your bio/profile text for each platform
- [ ] Note any paid social campaigns running

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-brand-voice',
    name: 'Brand Voice Audit',
    description: 'Assesses tone consistency, messaging alignment, and brand personality across all touchpoints.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste copy from multiple touchpoints: website, emails, social posts, product UI...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-brand-voice'],
    prepPrompt: `I'm preparing for a **Brand Voice Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Brand/company: [name and industry]
- Target audience: [who you're writing for]
- Intended voice traits: [e.g. "professional but approachable", "bold and irreverent"]
- Known concerns: [e.g. "voice feels inconsistent", "different teams write differently"]

## Content to gather (from multiple touchpoints)

### 1. Website copy
- Homepage hero and key sections
- Product/features page
- About page
- Blog posts (2-3 samples)

### 2. Email copy
- Welcome email
- Marketing/promotional email
- Transactional email (confirmation, receipt)

### 3. Social media
- 5-10 recent social posts across platforms
- Social bio text

### 4. Product/UI copy
- Error messages
- Empty states
- Onboarding text
- Notification copy

### 5. Existing guidelines (if any)
- Brand voice guidelines document
- Style guide
- Tone of voice examples

## Don't forget
- [ ] Include copy from DIFFERENT touchpoints — consistency is what we're measuring
- [ ] Include functional copy (errors, confirmations), not just marketing copy
- [ ] Note which pieces were written by different teams/people

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-competitor-analysis',
    name: 'Competitor Analysis',
    description: 'Analyzes competitive positioning, messaging gaps, feature differentiation, and strategic white space.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your marketing materials alongside competitor content for comparison...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-competitor-analysis'],
    prepPrompt: `I'm preparing for a **Competitor Analysis**. Please help me collect the relevant materials.

## Project context (fill in)
- Your product/company: [name and one-line description]
- Target market: [who you're selling to]
- Key competitors: [list 2-5 direct competitors]
- Known concerns: [e.g. "losing deals to Competitor X", "unclear differentiation"]

## Content to gather

### 1. Your materials
- Homepage hero section and key messaging
- Pricing page
- Feature/product page
- Key value proposition statements

### 2. Competitor materials (for each competitor)
- Homepage hero and key messaging
- Pricing structure
- Feature highlights
- Taglines and positioning statements

### 3. Market context
- Category you compete in
- Common buyer objections you hear in sales
- Win/loss reasons (if known)

### 4. Feature comparison (if available)
- Feature comparison matrix
- Areas where you're stronger/weaker

## Don't forget
- [ ] Include YOUR materials, not just competitor materials
- [ ] Focus on messaging and positioning, not just features
- [ ] Include pricing information for meaningful comparison

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-pricing-page',
    name: 'Pricing Page Audit',
    description: 'Audits pricing psychology, tier structure, objection handling, and decision architecture to maximize revenue.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your pricing page HTML, pricing structure, or feature comparison matrix...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-pricing-page'],
    prepPrompt: `I'm preparing for a **Pricing Page Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Product type: [e.g. SaaS, marketplace, e-commerce]
- Pricing model: [e.g. tiered subscription, usage-based, freemium, one-time]
- Target buyer: [e.g. "SMB owners", "enterprise procurement"]
- Known concerns: [e.g. "users choose cheapest tier", "high pricing page bounce rate"]

## Content to gather

### 1. Pricing page
- Full pricing page HTML or copy
- All tier names, prices, and feature lists
- Any toggle (monthly/annual) and pricing math

### 2. Feature comparison
- Feature comparison matrix
- What's included/excluded per tier
- Any usage limits per tier

### 3. Conversion elements
- CTA text for each tier
- FAQ section
- Trust signals (guarantee, testimonials near pricing)

### 4. Competitor pricing (optional)
- 2-3 competitor pricing pages for context

## Don't forget
- [ ] Include the FULL pricing page, including FAQ and footer
- [ ] Note which tier is most popular currently
- [ ] Include any annual vs. monthly pricing differences

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-onboarding',
    name: 'Onboarding Flow Audit',
    description: 'Evaluates activation flow for time-to-value, progressive disclosure, motivation design, and retention mechanics.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your onboarding flow code, screen copy, user journey, or wireframes...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-onboarding'],
    prepPrompt: `I'm preparing for an **Onboarding Flow Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Product type: [e.g. SaaS tool, marketplace, mobile app]
- "Aha moment": [what action represents first value? e.g. "runs first audit", "sends first message"]
- Current activation rate: [% of signups who reach aha moment, if known]
- Known concerns: [e.g. "50% drop off at step 3", "users don't complete setup"]

## Content to gather

### 1. Signup flow
- Registration form (fields required)
- Social/SSO login options
- Any verification steps

### 2. First-run experience
- Welcome screen or modal
- Onboarding wizard/checklist
- Each step with copy and UI description

### 3. Activation path
- Steps from signup to first value moment
- Any setup requirements before using core features
- Empty states and first-use prompts

### 4. Supporting communications
- Welcome email sequence
- In-app tooltips or guided tours
- Push notifications during onboarding

## Don't forget
- [ ] Include EVERY step from signup to first value
- [ ] Note where users currently drop off (if known)
- [ ] Include both the UI copy and the flow logic

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-analytics',
    name: 'Marketing Analytics Audit',
    description: 'Audits tracking implementation, attribution models, funnel instrumentation, and KPI frameworks.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your analytics configuration, tracking code, GTM setup, or measurement plan...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-analytics'],
    prepPrompt: `I'm preparing for a **Marketing Analytics Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Analytics stack: [e.g. GA4 + GTM, Segment + Mixpanel, HubSpot]
- Website platform: [e.g. Next.js, WordPress, Shopify]
- Key conversion events: [e.g. signup, purchase, demo request]
- Known concerns: [e.g. "can't attribute revenue to channels", "tracking seems broken"]

## Content to gather

### 1. Tracking implementation
- Google Tag Manager container export (or equivalent)
- Analytics initialization code
- Custom event tracking code

### 2. Event inventory
- List of all tracked events and their properties
- Conversion event definitions
- Funnel step definitions

### 3. Attribution setup
- UTM parameter conventions
- Attribution model configuration
- Channel grouping definitions

### 4. Reporting
- Key dashboards or report screenshots
- KPI definitions
- Reporting cadence and audience

## Don't forget
- [ ] Include the actual tracking CODE, not just what you think is tracked
- [ ] Note any known gaps or broken tracking
- [ ] Include consent/privacy implementation if relevant

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-content-strategy',
    name: 'Content Strategy Audit',
    description: 'Evaluates topic clusters, content gaps, funnel-stage coverage, SEO alignment, and content distribution.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your content inventory, blog posts, content calendar, or sitemap...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-content-strategy'],
    prepPrompt: `I'm preparing for a **Content Strategy Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Business type: [e.g. B2B SaaS, e-commerce, agency]
- Target audience: [who reads your content]
- Content goal: [e.g. organic traffic, thought leadership, lead generation]
- Known concerns: [e.g. "traffic not growing", "content doesn't convert", "no clear strategy"]

## Content to gather

### 1. Content inventory
- List of published content (titles, URLs, dates, categories)
- Or sitemap/blog index
- Top 10 performing and bottom 10 performing pieces

### 2. Sample content
- 3-5 representative blog posts or articles (full text)
- Pillar/cornerstone content pieces
- Landing pages with content

### 3. Strategy documents (if they exist)
- Content calendar
- Editorial guidelines
- Topic/keyword research
- Content pillar definitions

### 4. Performance data (if available)
- Traffic by content piece
- Keyword rankings
- Conversion data from content

## Don't forget
- [ ] Include content ACROSS funnel stages, not just blog posts
- [ ] Note your primary content distribution channels
- [ ] Include any competitor content you admire

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-conversion-rate',
    name: 'Conversion Rate Audit',
    description: 'Identifies conversion blockers using LIFT model, ICE scoring, and recommends A/B tests for key funnel steps.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your conversion funnel code, analytics data, or user flow descriptions...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-conversion-rate'],
    prepPrompt: `I'm preparing for a **Conversion Rate Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Site type: [e.g. SaaS, e-commerce, lead gen]
- Primary conversion: [e.g. signup, purchase, demo request]
- Current conversion rate: [if known]
- Known concerns: [e.g. "high cart abandonment", "low trial-to-paid", "form drop-off"]

## Content to gather

### 1. Conversion pages
- Landing page(s) driving to conversion
- Signup/checkout flow (all steps)
- Thank you / confirmation page

### 2. Funnel data (if available)
- Conversion rate at each funnel step
- Drop-off rates between steps
- Heatmap or session recording insights

### 3. Trust & objection elements
- Testimonials, reviews, trust badges
- FAQ sections
- Guarantee/refund policy

### 4. Previous test results (if any)
- Past A/B test results and learnings
- Changes that improved/hurt conversion

## Don't forget
- [ ] Include the FULL conversion path, not just one page
- [ ] Note the primary traffic source for conversion pages
- [ ] Include form fields and their labels

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-product-positioning',
    name: 'Product Positioning Audit',
    description: 'Evaluates ICP fit, competitive frame, differentiation, and messaging using Obviously Awesome and JTBD frameworks.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your product marketing materials, positioning docs, or website copy...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-product-positioning'],
    prepPrompt: `I'm preparing for a **Product Positioning Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Product: [name and one-line description]
- Target customer: [who is the ideal buyer]
- Main competitors: [2-3 alternatives your buyers consider]
- Known concerns: [e.g. "prospects don't understand what we do", "losing to competitor X"]

## Content to gather

### 1. Your messaging
- Homepage copy (full)
- Product/features page
- "How it works" content
- Tagline and elevator pitch

### 2. Customer context
- Customer testimonials or case studies
- Common objections from sales calls
- Why customers chose you (win reasons)
- Why prospects chose competitors (loss reasons)

### 3. Competitive context
- Competitor homepages and positioning
- How you currently differentiate
- Category you compete in

### 4. Internal docs (if available)
- Positioning document
- Messaging framework
- ICP definition
- Sales deck

## Don't forget
- [ ] Include what your CUSTOMERS say about you, not just what you say
- [ ] Note your top 3 differentiators as you understand them
- [ ] Include competitor positioning for comparison

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-growth-loops',
    name: 'Growth Loops Audit',
    description: 'Maps viral mechanics, referral programs, content loops, and network effects for compounding growth.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your product code, referral system, sharing mechanics, or growth strategy docs...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-growth-loops'],
    prepPrompt: `I'm preparing for a **Growth Loops Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Product type: [e.g. SaaS, marketplace, social platform, tool]
- Current acquisition channels: [e.g. paid ads, organic, referral, word of mouth]
- Growth stage: [e.g. pre-PMF, scaling, mature]
- Known concerns: [e.g. "growth depends entirely on paid ads", "referral program underperforms"]

## Content to gather

### 1. Referral/invite mechanics
- Referral program code or flow
- Invite mechanisms
- Sharing features

### 2. Content/SEO loops
- User-generated content features
- Public profiles or pages
- Embed/widget code

### 3. Product virality
- Collaboration features
- Output that gets shared externally
- Integrations that expose the product

### 4. Growth metrics (if available)
- Referral conversion rates
- Viral coefficient (K-factor)
- Organic vs. paid acquisition mix

## Don't forget
- [ ] Include code for sharing/referral features
- [ ] Note any growth experiments you've run
- [ ] Describe the moment users naturally want to share

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-retention',
    name: 'Retention Audit',
    description: 'Identifies churn signals, evaluates engagement loops, lifecycle communication, and win-back strategies.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your lifecycle emails, engagement data, cancellation flow, or retention strategy...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-retention'],
    prepPrompt: `I'm preparing for a **Retention Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Product type: [e.g. SaaS subscription, marketplace, consumer app]
- Billing model: [e.g. monthly, annual, usage-based]
- Current churn rate: [if known]
- Known concerns: [e.g. "high churn at month 3", "users stop logging in after week 1"]

## Content to gather

### 1. Lifecycle communications
- Onboarding email sequence
- Re-engagement emails
- Usage milestone notifications
- Renewal/upgrade prompts

### 2. Engagement features
- Core product loops (what brings users back)
- Notification system (email, push, in-app)
- Usage dashboards or reports

### 3. Cancellation/churn
- Cancellation flow and save offers
- Offboarding survey
- Win-back email sequence

### 4. Retention data (if available)
- Cohort retention curves
- Feature usage by retained vs. churned users
- Churn reasons from surveys

## Don't forget
- [ ] Include the cancellation flow — this is critical
- [ ] Note what "active usage" means for your product
- [ ] Include any health score or engagement scoring logic

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-ab-testing',
    name: 'A/B Testing Strategy',
    description: 'Evaluates experimentation maturity: hypothesis quality, statistical rigor, test prioritization, and learning culture.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your test results, experimentation docs, hypothesis backlog, or testing tool config...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-ab-testing'],
    prepPrompt: `I'm preparing for an **A/B Testing Strategy** audit. Please help me collect the relevant materials.

## Project context (fill in)
- Testing tool: [e.g. Optimizely, VWO, LaunchDarkly, custom]
- Monthly traffic: [approximate unique visitors to test pages]
- Testing cadence: [e.g. "2 tests/month", "sporadic", "none yet"]
- Known concerns: [e.g. "tests never reach significance", "not sure what to test"]

## Content to gather

### 1. Past test results
- 5-10 most recent A/B test results with metrics
- Test hypotheses and what was changed
- Sample sizes and confidence levels

### 2. Testing process
- How test ideas are generated and prioritized
- Who designs and implements tests
- How results are analyzed and shared

### 3. Current test pipeline
- Test backlog or idea list
- Upcoming planned tests
- Areas of the site being considered

### 4. Analytics foundation
- Key conversion metrics being tracked
- Funnel data for pages being tested
- Segmentation capabilities

## Don't forget
- [ ] Include BOTH winning and losing test results
- [ ] Note sample sizes and how long tests ran
- [ ] Include the hypothesis for each test, not just the result

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-funnel',
    name: 'Marketing Funnel Audit',
    description: 'Analyzes full-funnel health: TOFU traffic, MOFU nurture, BOFU conversion, and stage transition rates.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your funnel data, marketing strategy, campaign materials, or analytics...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-funnel'],
    prepPrompt: `I'm preparing for a **Marketing Funnel Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Business model: [e.g. B2B SaaS, e-commerce, marketplace]
- Sales motion: [e.g. self-serve/PLG, inside sales, enterprise sales]
- Funnel stages: [e.g. visitor → lead → MQL → SQL → customer]
- Known concerns: [e.g. "plenty of traffic but no leads", "leads don't convert to customers"]

## Content to gather

### 1. TOFU (awareness)
- Traffic sources and volumes
- Content/SEO performance
- Paid campaign overview

### 2. MOFU (consideration)
- Lead capture mechanisms (forms, gated content)
- Email nurture sequences
- Lead magnet content
- Lead scoring criteria

### 3. BOFU (decision)
- Sales pages, pricing, demo booking
- Sales collateral
- Objection handling content

### 4. Funnel metrics (if available)
- Conversion rates between each stage
- Average time between stages
- Drop-off rates

### 5. Post-purchase
- Onboarding communications
- Upsell/cross-sell touchpoints
- Referral/advocacy programs

## Don't forget
- [ ] Include conversion rates between EVERY stage
- [ ] Note where the biggest absolute drop-off occurs
- [ ] Include nurture email sequences, not just landing pages

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-value-proposition',
    name: 'Value Proposition Audit',
    description: 'Evaluates unique selling points, benefit clarity, customer-problem fit, and differentiation using the Value Proposition Canvas.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your product messaging, marketing materials, or value proposition statements...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-value-proposition'],
    prepPrompt: `I'm preparing for a **Value Proposition Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Product/service: [name and brief description]
- Target customer: [who is the primary buyer]
- Core problem solved: [the main pain point]
- Known concerns: [e.g. "prospects don't see why we're different", "value prop feels generic"]

## Content to gather

### 1. Value proposition materials
- Homepage headline and subhead
- "How it works" or product tour content
- Feature/benefit descriptions
- Tagline and elevator pitch

### 2. Customer evidence
- Testimonials and case studies
- Customer interview quotes or feedback
- Reviews (G2, Capterra, App Store, etc.)

### 3. Competitive context
- How competitors describe similar products
- Your current differentiation claims
- Why customers chose you (or didn't)

### 4. Internal framing
- Sales deck or pitch materials
- One-pager or product brief
- Positioning document (if exists)

## Don't forget
- [ ] Include what CUSTOMERS say the value is, not just internal messaging
- [ ] Include competitor value propositions for comparison
- [ ] Note your top 3 claimed benefits

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-user-research',
    name: 'User Research Audit',
    description: 'Assesses persona quality, JTBD alignment, research methodology, and insight-to-action pipeline.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your personas, research findings, survey results, or interview transcripts...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-user-research'],
    prepPrompt: `I'm preparing for a **User Research Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Product: [name and type]
- Research maturity: [e.g. "no formal research", "occasional surveys", "continuous research program"]
- Target audience: [who you believe your customers are]
- Known concerns: [e.g. "personas feel like guesses", "research doesn't influence decisions"]

## Content to gather

### 1. Personas / segments
- All persona documents or descriptions
- Segment definitions
- ICP (Ideal Customer Profile) document

### 2. Research data
- Survey results and questions
- Interview transcripts or summaries
- Usability test findings
- NPS or CSAT data

### 3. Customer feedback
- Support ticket themes
- Feature request patterns
- Review and rating data
- Sales call notes or objection logs

### 4. Research process
- How research is planned and conducted
- How insights are shared with teams
- Research repository or wiki (if exists)

## Don't forget
- [ ] Include the actual PERSONA documents, not just a summary
- [ ] Include raw customer quotes where possible
- [ ] Note what decisions were made based on this research

Keep total under 30,000 characters.`,
  },
  {
    id: 'marketing-gtm-strategy',
    name: 'Go-to-Market Strategy Audit',
    description: 'Evaluates launch readiness: market definition, channel strategy, sales enablement, and execution sequencing.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your GTM strategy, launch plan, marketing materials, or product brief...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['marketing-gtm-strategy'],
    prepPrompt: `I'm preparing for a **Go-to-Market Strategy Audit**. Please help me collect the relevant materials.

## Project context (fill in)
- Product/feature: [what is being launched]
- Launch stage: [e.g. pre-launch planning, soft launch, scaling]
- Target market: [who you're going after first]
- Known concerns: [e.g. "not sure about channel strategy", "launch timeline is aggressive"]

## Content to gather

### 1. Market definition
- Target market sizing and segmentation
- Beachhead market definition
- Buyer personas and decision-making unit (DMU) mapping

### 2. Positioning & messaging
- Positioning statement or document
- Messaging framework
- Key differentiators
- Competitive narrative

### 3. Channel strategy
- Planned acquisition channels
- Channel-specific tactics and budgets
- Partnership or distribution plans

### 4. Sales readiness
- Sales deck or pitch materials
- Pricing and packaging
- Objection handling guide
- Case studies or proof points

### 5. Launch plan
- Launch timeline and milestones
- Success metrics and targets
- Pre-launch activities (waitlist, beta, etc.)

## Don't forget
- [ ] Include your market sizing assumptions
- [ ] Note which channels have been validated vs. assumed
- [ ] Include success metrics and how you'll measure them

Keep total under 30,000 characters.`,
  },
  {
    id: 'developer-pain-points',
    name: 'Developer Pain Points',
    description: 'Spots DX friction: confusing APIs, unhelpful errors, inconsistent patterns, and onboarding barriers.',
    category: 'Code Quality',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-700 hover:bg-amber-600',
    placeholder: 'Paste the code a new developer would need to understand and work with...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['developer-pain-points'],
    prepPrompt: `I'm preparing code for a **Developer Pain Points** audit. Please help me collect the most impactful files.

## Project context (fill in)
- Language / framework: [e.g. TypeScript + Next.js, Python + Django, Go]
- Team size: [e.g. solo, 3 devs, 15+ engineers]
- Codebase age: [e.g. "6 months old greenfield", "3 year old monolith"]
- Known concerns: [e.g. "new hires take 2 weeks to onboard", "nobody wants to touch the billing module"]

## Files to gather

### 1. Entry points & core modules
- Main entry points and routing configuration
- The 3-5 most-edited files (run \`git log --format=format: --name-only | sort | uniq -c | sort -rn | head -20\`)
- Core business logic that multiple features depend on

### 2. Shared utilities & config
- Helper functions, utility libraries, shared constants
- Configuration files and environment variable handling
- Type definitions and shared interfaces

### 3. Error-prone areas
- Files with the most bug fixes (\`git log --all --oneline --grep="fix" -- . | head -20\`)
- Complex conditional logic or state management
- Integration points with external services

### 4. Developer-facing APIs
- Internal API route handlers
- Shared component APIs (props, hooks)
- Database query builders or ORM model definitions

### 5. Onboarding-critical files
- README or contributing guide
- Package.json scripts / Makefile
- CI/CD configuration
- Environment setup (.env.example)

## Don't forget
- [ ] Include error handling code — this is where DX friction hides
- [ ] Include any code you've heard teammates complain about
- [ ] Show configuration files so we can assess "magic values"
- [ ] Note any areas where you've seen repeated questions in code reviews

Keep total under 30,000 characters.`,
  },

  // ─── New Performance Agents ─────────────────────────────────────
  {
    id: 'network-performance',
    name: 'Network Performance',
    description: 'Audits HTTP/2, connection pooling, DNS resolution, CDN config, prefetch hints, and request waterfalls.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your HTML head, server config, resource loading code, or Lighthouse network report...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['network-performance'],
    prepPrompt: `I'm preparing my application for a **Network Performance** audit. Please help me collect the relevant files.

## Project context (fill in)
- Hosting / CDN: [e.g. Vercel, Cloudflare, AWS CloudFront, Netlify]
- Protocol: [e.g. HTTP/2, HTTP/3, unsure]
- Known concerns: [e.g. "slow TTFB", "too many third-party requests", "no CDN configured"]

## Files to gather
- HTML \`<head>\` section (resource hints: preconnect, preload, dns-prefetch)
- Server configuration (nginx.conf, Caddyfile, vercel.json, next.config.ts)
- Third-party script loading code (analytics, chat widgets, ads)
- Any fetch/HTTP client configuration (connection pooling, keep-alive settings)
- Lighthouse or WebPageTest network waterfall screenshots
- Cache-Control and CDN header configuration

## Don't forget
- [ ] Include ALL third-party script tags and their loading attributes
- [ ] Note the number of unique domains your page loads resources from
- [ ] Include any redirect chains (HTTP->HTTPS, www->non-www)

Keep total under 30,000 characters.`,
  },
  {
    id: 'database-performance',
    name: 'Database Performance',
    description: 'Detects N+1 queries, missing indexes, full table scans, connection pool issues, and query anti-patterns.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your ORM models, database queries, API route handlers, or EXPLAIN output...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['database-performance'],
    prepPrompt: `I'm preparing my application for a **Database Performance** audit. Please help me collect the relevant files.

## Project context (fill in)
- Database: [e.g. PostgreSQL 16, MySQL 8, MongoDB 7, SQLite]
- ORM/query builder: [e.g. Prisma, Drizzle, Sequelize, TypeORM, raw SQL]
- Table sizes: [e.g. "users: 100K rows, orders: 5M rows, logs: 50M rows"]
- Known concerns: [e.g. "slow API endpoints", "suspected N+1", "high DB CPU"]

## Files to gather
- ALL ORM model definitions / schema files
- API route handlers that query the database
- Any repository or data access layer code
- Database migration files (for index definitions)
- Connection pool configuration
- Any raw SQL queries

## Don't forget
- [ ] Include the FULL API handler, not just the query — context matters for N+1
- [ ] Note table sizes and growth rates
- [ ] Include index definitions (or migration files that create indexes)
- [ ] Show any caching layer between your app and the database

Keep total under 30,000 characters.`,
  },
  {
    id: 'image-optimization',
    name: 'Image Optimization',
    description: 'Reviews image formats, responsive sizing, lazy loading, CDN delivery, and LCP image optimization.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your image components, HTML with img tags, or image loading configuration...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['image-optimization'],
    prepPrompt: `I'm preparing my site for an **Image Optimization** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js 15, Astro, plain HTML, WordPress]
- Image component: [e.g. next/image, custom img tags, Cloudinary SDK]
- Image CDN: [e.g. Cloudinary, Imgix, Vercel Image Optimization, none]
- Known concerns: [e.g. "slow LCP", "huge page weight", "no lazy loading"]

## Files to gather
- All components that render images (img tags, Image components, CSS backgrounds)
- Image configuration (next.config.ts images section, CDN settings)
- Hero / above-the-fold page templates
- Any image upload or processing code
- HTML \`<head>\` section (preload hints for images)

## Don't forget
- [ ] Include the hero/LCP image implementation specifically
- [ ] Note which images are above-the-fold vs below-the-fold
- [ ] Include any image processing pipeline (upload -> resize -> serve)
- [ ] Show the rendered HTML for image-heavy pages

Keep total under 30,000 characters.`,
  },
  {
    id: 'ssr-performance',
    name: 'SSR Performance',
    description: 'Analyzes streaming SSR, selective hydration, server timing, TTFB, and rendering strategy selection.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your page components, data fetching logic, layout files, and server configuration...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['ssr-performance'],
    prepPrompt: `I'm preparing my application for an **SSR Performance** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js 15 App Router, Nuxt 3, Remix, Astro, SvelteKit]
- Rendering strategies used: [e.g. SSR, SSG, ISR, streaming, RSC]
- Current TTFB: [e.g. "~800ms", "varies", "don't know"]
- Known concerns: [e.g. "slow initial page load", "hydration errors", "TTFB spikes"]

## Files to gather
- ALL page/route components (page.tsx, +page.svelte, etc.)
- Layout components (layout.tsx, +layout.svelte)
- Data fetching code (getServerSideProps, server loaders, async server components)
- loading.tsx / Suspense boundary files
- Server configuration and middleware
- "use client" boundary components

## Don't forget
- [ ] Include EVERY page component (SSR strategy varies per page)
- [ ] Show the data fetching for each page (what blocks the response?)
- [ ] Include Suspense/loading boundaries
- [ ] Note which components are server vs client components

Keep total under 30,000 characters.`,
  },
  {
    id: 'api-performance',
    name: 'API Performance',
    description: 'Reviews response times, payload sizes, batching, caching headers, and serialization efficiency.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your API route handlers, middleware, serialization logic, or OpenAPI spec...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['api-performance'],
    prepPrompt: `I'm preparing my API for a **Performance** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js API routes, Express, Fastify, Django REST, Go net/http]
- API style: [REST, GraphQL, tRPC, gRPC]
- Traffic: [e.g. "1K req/min", "10K req/min", "just launched"]
- Known concerns: [e.g. "slow endpoints", "large payloads", "no caching"]

## Files to gather
- ALL API route handlers / controllers
- Middleware chain (auth, validation, logging, CORS)
- Serialization logic (how objects become JSON responses)
- Response type definitions / schemas
- Any caching layer (Redis, in-memory, CDN config)
- Rate limiting configuration

## Don't forget
- [ ] Include the FULL middleware chain (each layer adds latency)
- [ ] Show the actual response shape for key endpoints
- [ ] Note any endpoints known to be slow
- [ ] Include pagination implementation

Keep total under 30,000 characters.`,
  },
  {
    id: 'css-performance',
    name: 'CSS Performance',
    description: 'Audits critical CSS, unused styles, selector complexity, layout thrashing, and CLS-causing patterns.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your CSS files, styled components, Tailwind config, or component styling code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['css-performance'],
    prepPrompt: `I'm preparing my styles for a **CSS Performance** audit. Please help me collect the relevant files.

## Project context (fill in)
- Styling approach: [e.g. Tailwind CSS, CSS Modules, styled-components, vanilla CSS, Sass]
- Framework: [e.g. Next.js, Vite + React, plain HTML]
- Total CSS size: [e.g. "don't know", "~200KB", "using Tailwind JIT"]
- Known concerns: [e.g. "large CSS bundle", "layout shifts", "slow style changes"]

## Files to gather
- Global CSS files (globals.css, reset.css, theme.css)
- Tailwind config (tailwind.config.ts) or CSS framework config
- Components with inline styles or CSS-in-JS
- Layout components (especially above-the-fold)
- Any CSS that runs during animations or scroll
- HTML \`<head>\` showing stylesheet loading order

## Don't forget
- [ ] Include ALL CSS loading (link tags, @import, CSS-in-JS)
- [ ] Show any JavaScript that reads/writes layout properties
- [ ] Include font loading configuration
- [ ] Note any known layout shift issues

Keep total under 30,000 characters.`,
  },
  {
    id: 'javascript-performance',
    name: 'JavaScript Performance',
    description: 'Analyzes main thread blocking, long tasks, code splitting, tree-shaking, and script loading strategy.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your JS/TS entry points, component code, build config, or bundle analysis output...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['javascript-performance'],
    prepPrompt: `I'm preparing my JavaScript for a **Performance** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js 15, React + Vite, Vue + Nuxt, vanilla JS]
- Bundler: [e.g. webpack, Vite/Rollup, Turbopack, esbuild]
- Total JS size: [e.g. "~500KB", "don't know", "Lighthouse says 1.2MB"]
- Known concerns: [e.g. "slow interactions", "large bundle", "jank on mobile"]

## Files to gather
- Entry point files (app.tsx, main.ts, _app.tsx)
- Largest page components
- Import statements from key modules (to trace dependency weight)
- Build configuration (next.config.ts, vite.config.ts, webpack.config.js)
- package.json (full dependencies)
- Any Web Worker code
- Third-party script loading

## Don't forget
- [ ] Include build output showing chunk/page sizes
- [ ] List ALL dependencies from package.json
- [ ] Show dynamic import() usage (or lack thereof)
- [ ] Note any known slow interactions

Keep total under 30,000 characters.`,
  },
  {
    id: 'animation-performance',
    name: 'Animation Performance',
    description: 'Reviews GPU compositing, jank prevention, requestAnimationFrame usage, will-change, and scroll effects.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your animation code, CSS transitions, scroll handlers, or Framer Motion components...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['animation-performance'],
    prepPrompt: `I'm preparing my animations for a **Performance** audit. Please help me collect the relevant files.

## Project context (fill in)
- Animation library: [e.g. CSS transitions, Framer Motion, GSAP, anime.js, Lottie, none]
- Framework: [e.g. React, Vue, Svelte, vanilla JS]
- Known concerns: [e.g. "janky scroll animations", "slow page transitions", "mobile stuttering"]

## Files to gather
- ALL components with animations or transitions
- CSS files with @keyframes, transitions, or will-change
- Scroll event handlers and scroll-linked effects
- Page transition components
- Any requestAnimationFrame usage
- Loading/skeleton animation components

## Don't forget
- [ ] Include ALL scroll event listeners
- [ ] Show any JavaScript that reads layout properties during animation
- [ ] Include CSS with will-change or transform: translateZ(0) hacks
- [ ] Note which animations run on mobile (where GPU is weaker)

Keep total under 30,000 characters.`,
  },
  {
    id: 'web-vitals',
    name: 'Core Web Vitals',
    description: 'Optimizes LCP, INP, CLS, FCP, and TTFB against Google thresholds with specific remediation steps.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your page components, Lighthouse report, or PageSpeed Insights results...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['web-vitals'],
    prepPrompt: `I'm preparing my site for a **Core Web Vitals** audit. Please help me collect the relevant files and data.

## Project context (fill in)
- Framework: [e.g. Next.js 15, Nuxt 3, WordPress, static HTML]
- Current scores: [e.g. "LCP 3.2s, CLS 0.15, INP unknown" or "don't know"]
- Target: [e.g. "pass all CWV for Google Search ranking", "improve mobile scores"]
- Known concerns: [e.g. "LCP image is slow", "layout shifts on load", "slow interactions"]

## Files to gather
- Above-the-fold page components (the LCP element lives here)
- HTML \`<head>\` section (resource loading order)
- Image components (especially hero/LCP images)
- Font loading configuration
- JavaScript entry points (what blocks interactivity)
- Any web-vitals.js integration code

## Don't forget
- [ ] Identify the LCP element (Chrome DevTools > Performance > LCP marker)
- [ ] Note any layout shifts visible during page load
- [ ] Include Lighthouse report if available
- [ ] Test on mobile (CWV thresholds are for mobile by default)

Keep total under 30,000 characters.`,
  },
  {
    id: 'runtime-performance',
    name: 'Runtime Performance',
    description: 'Detects memory leaks, GC pressure, event listener accumulation, closure captures, and unbounded caches.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your components, event handlers, subscription code, or memory-intensive modules...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['runtime-performance'],
    prepPrompt: `I'm preparing my application for a **Runtime Performance** audit. Please help me collect the relevant files.

## Project context (fill in)
- Runtime: [e.g. browser, Node.js 22, Deno, Bun]
- Framework: [e.g. React 19, Vue 3, Express, Fastify]
- Process lifetime: [e.g. "serverless (short-lived)", "long-running server", "SPA users stay 30+ min"]
- Known concerns: [e.g. "memory grows over time", "event listener warnings", "GC pauses"]

## Files to gather
- Components with useEffect / lifecycle hooks (cleanup logic)
- Event listener registration code (addEventListener, EventEmitter.on)
- Timer code (setInterval, setTimeout, requestAnimationFrame)
- Subscription/observable code (WebSocket, SSE, RxJS, pub/sub)
- In-memory cache implementations (Map, WeakMap, LRU)
- Global state management (Redux stores, Zustand, Context)

## Don't forget
- [ ] Include cleanup/teardown code for every subscription
- [ ] Show component unmount logic (useEffect return functions)
- [ ] Include any global Maps, Sets, or arrays that grow over time
- [ ] Note any "Maximum call stack" or "heap out of memory" errors

Keep total under 30,000 characters.`,
  },
  {
    id: 'build-performance',
    name: 'Build Performance',
    description: 'Optimizes compile times, HMR speed, bundler config, caching strategies, and CI build pipelines.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your build config, tsconfig, CI pipeline, or npm run build output...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['build-performance'],
    prepPrompt: `I'm preparing my build system for a **Build Performance** audit. Please help me collect the relevant files.

## Project context (fill in)
- Build tool: [e.g. Next.js + Turbopack, Vite, webpack, esbuild]
- TypeScript: [yes/no, with SWC or tsc]
- Current build time: [e.g. "3 minutes", "45 seconds", "don't know"]
- HMR speed: [e.g. "instant", "2-3 seconds", "full page refresh"]
- Known concerns: [e.g. "slow CI builds", "HMR is sluggish", "builds OOM sometimes"]

## Files to gather
- Build configuration (next.config.ts, vite.config.ts, webpack.config.js)
- TypeScript config (tsconfig.json, tsconfig.build.json)
- Package manager config (package.json, pnpm-workspace.yaml, turbo.json)
- CI/CD pipeline (.github/workflows/*.yml, Dockerfile)
- PostCSS / Tailwind config
- Any custom build scripts

## Don't forget
- [ ] Include the FULL build output (chunk sizes, warnings, timing)
- [ ] Include CI pipeline configuration
- [ ] Note if builds are slower on CI vs local
- [ ] Include monorepo config if applicable (turbo.json, nx.json)

Keep total under 30,000 characters.`,
  },
  {
    id: 'navigation-ux',
    name: 'Navigation UX',
    description: 'Audits information architecture, wayfinding, breadcrumbs, menus, and deep-linking patterns.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your navigation markup, site map structure, menu components, or route configuration...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['navigation-ux'],
    prepPrompt: `I'm preparing navigation for a **Navigation UX** audit. Please help me collect the relevant files.

## Project context (fill in)
- App type: [e.g. SaaS dashboard, e-commerce, content site, admin panel]
- Navigation pattern: [e.g. sidebar, top bar, hamburger, tabbed, bottom nav]
- Page count: [e.g. ~20 pages, 100+ pages]
- Known concerns: [e.g. "users can't find settings", "too many menu levels", "no breadcrumbs"]

## Files to gather
- Main navigation component (header, sidebar, bottom nav)
- Route/page configuration (Next.js app router, React Router config)
- Breadcrumb component (if it exists)
- Search/command palette component (if it exists)
- Mobile navigation component
- Any sitemap or IA documentation

## Don't forget
- [ ] Include ALL navigation variants (desktop, mobile, tablet)
- [ ] Show the full menu hierarchy (all levels, all items)
- [ ] Include breadcrumb implementation
- [ ] Note any pages users report difficulty finding
- [ ] Include URL structure for key pages

Keep total under 30,000 characters.`,
  },
  {
    id: 'micro-interactions',
    name: 'Micro-interactions',
    description: 'Reviews feedback patterns, loading states, transitions, empty states, and state change animations.',
    category: 'Design',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your UI components with state handling, loading patterns, empty states, or transition code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['micro-interactions'],
    prepPrompt: `I'm preparing UI components for a **Micro-interactions** audit. Please help me collect the relevant files.

## Project context (fill in)
- UI framework: [e.g. React, Vue, Svelte]
- Animation library: [e.g. Framer Motion, CSS transitions, GSAP, none]
- Known concerns: [e.g. "no loading states", "jarring page transitions", "empty states are blank"]

## Files to gather
- Components with loading states (spinners, skeletons, progress bars)
- Empty state components
- Toast/notification components
- Button components (showing click/loading/success states)
- Page transition wrappers
- Any animation utility files

## Don't forget
- [ ] Show ALL states of each component (default, loading, success, error, empty)
- [ ] Include hover/focus/active styles
- [ ] Show how success/error feedback is communicated to users
- [ ] Include any prefers-reduced-motion handling
- [ ] Note which actions lack feedback entirely

Keep total under 30,000 characters.`,
  },
  {
    id: 'error-ux',
    name: 'Error UX',
    description: 'Evaluates error messages, recovery flows, 404/500 pages, validation UX, and graceful degradation.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your error pages, validation components, error boundary code, or error message patterns...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['error-ux'],
    prepPrompt: `I'm preparing error handling UI for an **Error UX** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. Next.js, React, Vue]
- Error handling approach: [e.g. error boundaries, try-catch, global handler]
- Known concerns: [e.g. "generic error messages", "no 404 page", "users don't know what went wrong"]

## Files to gather
- Custom error pages (404, 500, 403)
- Error boundary components
- Form validation and error display components
- Toast/alert error notification components
- Offline/network error handling
- API error response handling

## Don't forget
- [ ] Include ALL error pages (404, 500, 403, etc.)
- [ ] Show every type of error message users can see
- [ ] Include form validation error patterns
- [ ] Show how network/API errors are handled in the UI
- [ ] Note any places where errors are silently swallowed

Keep total under 30,000 characters.`,
  },
  {
    id: 'mobile-ux',
    name: 'Mobile UX',
    description: 'Audits touch targets, gesture design, thumb zones, bottom sheets, and mobile-first interaction patterns.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your mobile layouts, touch-interactive components, responsive CSS, or viewport configuration...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['mobile-ux'],
    prepPrompt: `I'm preparing mobile UI for a **Mobile UX** audit. Please help me collect the relevant files.

## Project context (fill in)
- Mobile approach: [e.g. responsive web, PWA, React Native, hybrid]
- Primary device context: [e.g. mobile-first, desktop-first, both equal]
- Known concerns: [e.g. "buttons too small", "can't reach top nav", "forms painful on mobile"]

## Files to gather
- Mobile navigation components (bottom nav, hamburger menu)
- Touch-interactive components (swipeable lists, bottom sheets, modals)
- Form components used on mobile
- Viewport meta tag and responsive CSS
- Any mobile-specific components or breakpoint logic

## Don't forget
- [ ] Include the viewport meta tag configuration
- [ ] Show components at mobile widths (375px, 428px)
- [ ] Include touch target sizes (measure buttons, links, tap areas)
- [ ] Show how forms behave with mobile keyboards
- [ ] Note any horizontal scrolling issues

Keep total under 30,000 characters.`,
  },
  {
    id: 'data-visualization',
    name: 'Data Visualization',
    description: 'Reviews charts, graphs, dashboards, and visual data accessibility for clarity and correctness.',
    category: 'Design',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your chart components, dashboard layouts, D3/Recharts/Chart.js code, or visualization configs...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['data-visualization'],
    prepPrompt: `I'm preparing data visualizations for a **Data Visualization** audit. Please help me collect the relevant files.

## Project context (fill in)
- Visualization library: [e.g. D3.js, Recharts, Chart.js, Plotly, Nivo]
- Chart types used: [e.g. bar, line, pie, scatter, dashboard KPIs]
- Data domain: [e.g. financial, analytics, scientific, operational]
- Known concerns: [e.g. "charts not accessible", "colors hard to distinguish", "dashboard too cluttered"]

## Files to gather
- All chart/graph components
- Dashboard layout components
- Color palette / theme configuration for charts
- Any data transformation utilities for chart data
- Tooltip and legend components

## Don't forget
- [ ] Include ALL chart types used in the application
- [ ] Show the color palette used for data series
- [ ] Include any accessibility accommodations (alt text, data tables)
- [ ] Show how charts behave on mobile / small screens
- [ ] Note any interactive features (zoom, filter, drill-down)

Keep total under 30,000 characters.`,
  },
  {
    id: 'content-design',
    name: 'Content Design',
    description: 'Audits microcopy, labels, help text, progressive disclosure, and content readability.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your UI with labels, headings, help text, error messages, tooltips, or onboarding copy...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['content-design'],
    prepPrompt: `I'm preparing UI copy for a **Content Design** audit. Please help me collect the relevant content.

## Project context (fill in)
- Product type: [e.g. SaaS, e-commerce, developer tool, consumer app]
- Target audience: [e.g. non-technical users, developers, enterprise admins]
- Voice/tone guide: [e.g. "friendly and casual", "professional and precise", "none exists"]
- Known concerns: [e.g. "users don't understand labels", "too much jargon", "inconsistent terminology"]

## Content to gather
- Key pages with their full copy (headings, labels, descriptions, CTAs)
- All error messages and success messages
- Tooltip and help text content
- Onboarding/tutorial copy
- Empty state messages
- Form labels and placeholder text

## Don't forget
- [ ] Include the ACTUAL copy users see, not just the code
- [ ] Show error messages in context (near the triggering element)
- [ ] Include tooltips and help text
- [ ] Note any terminology that users have asked about
- [ ] Include any existing voice/tone guidelines

Keep total under 30,000 characters.`,
  },
  {
    id: 'onboarding-ux',
    name: 'Onboarding UX',
    description: 'Reviews first-run experience, tutorials, tooltips, progressive revelation, and user activation flow.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your onboarding flow, setup wizard, tutorial components, or first-run experience code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['onboarding-ux'],
    prepPrompt: `I'm preparing onboarding UI for an **Onboarding UX** audit. Please help me collect the relevant files.

## Project context (fill in)
- Onboarding pattern: [e.g. setup wizard, product tour, checklist, video, progressive disclosure, none]
- Activation metric: [e.g. "created first project", "connected data source", "invited team member"]
- Current activation rate: [e.g. "~40% complete setup", "unknown"]
- Known concerns: [e.g. "users drop off at step 3", "too many setup steps", "no guidance after signup"]

## Files to gather
- Signup/registration flow
- Setup wizard or onboarding steps
- Product tour / tooltip components
- Onboarding checklist component
- Empty states that serve as first-use guidance
- Any welcome email or in-app welcome screen

## Don't forget
- [ ] Include EVERY step of the onboarding flow
- [ ] Show what happens when a user skips onboarding
- [ ] Include empty states for key features
- [ ] Note the minimum path to first value ("aha moment")
- [ ] Show what returning users see if they didn't finish setup

Keep total under 30,000 characters.`,
  },
  {
    id: 'search-ux',
    name: 'Search UX',
    description: 'Evaluates autocomplete, filters, results display, no-results handling, and search accessibility.',
    category: 'Design',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your search components, filter UI, results display, autocomplete logic, or search config...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['search-ux'],
    prepPrompt: `I'm preparing search UI for a **Search UX** audit. Please help me collect the relevant files.

## Project context (fill in)
- Search technology: [e.g. Algolia, Elasticsearch, Meilisearch, custom API, client-side filtering]
- Search scope: [e.g. global site search, product catalog, documentation, within-page]
- Result types: [e.g. products, articles, users, mixed]
- Known concerns: [e.g. "no autocomplete", "poor no-results page", "filters confusing", "search too slow"]

## Files to gather
- Search input component
- Autocomplete/suggestion component
- Search results display component
- Filter/facet components
- Sorting controls
- No-results / empty search state
- Pagination or infinite scroll component

## Don't forget
- [ ] Include ALL search-related components
- [ ] Show the no-results experience
- [ ] Include filter/facet UI
- [ ] Show how search works on mobile
- [ ] Note search accessibility (keyboard nav, screen reader)

Keep total under 30,000 characters.`,
  },
  {
    id: 'table-design',
    name: 'Table & List Design',
    description: 'Audits table sorting, filtering, pagination, responsive behavior, and data table accessibility.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your data table components, list views, grid layouts, or tabular data display code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['table-design'],
    prepPrompt: `I'm preparing data tables for a **Table & List Design** audit. Please help me collect the relevant files.

## Project context (fill in)
- Table library: [e.g. TanStack Table, AG Grid, custom, native HTML tables]
- Table types: [e.g. data management, read-only display, editable, comparison]
- Row count range: [e.g. "10-50 rows", "1000+ rows with pagination", "dynamic"]
- Known concerns: [e.g. "tables break on mobile", "no sorting", "pagination confusing", "not accessible"]

## Files to gather
- All table/data grid components
- Pagination component
- Sort and filter controls
- Row selection / bulk action components
- Mobile table adaptation (if any)
- Empty and loading state for tables

## Don't forget
- [ ] Include ALL tables in the application
- [ ] Show table behavior at mobile widths
- [ ] Include sort, filter, and pagination interactions
- [ ] Show empty and loading states for tables
- [ ] Note any tables with accessibility issues (missing headers, no keyboard nav)

Keep total under 30,000 characters.`,
  },
  {
    id: 'notification-ux',
    name: 'Notification UX',
    description: 'Reviews toasts, alerts, badges, interruption hierarchy, and notification accessibility.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your toast/snackbar components, alert banners, badge UI, or notification system code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['notification-ux'],
    prepPrompt: `I'm preparing notification UI for a **Notification UX** audit. Please help me collect the relevant files.

## Project context (fill in)
- Notification library: [e.g. react-hot-toast, sonner, custom, native alerts]
- Notification types: [e.g. success toasts, error alerts, badges, banners, confirmation dialogs]
- Notification channels: [e.g. in-app only, email + in-app, push notifications]
- Known concerns: [e.g. "toasts disappear too fast", "no error notifications", "notification overload"]

## Files to gather
- Toast/snackbar component and configuration
- Alert/banner components
- Badge/indicator components
- Confirmation dialog components
- Notification center/history (if it exists)
- Any notification preference settings

## Don't forget
- [ ] Include ALL notification types (success, error, warning, info)
- [ ] Show stacking/queuing behavior for multiple notifications
- [ ] Include confirmation dialogs for destructive actions
- [ ] Show how notifications appear on mobile
- [ ] Note any screen reader / aria-live attributes

Keep total under 30,000 characters.`,
  },
  {
    id: 'spacing-layout',
    name: 'Spacing & Layout',
    description: 'Audits visual rhythm, whitespace strategy, grid systems, alignment, and spacing token consistency.',
    category: 'Design',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your CSS with spacing values, Tailwind config, layout components, or design tokens...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['spacing-layout'],
    prepPrompt: `I'm preparing layout code for a **Spacing & Layout** audit. Please help me collect the relevant files.

## Project context (fill in)
- CSS approach: [e.g. Tailwind, CSS Modules, styled-components, vanilla CSS]
- Grid system: [e.g. CSS Grid, Flexbox, 12-column grid, none explicit]
- Spacing scale: [e.g. "8pt grid", "Tailwind defaults", "custom scale", "ad-hoc values"]
- Known concerns: [e.g. "inconsistent spacing", "things don't align", "too cramped on mobile"]

## Files to gather
- Tailwind config (theme.spacing, theme.extend) or CSS custom properties for spacing
- Global CSS with layout rules
- Key page layout components (header, sidebar, main content, footer)
- Card, modal, and form layout components
- Any spacing utility classes or components

## Don't forget
- [ ] Include the spacing scale / token definitions
- [ ] Show layout at multiple viewport widths
- [ ] Include components with the most visual spacing (cards, forms, dashboards)
- [ ] Note any spacing values that seem inconsistent or arbitrary
- [ ] Include responsive spacing changes across breakpoints

Keep total under 30,000 characters.`,
  },

  // ─── SEO: 11 New Agents ───────────────────────────────────────
  { id: 'seo-local', name: 'Local SEO', description: 'Audits Google Business Profile, NAP consistency, local schema, citations, and review management.', category: 'SEO', accentClass: 'text-emerald-400 hover:bg-emerald-500/10', buttonClass: 'bg-emerald-800 hover:bg-emerald-700', placeholder: 'Paste your local landing pages, schema markup, GBP data, or citation list...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['seo-local'], prepPrompt: `I'm preparing my site for a **Local SEO** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Business type: [e.g. restaurant, law firm, plumber, retail store]\n- Locations: [e.g. single location, 5 locations, service area business]\n- Current local SEO status: [e.g. "GBP claimed but not optimized", "no local schema"]\n\n## Content to gather\n- Google Business Profile information (name, address, phone, categories, description)\n- Local landing page HTML (especially schema markup in <head>)\n- NAP as it appears on your website footer/contact page\n- List of current citations/directory listings\n- Review data (count, average rating, recent reviews)\n- Any local schema markup (JSON-LD)\n\n## Don't forget\n- [ ] Include the exact NAP from your website, GBP, and 3-5 top citations\n- [ ] Include any LocalBusiness schema markup\n- [ ] Note your target service area or neighborhoods\n\nKeep total under 30,000 characters.` },
  { id: 'seo-ecommerce', name: 'E-commerce SEO', description: 'Reviews product pages, faceted navigation, canonical strategy, product schema, and category architecture.', category: 'SEO', accentClass: 'text-emerald-400 hover:bg-emerald-500/10', buttonClass: 'bg-emerald-800 hover:bg-emerald-700', placeholder: 'Paste your product page HTML, category pages, faceted navigation config, or schema markup...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['seo-ecommerce'], prepPrompt: `I'm preparing my store for an **E-commerce SEO** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Platform: [e.g. Shopify, WooCommerce, Next.js custom, Magento]\n- Product count: [e.g. 50 products, 10,000 SKUs]\n- Known concerns: [e.g. "faceted nav creating duplicate URLs", "no product schema"]\n\n## Content to gather\n- Product page HTML (including <head> with schema)\n- Category/collection page HTML\n- Faceted navigation/filter URL examples\n- Product schema markup (JSON-LD)\n- Canonical tag configuration\n- Pagination implementation\n- robots.txt and sitemap\n\n## Don't forget\n- [ ] Include examples of filtered/faceted URLs\n- [ ] Show how out-of-stock products are handled\n- [ ] Include product variant URLs (color, size)\n\nKeep total under 30,000 characters.` },
  { id: 'seo-content-audit', name: 'Content SEO Audit', description: 'Identifies thin content, keyword cannibalization, topical authority gaps, and content consolidation opportunities.', category: 'SEO', accentClass: 'text-emerald-400 hover:bg-emerald-500/10', buttonClass: 'bg-emerald-800 hover:bg-emerald-700', placeholder: 'Paste your content inventory, page titles, URLs, and sample content...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['seo-content-audit'], prepPrompt: `I'm preparing my site for a **Content SEO Audit**. Please help me collect the relevant content.\n\n## Project context (fill in)\n- Site type: [e.g. blog, SaaS, e-commerce, news]\n- Content volume: [e.g. 30 blog posts, 200 pages]\n- Known concerns: [e.g. "thin category pages", "multiple posts targeting same keyword"]\n\n## Content to gather\n- Complete list of all page URLs with titles and H1s\n- Full content of your top 10 pages by traffic\n- Content of pages you suspect have issues\n- Any keyword tracking data\n- Google Search Console performance data\n\n## Don't forget\n- [ ] Include ALL page titles — we need to find cannibalization\n- [ ] Note pages that target the same keyword\n- [ ] Include word counts if available\n\nKeep total under 30,000 characters.` },
  { id: 'seo-link-building', name: 'Link Profile Audit', description: 'Analyzes backlink quality, anchor text health, toxic links, internal linking structure, and link building opportunities.', category: 'SEO', accentClass: 'text-emerald-400 hover:bg-emerald-500/10', buttonClass: 'bg-emerald-800 hover:bg-emerald-700', placeholder: 'Paste your backlink data, internal link structure, anchor text report, or navigation HTML...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['seo-link-building'], prepPrompt: `I'm preparing my site for a **Link Profile Audit**. Please help me collect the relevant data.\n\n## Project context (fill in)\n- Domain age: [e.g. 2 years, 10 years]\n- Known concerns: [e.g. "spammy backlinks", "poor internal linking", "no link building done"]\n\n## Data to gather\n- Backlink report from Ahrefs/Moz/SEMrush (top referring domains)\n- Anchor text distribution report\n- Internal linking structure (navigation HTML, sidebar links)\n- List of pages with the most/fewest internal links\n- Any disavow file if one exists\n\n## Don't forget\n- [ ] Include anchor text distribution data\n- [ ] Note any known spammy backlinks\n- [ ] Include your site navigation HTML\n\nKeep total under 30,000 characters.` },
  { id: 'seo-mobile', name: 'Mobile SEO', description: 'Reviews mobile-first indexing readiness, responsive design, mobile page speed, and mobile usability.', category: 'SEO', accentClass: 'text-emerald-400 hover:bg-emerald-500/10', buttonClass: 'bg-emerald-800 hover:bg-emerald-700', placeholder: 'Paste your mobile viewport config, responsive CSS, or mobile page HTML output...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['seo-mobile'], prepPrompt: `I'm preparing my site for a **Mobile SEO** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Framework: [e.g. Next.js, responsive WordPress theme, separate mobile site]\n- Mobile traffic share: [e.g. "60% mobile", "unknown"]\n- Known concerns: [e.g. "content hidden on mobile", "slow on 3G", "tap targets too small"]\n\n## Files to gather\n- Viewport meta tag configuration\n- CSS media queries and breakpoints\n- Mobile-rendered HTML for key pages\n- Mobile PageSpeed Insights results\n- Any AMP configuration (if applicable)\n\n## Don't forget\n- [ ] Include the rendered HTML as seen on mobile (not just desktop)\n- [ ] Note any content that differs between mobile and desktop\n- [ ] Include mobile Core Web Vitals data if available\n\nKeep total under 30,000 characters.` },
  { id: 'seo-international', name: 'International SEO', description: 'Audits hreflang implementation, geo-targeting, URL structure for locales, and content localization quality.', category: 'SEO', accentClass: 'text-emerald-400 hover:bg-emerald-500/10', buttonClass: 'bg-emerald-800 hover:bg-emerald-700', placeholder: 'Paste your hreflang tags, locale URL structure, language switcher, or localized page HTML...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['seo-international'], prepPrompt: `I'm preparing my site for an **International SEO** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Target markets: [e.g. US, UK, Germany, Japan]\n- URL strategy: [e.g. /en/, en.example.com, example.de]\n- Translation method: [e.g. professional translation, auto-translated, native content]\n\n## Files to gather\n- Hreflang tags from <head> of key pages\n- URL structure examples for each locale\n- Language switcher implementation\n- Google Search Console international targeting settings\n- Sitemap(s) per language\n\n## Don't forget\n- [ ] Include hreflang tags from at least 3 different pages\n- [ ] Show the x-default hreflang if present\n- [ ] Note any auto-redirect based on IP or browser language\n\nKeep total under 30,000 characters.` },
  { id: 'seo-site-architecture', name: 'Site Architecture', description: 'Evaluates crawl budget, URL structure, content siloing, internal link topology, and navigation hierarchy.', category: 'SEO', accentClass: 'text-emerald-400 hover:bg-emerald-500/10', buttonClass: 'bg-emerald-800 hover:bg-emerald-700', placeholder: 'Paste your sitemap, URL list, navigation HTML, routing config, or robots.txt...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['seo-site-architecture'], prepPrompt: `I'm preparing my site for a **Site Architecture** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Total pages: [e.g. 50 pages, 5,000 pages, 1M+ pages]\n- Framework: [e.g. Next.js with file-based routing, WordPress, custom CMS]\n- Known concerns: [e.g. "orphan pages", "deep click depth", "crawl budget waste"]\n\n## Files to gather\n- Complete sitemap.xml (or sitemap index)\n- robots.txt\n- Navigation HTML (header, footer, sidebar)\n- URL routing configuration\n- Breadcrumb implementation\n- Internal search configuration\n\n## Don't forget\n- [ ] Include the full URL list or sitemap\n- [ ] Show the navigation hierarchy\n- [ ] Note any pages only accessible via search or deep links\n\nKeep total under 30,000 characters.` },
  { id: 'seo-core-web-vitals', name: 'SEO & Core Web Vitals', description: 'Analyzes LCP, CLS, INP as ranking factors with page experience signals and CrUX data assessment.', category: 'SEO', accentClass: 'text-emerald-400 hover:bg-emerald-500/10', buttonClass: 'bg-emerald-800 hover:bg-emerald-700', placeholder: 'Paste your PageSpeed Insights results, CrUX data, layout components, or performance config...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['seo-core-web-vitals'], prepPrompt: `I'm preparing my site for a **Core Web Vitals SEO** audit. Please help me collect the relevant data.\n\n## Project context (fill in)\n- Framework: [e.g. Next.js, WordPress, custom React]\n- Current CWV status: [e.g. "failing LCP", "good but want to improve", "unknown"]\n- Traffic: [e.g. "100K monthly visits", "small site"]\n\n## Data to gather\n- PageSpeed Insights results for top 5 pages\n- CrUX data from Google Search Console (if available)\n- Layout components (hero, header, images above fold)\n- Font loading configuration\n- Third-party script tags\n- Image optimization configuration\n\n## Don't forget\n- [ ] Include both mobile and desktop PageSpeed results\n- [ ] Note any third-party scripts (analytics, chat widgets, ads)\n- [ ] Include your image optimization strategy\n\nKeep total under 30,000 characters.` },
  { id: 'seo-structured-data', name: 'Structured Data', description: 'Reviews Schema.org markup, JSON-LD implementation, rich result eligibility, and knowledge graph optimization.', category: 'SEO', accentClass: 'text-emerald-400 hover:bg-emerald-500/10', buttonClass: 'bg-emerald-800 hover:bg-emerald-700', placeholder: 'Paste your JSON-LD blocks, page HTML with schema, or structured data configuration...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['seo-structured-data'], prepPrompt: `I'm preparing my site for a **Structured Data** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Site type: [e.g. blog, e-commerce, local business, SaaS]\n- Current schema: [e.g. "basic Organization only", "product schema on all items", "none"]\n- Known concerns: [e.g. "no rich results showing", "validation errors in GSC"]\n\n## Files to gather\n- All JSON-LD blocks from your key pages\n- Page HTML showing where schema is injected\n- Schema generation code (if dynamic)\n- Google Rich Results Test output for key pages\n- Google Search Console enhancement reports\n\n## Don't forget\n- [ ] Include schema from EVERY page type (home, blog, product, about, etc.)\n- [ ] Include the full JSON-LD, not just snippets\n- [ ] Note which pages show rich results in search\n\nKeep total under 30,000 characters.` },
  { id: 'seo-indexation', name: 'Indexation Audit', description: 'Diagnoses crawl errors, canonical conflicts, noindex issues, orphan pages, and index bloat.', category: 'SEO', accentClass: 'text-emerald-400 hover:bg-emerald-500/10', buttonClass: 'bg-emerald-800 hover:bg-emerald-700', placeholder: 'Paste your robots.txt, sitemap, canonical tags, GSC coverage report, or page headers...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['seo-indexation'], prepPrompt: `I'm preparing my site for an **Indexation Audit**. Please help me collect the relevant data.\n\n## Project context (fill in)\n- Total pages: [e.g. 100, 10,000, 1M+]\n- Known issues: [e.g. "pages not indexed", "duplicate content warnings", "crawl errors in GSC"]\n\n## Data to gather\n- robots.txt\n- XML sitemap(s)\n- Canonical tags from key page types\n- Google Search Console Index Coverage report data\n- Meta robots tags from key pages\n- HTTP response headers (X-Robots-Tag if used)\n- Any redirect configuration\n\n## Don't forget\n- [ ] Include GSC coverage report numbers (valid, excluded, error)\n- [ ] Note pages you expect to be indexed but aren't\n- [ ] Include any redirect rules or .htaccess\n\nKeep total under 30,000 characters.` },
  { id: 'seo-video', name: 'Video SEO', description: 'Optimizes YouTube presence, video schema markup, video sitemaps, transcripts, and video SERP features.', category: 'SEO', accentClass: 'text-emerald-400 hover:bg-emerald-500/10', buttonClass: 'bg-emerald-800 hover:bg-emerald-700', placeholder: 'Paste your video page HTML, YouTube channel data, video schema, or video sitemap...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['seo-video'], prepPrompt: `I'm preparing my site for a **Video SEO** audit. Please help me collect the relevant data.\n\n## Project context (fill in)\n- Video hosting: [e.g. YouTube, Vimeo, self-hosted, Wistia]\n- Video count: [e.g. 10 videos, 500+ videos]\n- Known concerns: [e.g. "videos not showing in search", "no schema", "no transcripts"]\n\n## Data to gather\n- Video page HTML (showing embeds and schema)\n- Video schema markup (JSON-LD)\n- Video sitemap (if exists)\n- YouTube channel URL and key video URLs\n- Transcript/caption files\n\n## Don't forget\n- [ ] Include the VideoObject schema if present\n- [ ] Note which videos have captions/transcripts\n- [ ] Include YouTube titles, descriptions, and tags for key videos\n\nKeep total under 30,000 characters.` },

  // ─── Infrastructure: 8 New Agents ─────────────────────────────
  { id: 'kubernetes', name: 'Kubernetes', description: 'Audits K8s manifests, resource limits, RBAC, networking policies, health probes, and deployment strategy.', category: 'Infrastructure', accentClass: 'text-cyan-400 hover:bg-cyan-500/10', buttonClass: 'bg-cyan-800 hover:bg-cyan-700', placeholder: 'Paste your Kubernetes manifests, Helm charts, or kubectl output...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['kubernetes'], prepPrompt: `I'm preparing my Kubernetes configuration for a **Kubernetes** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Cluster: [e.g. EKS, GKE, AKS, self-managed]\n- Workloads: [e.g. 5 deployments, 20 services]\n- Known concerns: [e.g. "no resource limits", "running as root", "no network policies"]\n\n## Files to gather\n- Deployment manifests (YAML)\n- Service and Ingress manifests\n- RBAC (Role, ClusterRole, RoleBinding) manifests\n- NetworkPolicy manifests\n- Helm values files\n- Namespace and ResourceQuota definitions\n\n## Don't forget\n- [ ] Include ALL deployment manifests, not just one example\n- [ ] Include any HPA/VPA configurations\n- [ ] Note which namespaces are in use\n\nKeep total under 30,000 characters.` },
  { id: 'terraform', name: 'Terraform / IaC', description: 'Reviews state management, module design, security groups, drift detection, and provider configuration.', category: 'Infrastructure', accentClass: 'text-cyan-400 hover:bg-cyan-500/10', buttonClass: 'bg-cyan-800 hover:bg-cyan-700', placeholder: 'Paste your Terraform files (.tf), module definitions, or tfplan output...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['terraform'], prepPrompt: `I'm preparing my infrastructure code for a **Terraform** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Cloud provider: [e.g. AWS, GCP, Azure, multi-cloud]\n- Terraform version: [e.g. 1.5, 1.7]\n- Known concerns: [e.g. "no state locking", "hardcoded values", "security groups too open"]\n\n## Files to gather\n- Main .tf files (main.tf, variables.tf, outputs.tf)\n- Module definitions\n- Backend configuration\n- Provider configuration\n- terraform.tfvars or .auto.tfvars (NO SECRETS)\n- Any .tfplan output\n\n## Don't forget\n- [ ] NEVER include actual secret values\n- [ ] Include the backend configuration for state\n- [ ] Show module structure and versioning\n\nKeep total under 30,000 characters.` },
  { id: 'serverless', name: 'Serverless', description: 'Analyzes cold starts, timeout configuration, concurrency management, cost optimization, and event patterns.', category: 'Infrastructure', accentClass: 'text-cyan-400 hover:bg-cyan-500/10', buttonClass: 'bg-cyan-800 hover:bg-cyan-700', placeholder: 'Paste your serverless.yml, SAM template, function code, or CloudFormation config...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['serverless'], prepPrompt: `I'm preparing my serverless architecture for a **Serverless** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Platform: [e.g. AWS Lambda, Azure Functions, Google Cloud Functions]\n- Framework: [e.g. Serverless Framework, SAM, CDK, raw CloudFormation]\n- Function count: [e.g. 5 functions, 50 functions]\n- Known concerns: [e.g. "cold starts", "high costs", "timeout issues"]\n\n## Files to gather\n- serverless.yml / template.yaml / CDK stack\n- Function handler code\n- IAM role/policy definitions\n- Event source configurations\n- Environment variable setup (NO SECRETS)\n\n## Don't forget\n- [ ] Include memory and timeout settings\n- [ ] Note any VPC configuration\n- [ ] Include provisioned concurrency settings if any\n\nKeep total under 30,000 characters.` },
  { id: 'message-queues', name: 'Message Queues', description: 'Reviews dead letter queues, message ordering, idempotency patterns, backpressure, and error recovery.', category: 'Infrastructure', accentClass: 'text-cyan-400 hover:bg-cyan-500/10', buttonClass: 'bg-cyan-800 hover:bg-cyan-700', placeholder: 'Paste your queue configuration, consumer/producer code, or messaging infrastructure...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['message-queues'], prepPrompt: `I'm preparing my messaging system for a **Message Queue** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Queue technology: [e.g. RabbitMQ, Kafka, SQS, Redis Streams]\n- Message volume: [e.g. 100/min, 10K/sec]\n- Known concerns: [e.g. "no DLQ", "duplicate processing", "message loss"]\n\n## Files to gather\n- Queue/topic configuration\n- Consumer code (message handlers)\n- Producer code (message publishers)\n- Dead letter queue configuration\n- Retry and error handling logic\n- Monitoring/alerting configuration\n\n## Don't forget\n- [ ] Include error handling in consumers\n- [ ] Show how idempotency is handled\n- [ ] Include DLQ configuration and reprocessing logic\n\nKeep total under 30,000 characters.` },
  { id: 'cdn-config', name: 'CDN Configuration', description: 'Audits cache rules, purge strategy, edge functions, HTTP headers, and origin configuration.', category: 'Infrastructure', accentClass: 'text-cyan-400 hover:bg-cyan-500/10', buttonClass: 'bg-cyan-800 hover:bg-cyan-700', placeholder: 'Paste your CDN configuration, cache rules, edge functions, or HTTP header config...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['cdn-config'], prepPrompt: `I'm preparing my CDN setup for a **CDN Configuration** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- CDN provider: [e.g. Cloudflare, CloudFront, Fastly, Vercel Edge]\n- Content types: [e.g. static site, dynamic app, mixed]\n- Known concerns: [e.g. "low cache hit ratio", "stale content issues", "no edge functions"]\n\n## Files to gather\n- CDN configuration (cache rules, page rules)\n- Cache-Control header configuration\n- Edge function/worker code\n- Origin configuration\n- Purge/invalidation setup\n- HTTP response headers for key routes\n\n## Don't forget\n- [ ] Include Cache-Control headers for different content types\n- [ ] Show any cache busting strategy\n- [ ] Include edge function code if applicable\n\nKeep total under 30,000 characters.` },
  { id: 'load-balancing', name: 'Load Balancing', description: 'Reviews health checks, session affinity, failover strategy, auto-scaling policies, and traffic distribution.', category: 'Infrastructure', accentClass: 'text-cyan-400 hover:bg-cyan-500/10', buttonClass: 'bg-cyan-800 hover:bg-cyan-700', placeholder: 'Paste your load balancer config, health checks, scaling policies, or target group setup...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['load-balancing'], prepPrompt: `I'm preparing my load balancing setup for an audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- LB type: [e.g. ALB, NLB, nginx, HAProxy, Cloud Load Balancer]\n- Architecture: [e.g. single region, multi-AZ, multi-region]\n- Known concerns: [e.g. "no health checks", "sticky sessions causing uneven load", "no auto-scaling"]\n\n## Files to gather\n- Load balancer configuration\n- Health check definitions\n- Target group/backend configuration\n- Auto-scaling policies\n- SSL/TLS configuration\n- DNS/failover configuration\n\n## Don't forget\n- [ ] Include health check endpoints and thresholds\n- [ ] Show auto-scaling policies and metrics\n- [ ] Note any session affinity requirements\n\nKeep total under 30,000 characters.` },
  { id: 'backup-recovery', name: 'Backup & Recovery', description: 'Evaluates RPO/RTO coverage, backup verification, disaster recovery plans, and data replication strategy.', category: 'Infrastructure', accentClass: 'text-cyan-400 hover:bg-cyan-500/10', buttonClass: 'bg-cyan-800 hover:bg-cyan-700', placeholder: 'Paste your backup configuration, DR plan, replication setup, or recovery procedures...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['backup-recovery'], prepPrompt: `I'm preparing my backup strategy for a **Backup & Recovery** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Data stores: [e.g. PostgreSQL, MongoDB, S3, Redis]\n- Business criticality: [e.g. "financial data, zero tolerance for loss", "content site, some loss OK"]\n- Known concerns: [e.g. "never tested restores", "no DR plan", "backups in same region"]\n\n## Data to gather\n- Backup configuration for each data store\n- Backup schedule and retention policies\n- DR plan documentation (if exists)\n- Replication configuration\n- Last restore test results\n- Monitoring/alerting for backup failures\n\n## Don't forget\n- [ ] List ALL data stores and whether each is backed up\n- [ ] Note the last time a restore was tested\n- [ ] Include RPO/RTO requirements if documented\n\nKeep total under 30,000 characters.` },
  { id: 'monitoring-alerting', name: 'Monitoring & Alerting', description: 'Reviews SLI/SLO definitions, alert design, alert fatigue, dashboard quality, and runbook coverage.', category: 'Infrastructure', accentClass: 'text-cyan-400 hover:bg-cyan-500/10', buttonClass: 'bg-cyan-800 hover:bg-cyan-700', placeholder: 'Paste your alert rules, SLO definitions, dashboard configs, or monitoring setup...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['monitoring-alerting'], prepPrompt: `I'm preparing my monitoring setup for a **Monitoring & Alerting** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Monitoring stack: [e.g. Datadog, Prometheus/Grafana, CloudWatch, New Relic]\n- Services monitored: [e.g. 5 microservices, monolith + database]\n- Known concerns: [e.g. "too many alerts", "no SLOs defined", "missing runbooks"]\n\n## Files to gather\n- Alert rule definitions\n- SLI/SLO definitions (if they exist)\n- Dashboard configurations or screenshots\n- Runbooks for critical alerts\n- On-call rotation setup\n- Notification channel configuration\n\n## Don't forget\n- [ ] Include the number of alerts firing per day/week\n- [ ] Note any alerts that are frequently silenced\n- [ ] Include runbooks (or note their absence)\n\nKeep total under 30,000 characters.` },

  // ─── Code Quality: 7 New Agents ───────────────────────────────
  { id: 'naming-conventions', name: 'Naming Conventions', description: 'Audits variable, function, file, and type naming for clarity, consistency, and convention adherence.', category: 'Code Quality', accentClass: 'text-blue-400 hover:bg-blue-500/10', buttonClass: 'bg-blue-800 hover:bg-blue-700', placeholder: 'Paste your source code — the more files, the better we can assess naming consistency...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['naming-conventions'], prepPrompt: `I'm preparing code for a **Naming Conventions** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Language / framework: [e.g. TypeScript + React, Python + Django, Go]\n- Team conventions: [e.g. "we follow Airbnb style guide", "no formal conventions"]\n- Known concerns: [e.g. "inconsistent naming across files", "abbreviations everywhere"]\n\n## Files to gather\n- Core source files from the module being reviewed\n- Type definitions and interfaces\n- Utility/helper files\n- Test files (to check test naming)\n- Configuration files\n\n## Don't forget\n- [ ] Include files from multiple developers if possible\n- [ ] Include both old and new files to check consistency over time\n- [ ] Note any existing naming conventions documentation\n\nKeep total under 30,000 characters.` },
  { id: 'code-comments', name: 'Code Comments Audit', description: 'Reviews JSDoc coverage, inline comment quality, TODO debt, and self-documenting code practices.', category: 'Code Quality', accentClass: 'text-blue-400 hover:bg-blue-500/10', buttonClass: 'bg-blue-800 hover:bg-blue-700', placeholder: 'Paste your source code with its existing comments, JSDoc, and TODOs...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['code-comments'], prepPrompt: `I'm preparing code for a **Code Comments** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Language / framework: [e.g. TypeScript, Python, Java]\n- Documentation policy: [e.g. "JSDoc required for public APIs", "no policy", "minimal comments"]\n- Known concerns: [e.g. "stale comments", "too many TODOs", "no JSDoc at all"]\n\n## Files to gather\n- Core source files with their existing comments\n- Public API files (most critical for documentation)\n- Files with complex business logic\n- Any files you know have TODO/FIXME markers\n\n## Don't forget\n- [ ] Include the comments as-is — don't clean them up first\n- [ ] Include files with complex regex or algorithms\n- [ ] Note any documentation generation tools in use\n\nKeep total under 30,000 characters.` },
  { id: 'solid-principles', name: 'SOLID Principles', description: 'Identifies violations of SRP, OCP, LSP, ISP, and DIP with refactoring guidance for each principle.', category: 'Code Quality', accentClass: 'text-blue-400 hover:bg-blue-500/10', buttonClass: 'bg-blue-800 hover:bg-blue-700', placeholder: 'Paste your classes, modules, interfaces, and their dependencies...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['solid-principles'], prepPrompt: `I'm preparing code for a **SOLID Principles** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Language / paradigm: [e.g. TypeScript OOP, Java, Python with classes]\n- Architecture: [e.g. layered, hexagonal, MVC, no clear architecture]\n- Known concerns: [e.g. "god classes", "tight coupling", "hard to test"]\n\n## Files to gather\n- Core classes/modules and their dependencies\n- Interface/type definitions\n- Dependency injection setup (if any)\n- Service classes and their consumers\n- Any base classes or abstract classes\n\n## Don't forget\n- [ ] Include import statements — they show dependency direction\n- [ ] Include the classes that consume/use other classes\n- [ ] Note any classes that are frequently modified for different reasons\n\nKeep total under 30,000 characters.` },
  { id: 'refactoring', name: 'Refactoring Opportunities', description: 'Finds code smells, duplication, complexity hotspots, and recommends safe refactoring techniques.', category: 'Code Quality', accentClass: 'text-blue-400 hover:bg-blue-500/10', buttonClass: 'bg-blue-800 hover:bg-blue-700', placeholder: 'Paste the code you suspect needs refactoring — include related files for context...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['refactoring'], prepPrompt: `I'm preparing code for a **Refactoring** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Language / framework: [e.g. TypeScript + React, Python + FastAPI]\n- Codebase age: [e.g. 6 months, 3 years]\n- Known concerns: [e.g. "functions too long", "copy-pasted code", "complex conditionals"]\n\n## Files to gather\n- Files you suspect have code smells\n- The largest files in the codebase\n- Files with the most git churn (\`git log --format=format: --name-only | sort | uniq -c | sort -rn | head -20\`)\n- Test files (to assess refactoring safety)\n\n## Don't forget\n- [ ] Include test files so we can assess refactoring safety\n- [ ] Include files that depend on the code being refactored\n- [ ] Note any files that developers avoid touching\n\nKeep total under 30,000 characters.` },
  { id: 'api-contracts', name: 'API Contracts', description: 'Reviews type safety at API boundaries, versioning strategy, backwards compatibility, and schema validation.', category: 'Code Quality', accentClass: 'text-blue-400 hover:bg-blue-500/10', buttonClass: 'bg-blue-800 hover:bg-blue-700', placeholder: 'Paste your API route handlers, type definitions, validation schemas, and client code...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['api-contracts'], prepPrompt: `I'm preparing my API for an **API Contracts** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- API style: [e.g. REST, GraphQL, tRPC, gRPC]\n- Framework: [e.g. Next.js API routes, Express, FastAPI]\n- Consumers: [e.g. internal frontend, mobile app, third-party developers]\n- Known concerns: [e.g. "no versioning", "types don't match runtime", "breaking changes"]\n\n## Files to gather\n- API route handlers / controllers\n- Request/response type definitions\n- Validation schemas (Zod, Joi, JSON Schema)\n- OpenAPI spec (if exists)\n- Client-side API consumption code\n- Any API versioning configuration\n\n## Don't forget\n- [ ] Include BOTH the server types AND client types\n- [ ] Include validation schemas alongside TypeScript types\n- [ ] Note any recent API changes that broke consumers\n\nKeep total under 30,000 characters.` },
  { id: 'async-patterns', name: 'Async Patterns', description: 'Identifies race conditions, unhandled rejections, missing cancellation, and async anti-patterns.', category: 'Code Quality', accentClass: 'text-blue-400 hover:bg-blue-500/10', buttonClass: 'bg-blue-800 hover:bg-blue-700', placeholder: 'Paste your async code — API calls, database queries, event handlers, concurrent operations...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['async-patterns'], prepPrompt: `I'm preparing code for an **Async Patterns** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Language / runtime: [e.g. TypeScript + Node.js, Python asyncio, Go goroutines]\n- Async patterns used: [e.g. "async/await", "Promises", "callbacks", "RxJS"]\n- Known concerns: [e.g. "race conditions", "unhandled rejections", "memory leaks from timers"]\n\n## Files to gather\n- API call/fetch logic\n- Database query code\n- Event handlers and listeners\n- Timer/interval code\n- Any concurrent operation management\n- React hooks with async operations\n\n## Don't forget\n- [ ] Include error handling around async operations\n- [ ] Include cleanup/teardown code (useEffect returns, finally blocks)\n- [ ] Note any known race conditions or timing issues\n\nKeep total under 30,000 characters.` },
  { id: 'testing-strategy', name: 'Testing Strategy', description: 'Evaluates test pyramid balance, coverage gaps, mocking strategy, test quality, and E2E coverage.', category: 'Code Quality', accentClass: 'text-blue-400 hover:bg-blue-500/10', buttonClass: 'bg-blue-800 hover:bg-blue-700', placeholder: 'Paste your test files alongside the source code they test...', kind: 'builtin' as const, systemPrompt: SYSTEM_PROMPTS['testing-strategy'], prepPrompt: `I'm preparing code for a **Testing Strategy** audit. Please help me collect the relevant files.\n\n## Project context (fill in)\n- Test framework: [e.g. Jest, Vitest, pytest, Go testing]\n- Current coverage: [e.g. "70% unit", "no E2E", "unknown"]\n- Known concerns: [e.g. "flaky tests", "too many mocks", "no integration tests"]\n\n## Files to gather\n- Test files (*.test.ts, *.spec.ts, *_test.go, etc.)\n- The source files those tests cover\n- Test utilities, factories, fixtures\n- Test configuration (jest.config, vitest.config)\n- CI test commands from package.json or CI config\n- Coverage report output (if available)\n\n## Don't forget\n- [ ] Include BOTH test files AND the source code they test\n- [ ] Include any shared test utilities or mock factories\n- [ ] Note any tests that are skipped or frequently fail\n\nKeep total under 30,000 characters.` },
];

export function getAgent(id: string): AgentConfig | undefined {
  return agents.find((a) => a.id === id);
}
