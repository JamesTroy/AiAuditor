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
    buttonClass: 'bg-green-700 hover:bg-green-600',
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
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
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
    buttonClass: 'bg-teal-700 hover:bg-teal-600',
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
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
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
    buttonClass: 'bg-teal-700 hover:bg-teal-600',
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
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
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
    buttonClass: 'bg-teal-700 hover:bg-teal-600',
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
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
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
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
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
    id: 'seo-technical',
    name: 'SEO Technical',
    description: 'Reviews meta tags, structured data, canonical URLs, sitemap, and crawlability.',
    category: 'Performance',
    accentClass: 'text-green-400 hover:bg-green-500/10',
    buttonClass: 'bg-green-700 hover:bg-green-600',
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
    buttonClass: 'bg-teal-700 hover:bg-teal-600',
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
    buttonClass: 'bg-green-700 hover:bg-green-600',
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
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
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
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
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
    buttonClass: 'bg-teal-700 hover:bg-teal-600',
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
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
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
];

export function getAgent(id: string): AgentConfig | undefined {
  return agents.find((a) => a.id === id);
}
