// Registry metadata and startup validation.
// System prompts live in ./prompts.ts — separated to keep this file navigable
// and allow prompt edits without touching agent metadata.
import { AgentConfig } from '../types';
import { SYSTEM_PROMPTS } from './prompts';
import { VALID_AGENT_TYPES } from '@/lib/schemas/auditRequest';

type BuiltinAgentInput = Omit<AgentConfig, 'kind'>;
function builtin(config: BuiltinAgentInput): AgentConfig {
  return { ...config, kind: 'builtin' };
}

export const agents: AgentConfig[] = [
  builtin({
    id: 'code-quality',
    name: 'Code Quality',
    description: 'Detects bugs, anti-patterns, and style issues across any language.',
    category: 'Code Quality',
    accentClass: 'text-blue-400 hover:bg-blue-500/10',
    buttonClass: 'bg-blue-700 hover:bg-blue-600',
    placeholder: 'Paste your code here...',
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
  }),
  builtin({
    id: 'security',
    name: 'Security',
    description: 'Identifies vulnerabilities, attack surfaces, and insecure patterns — the issues that cause breaches.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-700 hover:bg-red-600',
    placeholder: 'Paste your code or describe your system architecture...',
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
  }),
  builtin({
    id: 'seo-performance',
    name: 'SEO / Performance',
    description: 'Analyzes HTML and page structure for search rankings and load speed.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your page HTML or describe your page structure and content...',
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
  }),
  builtin({
    id: 'accessibility',
    name: 'Accessibility',
    description: 'Checks HTML against WCAG (accessibility standards) 2.2 AA criteria and ARIA best practices — the gaps that exclude users and fail compliance.',
    category: 'Code Quality',
    accentClass: 'text-green-400 hover:bg-green-500/10',
    buttonClass: 'bg-green-800 hover:bg-green-700',
    placeholder: 'Paste your HTML here...',
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
  }),
  builtin({
    id: 'sql',
    name: 'SQL Auditor',
    description: 'Finds injection risks, N+1 queries (database calls that multiply with data size), missing indexes, and transaction issues.',
    category: 'Security & Privacy',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste your SQL queries, schema, or ORM code here...',
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
  }),
  builtin({
    id: 'api-design',
    name: 'API Design',
    description: 'Reviews REST and GraphQL APIs for conventions, versioning, and error contracts.',
    category: 'Infrastructure',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-800 hover:bg-cyan-700',
    placeholder: 'Paste your API routes, OpenAPI spec, or GraphQL schema here...',
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
  }),
  builtin({
    id: 'devops',
    name: 'Docker / DevOps',
    description: 'Audits Dockerfiles, CI/CD (automated build and deploy pipelines) pipelines, and infrastructure config for security and efficiency.',
    category: 'Infrastructure',
    accentClass: 'text-slate-300 hover:bg-slate-500/10',
    buttonClass: 'bg-slate-700 hover:bg-slate-600',
    placeholder: 'Paste your Dockerfile, docker-compose.yml, CI config (.github/workflows, .gitlab-ci.yml), or IaC here...',
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
  }),
  builtin({
    id: 'performance',
    name: 'Performance Profiler',
    description: 'Identifies algorithmic complexity, memory leaks, and render performance bottlenecks — the issues that drive users away.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your code — frontend, backend, or algorithm...',
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
  }),
  builtin({
    id: 'privacy',
    name: 'Privacy / GDPR',
    description: 'Checks code and data flows for PII exposure, consent gaps, and GDPR/CCPA compliance.',
    category: 'Security & Privacy',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your code, data models, API routes, or privacy policy for analysis...',
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
  }),
  builtin({
    id: 'test-quality',
    name: 'Test Quality',
    description: 'Reviews test suites for coverage gaps, flaky patterns, and assertion quality.',
    category: 'Code Quality',
    accentClass: 'text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-800 hover:bg-teal-700',
    placeholder: 'Paste your test files, test suite, or both test and implementation code...',
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
  }),
  builtin({
    id: 'architecture',
    name: 'Architecture Review',
    description: 'Evaluates system design for coupling, cohesion, dependency direction, and scalability.',
    category: 'Code Quality',
    accentClass: 'text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste your system description, architecture diagram description, module structure, or key source files...',
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
  }),
  builtin({
    id: 'documentation',
    name: 'Documentation Quality',
    description: 'Audits inline comments, JSDoc/TSDoc, README completeness, and API reference quality.',
    category: 'Code Quality',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your source files, README, JSDoc comments, or API reference...',
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
  }),
  builtin({
    id: 'dependency-security',
    name: 'Dependency Security',
    description: 'Scans for CVEs, outdated packages, license risks, and supply-chain vulnerabilities.',
    category: 'Security & Privacy',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your package.json, package-lock.json, requirements.txt, go.mod, or similar...',
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
  }),
  builtin({
    id: 'auth-review',
    name: 'Auth & Session Review',
    description: 'Deep-dives on authentication flows, JWT (login tokens)/session handling, OAuth, and credential security.',
    category: 'Security & Privacy',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your authentication code, JWT logic, session handling, or OAuth implementation...',
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
  }),
  builtin({
    id: 'frontend-performance',
    name: 'Frontend Performance',
    description: 'Analyzes bundle size, Core Web Vitals risk, rendering bottlenecks, and resource loading.',
    category: 'Performance',
    accentClass: 'text-lime-400 hover:bg-lime-500/10',
    buttonClass: 'bg-lime-800 hover:bg-lime-700',
    placeholder: 'Paste your component code, build config, HTML, or Lighthouse report...',
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
  }),
  builtin({
    id: 'caching',
    name: 'Caching Strategy',
    description: 'Reviews HTTP cache headers, CDN config, Redis patterns, and cache invalidation logic.',
    category: 'Performance',
    accentClass: 'text-sky-400 hover:bg-sky-500/10',
    buttonClass: 'bg-sky-700 hover:bg-sky-600',
    placeholder: 'Paste your API routes, cache configuration, Redis code, or CDN settings...',
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
  }),
  builtin({
    id: 'memory-profiler',
    name: 'Memory & Leak Detection',
    description: 'Identifies memory leaks, unbounded caches, listener accumulation, and heap growth patterns.',
    category: 'Performance',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-800 hover:bg-cyan-700',
    placeholder: 'Paste your component code, Node.js modules, heap snapshot summary, or profiler output...',
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
  }),
  builtin({
    id: 'cloud-infra',
    name: 'Cloud Infrastructure',
    description: 'Reviews IAM (cloud identity and access management) policies, network exposure, storage security, and resilience for AWS/GCP/Azure.',
    category: 'Infrastructure',
    accentClass: 'text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-800 hover:bg-teal-700',
    placeholder: 'Paste your Terraform, CDK, CloudFormation, or cloud config files...',
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
  }),
  builtin({
    id: 'observability',
    name: 'Observability & Monitoring',
    description: 'Audits logging structure, metrics coverage, alerting rules, tracing, and incident readiness.',
    category: 'Infrastructure',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your logging code, Prometheus rules, alert configs, or OpenTelemetry setup...',
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
  }),
  builtin({
    id: 'database-infra',
    name: 'Database Infrastructure',
    description: 'Reviews schema design, indexing, connection pooling, migrations, backup, and replication.',
    category: 'Infrastructure',
    accentClass: 'text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste your schema SQL, migration files, ORM config, or database infrastructure code...',
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
  }),
  builtin({
    id: 'ux-review',
    name: 'UX Review',
    description: 'Evaluates user flows, interaction patterns, cognitive load, and usability heuristics.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your component HTML/JSX, describe a user flow, or paste a screen description...',
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
  }),
  builtin({
    id: 'design-system',
    name: 'Design System',
    description: 'Audits design tokens, component APIs, variant coverage, and documentation completeness.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your design tokens, component code, Storybook stories, or token JSON...',
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
  }),
  builtin({
    id: 'responsive-design',
    name: 'Responsive Design',
    description: 'Reviews breakpoints, fluid layouts, touch targets, and cross-device behaviour.',
    category: 'Design',
    accentClass: 'text-sky-400 hover:bg-sky-500/10',
    buttonClass: 'bg-sky-700 hover:bg-sky-600',
    placeholder: 'Paste your CSS, Tailwind classes, or component code for responsive analysis...',
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
  }),
  builtin({
    id: 'color-typography',
    name: 'Color & Typography',
    description: 'Checks contrast ratios, type scales, palette harmony, and WCAG (accessibility standards) color compliance.',
    category: 'Design',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your color tokens, CSS variables, Tailwind config, or typography definitions...',
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
  }),
  builtin({
    id: 'motion-interaction',
    name: 'Motion & Interaction',
    description: 'Reviews animations, transitions, micro-interactions, and reduced-motion accessibility.',
    category: 'Design',
    accentClass: 'text-lime-400 hover:bg-lime-500/10',
    buttonClass: 'bg-lime-800 hover:bg-lime-700',
    placeholder: 'Paste your CSS animations, Framer Motion code, or JavaScript animation logic...',
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
  }),
  builtin({
    id: 'data-security',
    name: 'Data Security',
    description: 'Audits encryption, key management, secrets handling, DLP, and secure data lifecycle.',
    category: 'Security & Privacy',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your database config, encryption code, secrets management setup, or data flow architecture...',
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
  }),
  builtin({
    id: 'error-handling',
    name: 'Error Handling',
    description: 'Finds swallowed errors, missing catch blocks, unhandled rejections, and poor recovery patterns.',
    category: 'Code Quality',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste your code with try/catch blocks, error boundaries, or async error handling...',
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
  }),
  builtin({
    id: 'typescript-strictness',
    name: 'TypeScript Strictness',
    description: 'Finds unsafe any types, missing strict flags, weak generics, and type assertion risks.',
    category: 'Code Quality',
    accentClass: 'text-blue-400 hover:bg-blue-500/10',
    buttonClass: 'bg-blue-700 hover:bg-blue-600',
    placeholder: 'Paste your TypeScript code, tsconfig.json, or type definitions...',
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
  }),
  builtin({
    id: 'react-patterns',
    name: 'React Patterns',
    description: 'Reviews hooks, component design, state management, re-renders, and Server Component boundaries.',
    category: 'Code Quality',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-800 hover:bg-cyan-700',
    placeholder: 'Paste your React components, hooks, or state management code...',
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
  }),
  builtin({
    id: 'i18n',
    name: 'Internationalization',
    description: 'Finds hardcoded strings, locale-dependent formatting, RTL issues, and i18n architecture gaps.',
    category: 'Design',
    accentClass: 'text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste your UI components, translation files, or locale configuration...',
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
  }),
  builtin({
    id: 'rate-limiting',
    name: 'Rate Limiting',
    description: 'Audits API throttling, abuse prevention, DDoS surface, and cost-based endpoint protection.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-700 hover:bg-red-600',
    placeholder: 'Paste your API routes, middleware, rate limiting config, or WAF rules...',
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
  }),
  builtin({
    id: 'logging',
    name: 'Logging & Monitoring',
    description: 'Reviews structured logging, log levels, PII exposure in logs, and audit trail completeness.',
    category: 'Infrastructure',
    accentClass: 'text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-800 hover:bg-teal-700',
    placeholder: 'Paste your logging configuration, error handlers, or code with console/logger calls...',
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
  }),
  builtin({
    id: 'database-migrations',
    name: 'Database Migrations',
    description: 'Reviews migration safety, lock risks, rollback plans, and zero-downtime schema changes.',
    category: 'Infrastructure',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your migration files, schema definitions, or Drizzle/Prisma migration output...',
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
  }),
  builtin({
    id: 'concurrency',
    name: 'Concurrency & Async',
    description: 'Finds race conditions, deadlocks, resource leaks, and unsafe async patterns.',
    category: 'Performance',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your async code, database transactions, queue consumers, or connection pool setup...',
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
  }),
  builtin({
    id: 'ci-cd',
    name: 'Git & CI/CD',
    description: 'Audits pipeline security, build performance, deployment strategy, and branch protection.',
    category: 'Infrastructure',
    accentClass: 'text-slate-300 hover:bg-slate-500/10',
    buttonClass: 'bg-slate-700 hover:bg-slate-600',
    placeholder: 'Paste your GitHub Actions workflows, CI config, Dockerfile, or deployment scripts...',
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
  }),
  builtin({
    id: 'regex-review',
    name: 'Regex Review',
    description: 'Detects ReDoS (regex patterns that freeze on large input) vulnerabilities, incorrect matches, and unreadable patterns.',
    category: 'Code Quality',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste code containing regular expressions...',
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
  }),
  builtin({
    id: 'monorepo',
    name: 'Monorepo Structure',
    description: 'Reviews package boundaries, dependency graphs, build config, and shared code organization.',
    category: 'Code Quality',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your package.json files, workspace config, turborepo/nx config, or project structure...',
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
  }),
  builtin({
    id: 'graphql',
    name: 'GraphQL',
    description: 'Audits schema design, resolver performance, N+1 queries (database calls that multiply with data size), field authorization, and depth limiting.',
    category: 'Infrastructure',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your GraphQL schema, resolvers, or query code...',
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
  }),
  builtin({
    id: 'websocket',
    name: 'WebSocket & Realtime',
    description: 'Reviews connection lifecycle, reconnection, auth on persistent connections, and backpressure.',
    category: 'Infrastructure',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your WebSocket server/client code, Socket.IO config, or SSE implementation...',
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
  }),
  builtin({
    id: 'container-security',
    name: 'Container Security',
    description: 'Audits Dockerfiles for root users, image provenance, secret leaks, and runtime hardening.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-700 hover:bg-red-600',
    placeholder: 'Paste your Dockerfile, docker-compose.yml, or Kubernetes manifests...',
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
  }),
  builtin({
    id: 'cors-headers',
    name: 'CORS & Headers',
    description: 'Audits CORS (cross-origin request rules) policy, security headers, cookie settings, and origin-based access control.',
    category: 'Security & Privacy',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your CORS configuration, middleware, security headers, or server config...',
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
  }),
  builtin({
    id: 'api-security',
    name: 'API Security',
    description: 'Audits OWASP API Top 10 (top API security risks), endpoint hardening, BOLA/BFLA (unauthorized access to other users\' data), input validation, and API abuse vectors.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-700 hover:bg-red-600',
    placeholder: 'Paste your API route handlers, middleware, OpenAPI spec, or endpoint definitions...',
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
  }),
  builtin({
    id: 'secrets-scanner',
    name: 'Secrets Scanner',
    description: 'Scans for leaked API keys, tokens, credentials, .env contents, and hardcoded secrets.',
    category: 'Security & Privacy',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-800 hover:bg-rose-700',
    placeholder: 'Paste your source code, configuration files, or .env.example for secrets scanning...',
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
  }),
  builtin({
    id: 'xss-prevention',
    name: 'XSS Prevention',
    description: 'Analyzes DOM XSS (cross-site scripting — injecting malicious code into pages), reflected/stored XSS, mutation XSS, CSP (Content Security Policy — browser attack protection), and output encoding.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-800 hover:bg-red-700',
    placeholder: 'Paste your frontend code, templates, rendering logic, or CSP configuration...',
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
  }),
  builtin({
    id: 'csrf-ssrf',
    name: 'CSRF & SSRF',
    description: 'Audits request forgery vectors, SameSite cookies, CSRF (form hijacking attacks) tokens, SSRF (server-side request forgery) to internal services.',
    category: 'Security & Privacy',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your form handlers, cookie config, server-side HTTP requests, or URL fetching logic...',
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
  }),
  builtin({
    id: 'cryptography',
    name: 'Cryptography Audit',
    description: 'Audits encryption algorithms, key sizes, TLS config, password hashing, and RNG (random number generation) usage.',
    category: 'Security & Privacy',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste your encryption code, TLS configuration, password hashing, or key management setup...',
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
  }),
  builtin({
    id: 'cloud-iam',
    name: 'Cloud IAM',
    description: 'Audits AWS/GCP/Azure IAM (cloud identity and access management) permissions, least privilege, role sprawl, and trust policies.',
    category: 'Security & Privacy',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your IAM policies, Terraform IAM resources, role definitions, or cloud config...',
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
  }),
  builtin({
    id: 'secure-sdlc',
    name: 'Secure SDLC',
    description: 'Audits CI/CD (automated build and deploy pipelines) security, code signing, artifact integrity, SLSA compliance, and supply chain.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-800 hover:bg-red-700',
    placeholder: 'Paste your CI/CD workflows, build scripts, deployment config, or branch protection settings...',
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
  }),
  builtin({
    id: 'threat-modeling',
    name: 'Threat Modeling',
    description: 'Performs STRIDE (a checklist for thinking through threats) analysis, attack trees, trust boundary mapping, and MITRE ATT&CK (attacker technique catalogue) alignment.',
    category: 'Security & Privacy',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-800 hover:bg-rose-700',
    placeholder: 'Paste your architecture description, system design, data flow, or infrastructure code...',
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
  }),
  builtin({
    id: 'zero-trust',
    name: 'Zero Trust Audit',
    description: 'Audits network segmentation, mTLS, identity-based access, and implicit trust assumptions.',
    category: 'Security & Privacy',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
    placeholder: 'Paste your network config, service mesh setup, access policies, or infrastructure code...',
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
  }),
  builtin({
    id: 'incident-response',
    name: 'Incident Response',
    description: 'Audits IR playbooks, logging coverage, detection gaps, and forensic readiness.',
    category: 'Security & Privacy',
    accentClass: 'text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-700 hover:bg-red-600',
    placeholder: 'Paste your logging config, alerting rules, IR playbooks, or monitoring setup...',
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
  }),
  builtin({
    id: 'compliance-audit',
    name: 'Compliance Audit',
    description: 'Maps controls to SOC 2, ISO 27001, PCI DSS, HIPAA, and identifies compliance gaps.',
    category: 'Security & Privacy',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your security controls, policies, infrastructure config, or access control setup...',
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
  }),
  builtin({
    id: 'seo-technical',
    name: 'SEO Technical',
    description: 'Reviews meta tags, structured data, canonical URLs, sitemap, and crawlability.',
    category: 'Performance',
    accentClass: 'text-green-400 hover:bg-green-500/10',
    buttonClass: 'bg-green-800 hover:bg-green-700',
    placeholder: 'Paste your page components, layout files, head configuration, or robots.txt...',
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
  }),
  builtin({
    id: 'bundle-size',
    name: 'Bundle Size',
    description: 'Finds heavy dependencies, missing code splitting, tree-shaking failures, and optimization gaps.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your build output, package.json, import statements, or bundle analysis report...',
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
  }),
  builtin({
    id: 'forms-validation',
    name: 'Forms & Validation',
    description: 'Reviews form UX, input validation, error messaging, accessibility, and mobile usability.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your form components, validation logic, or error handling UI...',
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
  }),
  builtin({
    id: 'dark-mode',
    name: 'Dark Mode',
    description: 'Audits color contrast in both themes, flash prevention, token usage, and system preference detection.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your theme provider, CSS variables, Tailwind config, or component styles...',
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
  }),
  builtin({
    id: 'email-templates',
    name: 'Email Templates',
    description: 'Reviews email rendering across clients, inline CSS, accessibility, and deliverability.',
    category: 'Design',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your email HTML templates, React Email components, or email sending config...',
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
  }),
  builtin({
    id: 'env-config',
    name: 'Environment Config',
    description: 'Audits env var hygiene, config validation, .env management, and 12-factor compliance.',
    category: 'Infrastructure',
    accentClass: 'text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-800 hover:bg-teal-700',
    placeholder: 'Paste your .env.example, config validation code, or environment setup...',
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
  }),
  builtin({
    id: 'openapi',
    name: 'OpenAPI Spec',
    description: 'Reviews spec completeness, schema accuracy, error documentation, and API consumer usability.',
    category: 'Infrastructure',
    accentClass: 'text-green-400 hover:bg-green-500/10',
    buttonClass: 'bg-green-800 hover:bg-green-700',
    placeholder: 'Paste your OpenAPI/Swagger spec (YAML or JSON), or your API route handlers...',
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
  }),
  builtin({
    id: 'state-machines',
    name: 'State Machines',
    description: 'Finds impossible states, missing transitions, deadlocks, and implicit state logic.',
    category: 'Code Quality',
    accentClass: 'text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste components or modules with complex state (multi-step forms, payment flows, status tracking)...',
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
  }),
  builtin({
    id: 'pagination',
    name: 'Pagination & Filtering',
    description: 'Reviews cursor vs offset strategy, query performance, filter injection, and deep pagination safety.',
    category: 'Performance',
    accentClass: 'text-sky-400 hover:bg-sky-500/10',
    buttonClass: 'bg-sky-700 hover:bg-sky-600',
    placeholder: 'Paste your paginated API endpoints, database queries, or list components...',
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
  }),

  // ─── SEO Foundations ─────────────────────────────────────────────
  builtin({
    id: 'seo-basics',
    name: 'SEO Basics',
    description: 'Audits fundamental on-page SEO: title tags, meta descriptions, headings, URL structure, and internal linking.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your page HTML, layout components, or metadata configuration...',
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
  }),
  builtin({
    id: 'seo-search-engines',
    name: 'Search Engine Understanding',
    description: 'Analyzes how search engines crawl, render, and index your site — crawlability, JS rendering, and crawl budget.',
    category: 'SEO',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your robots.txt, sitemap, layout files, and routing configuration...',
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
  }),
  builtin({
    id: 'seo-ranking-factors',
    name: 'Ranking Factors',
    description: 'Evaluates E-E-A-T signals, content quality, Core Web Vitals readiness, and on-page ranking signals.',
    category: 'SEO',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-700 hover:bg-amber-600',
    placeholder: 'Paste your page content, layout, about/author pages, and structured data...',
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
  }),
  builtin({
    id: 'seo-quick-wins',
    name: 'SEO Quick Wins',
    description: 'Identifies high-impact, low-effort SEO improvements you can implement today for measurable results.',
    category: 'SEO',
    accentClass: 'text-lime-400 hover:bg-lime-500/10',
    buttonClass: 'bg-lime-700 hover:bg-lime-600',
    placeholder: 'Paste your site HTML, metadata config, and key page content...',
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
  }),

  // ─── SEO Research ────────────────────────────────────────────────
  builtin({
    id: 'seo-keyword-research',
    name: 'Keyword Research',
    description: 'Analyzes keyword targeting, cannibalization, long-tail coverage, and content gaps across your pages.',
    category: 'SEO',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your page content, titles, headings, and meta descriptions...',
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
  }),
  builtin({
    id: 'seo-serp-analysis',
    name: 'SERP Analysis',
    description: 'Reviews how your pages appear in search results — rich snippets, featured snippet eligibility, and CTR optimization.',
    category: 'SEO',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste your page metadata, structured data, and content structure...',
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
  }),
  builtin({
    id: 'seo-search-intent',
    name: 'Search Intent',
    description: 'Evaluates content alignment with user search intent — informational, navigational, transactional, and commercial.',
    category: 'SEO',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your page content, CTAs, and target keywords...',
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
  }),
  builtin({
    id: 'seo-competitor-research',
    name: 'Competitor Research',
    description: 'Analyzes your SEO competitive position — content strategy gaps, technical advantages, and authority signals.',
    category: 'SEO',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your site content and structure. Mention your competitors if known...',
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
  }),
  builtin({
    id: 'seo-keyword-gap',
    name: 'Keyword Gap',
    description: 'Identifies untapped keyword opportunities, missing topic clusters, and content gaps to expand your search footprint.',
    category: 'SEO',
    accentClass: 'text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-800 hover:bg-teal-700',
    placeholder: 'Paste your sitemap, content index, blog posts, and target keywords...',
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
  }),

  // ─── SEO Specialist ───────────────────────────────────────────────
  builtin({
    id: 'seo-local',
    name: 'Local SEO',
    description: 'Audits local search presence, Google Business Profile optimization, NAP consistency, and local ranking factors.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your website HTML, local landing pages, or Google Business Profile details...',
    systemPrompt: SYSTEM_PROMPTS['seo-local'],
    prepPrompt: `I'm preparing my site for a **Local SEO** audit. Please help me collect the relevant content.

## Project context (fill in)
- Business type: [e.g. restaurant, dental office, law firm, plumber]
- Service area: [city, region, or multi-location]
- Google Business Profile: [link or current status]
- Known concerns: [e.g. "inconsistent NAP", "no local landing pages", "few reviews"]

## Content to gather
- Local landing pages (full HTML or content)
- Google Business Profile details (name, address, phone, categories, attributes)
- NAP citations across directories (Yelp, Yellow Pages, industry-specific)
- Local schema markup (LocalBusiness JSON-LD)
- Review management setup and review counts
- Location-specific content and geo-targeted pages

## Don't forget
- [ ] Include your exact business name, address, and phone as listed everywhere
- [ ] Note any multi-location setup or service area details
- [ ] Include screenshots or exports from Google Business Profile
- [ ] Note your top local competitors

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'seo-ecommerce',
    name: 'E-commerce SEO',
    description: 'Audits product page optimization, category architecture, faceted navigation, canonical strategy, and product schema.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your product pages, category pages, faceted navigation HTML, and structured data...',
    systemPrompt: SYSTEM_PROMPTS['seo-ecommerce'],
    prepPrompt: `I'm preparing my store for an **E-commerce SEO** audit. Please help me collect the relevant content.

## Project context (fill in)
- Platform: [e.g. Shopify, WooCommerce, Magento, custom]
- Product count: [e.g. 50, 500, 50,000 SKUs]
- Category depth: [e.g. 2 levels, 5 levels]
- Known concerns: [e.g. "faceted navigation bloat", "thin product descriptions", "no product schema"]

## Content to gather
- Product page HTML (2-3 representative pages)
- Category page HTML with faceted navigation
- Product schema / structured data (JSON-LD)
- Canonical tag implementation across product variants
- Internal linking between products and categories
- URL structure for products, categories, and filters

## Don't forget
- [ ] Include pages for products with variants (size, color, etc.)
- [ ] Show how filtered/sorted URLs are handled (canonicals, noindex, etc.)
- [ ] Include breadcrumb implementation
- [ ] Note any out-of-stock product handling strategy

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'seo-content-audit',
    name: 'Content SEO Audit',
    description: 'Evaluates content quality, keyword cannibalization, thin content, topical authority, and content gap opportunities.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your content pages, blog posts, content inventory, or sitemap...',
    systemPrompt: SYSTEM_PROMPTS['seo-content-audit'],
    prepPrompt: `I'm preparing my site for a **Content SEO Audit**. Please help me collect the relevant content.

## Project context (fill in)
- Content volume: [e.g. 20 blog posts, 200 pages]
- Content types: [e.g. blog, guides, product pages, landing pages]
- Publishing frequency: [e.g. weekly, monthly, sporadic]
- Known concerns: [e.g. "declining traffic on old posts", "possible cannibalization", "thin pages"]

## Content to gather
- Full content of 5-10 representative pages (mix of high and low performers)
- Complete list of all page titles and URLs
- Any keyword mapping or target keyword assignments
- Google Search Console data showing cannibalization (multiple pages ranking for same query)
- Content that has declined in traffic or rankings

## Don't forget
- [ ] Include pages you suspect are cannibalizing each other
- [ ] Note any content consolidation already done
- [ ] Include your content taxonomy / category structure
- [ ] Note which pages get the most and least traffic

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'seo-link-building',
    name: 'Link Profile Analysis',
    description: 'Analyzes backlink quality, anchor text distribution, toxic links, internal linking, and link building opportunities.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your backlink data, internal linking structure, anchor text reports, or link audit exports...',
    systemPrompt: SYSTEM_PROMPTS['seo-link-building'],
    prepPrompt: `I'm preparing my site for a **Link Profile Analysis**. Please help me collect the relevant data.

## Project context (fill in)
- Domain age: [e.g. 1 year, 5 years]
- Domain authority/rating: [if known from Ahrefs, Moz, etc.]
- Known concerns: [e.g. "spammy backlinks", "weak internal linking", "no link building strategy"]

## Data to gather
- Backlink report export (from Ahrefs, Semrush, Moz, or Google Search Console)
- Anchor text distribution report
- Internal linking structure (navigation, contextual links, footer links)
- Top linked-to pages and orphan pages
- Competitor backlink comparison (if available)
- Any disavow file history

## Don't forget
- [ ] Include referring domains count and top referring domains
- [ ] Note any manual penalty history or disavow submissions
- [ ] Include your most important pages and their inbound link counts
- [ ] Note any link building efforts already underway

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'seo-mobile',
    name: 'Mobile SEO',
    description: 'Audits mobile-first indexing readiness, responsive design, mobile usability, page experience, and mobile search optimization.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your responsive layout HTML, viewport configuration, mobile styles, and page experience data...',
    systemPrompt: SYSTEM_PROMPTS['seo-mobile'],
    prepPrompt: `I'm preparing my site for a **Mobile SEO** audit. Please help me collect the relevant content.

## Project context (fill in)
- Framework: [e.g. Next.js, WordPress, custom]
- Responsive approach: [e.g. responsive CSS, separate mobile site, AMP]
- Mobile traffic share: [e.g. 60% mobile, 30% desktop]
- Known concerns: [e.g. "mobile usability errors in GSC", "slow on mobile", "content hidden on mobile"]

## Content to gather
- Root layout with viewport meta tag and responsive configuration
- CSS breakpoints and mobile-specific styles
- Key page HTML as rendered on mobile (use mobile device emulation)
- Touch target sizing and spacing implementation
- Mobile navigation component
- Any AMP pages or mobile-specific page versions

## Don't forget
- [ ] Include rendered HTML from both desktop and mobile for key pages
- [ ] Note any content differences between mobile and desktop versions
- [ ] Include mobile page speed data (Lighthouse or PageSpeed Insights)
- [ ] Note any interstitials or popups shown on mobile

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'seo-international',
    name: 'International SEO',
    description: 'Audits hreflang implementation, geo-targeting strategy, multilingual content, and cross-border SEO architecture.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your hreflang tags, language routing config, localized pages, and geo-targeting setup...',
    systemPrompt: SYSTEM_PROMPTS['seo-international'],
    prepPrompt: `I'm preparing my site for an **International SEO** audit. Please help me collect the relevant content.

## Project context (fill in)
- Target countries/languages: [e.g. US English, UK English, French, German]
- URL structure: [ccTLDs, subdomains, subdirectories, or query parameters]
- CMS/Framework: [e.g. Next.js i18n, WordPress WPML, custom]
- Known concerns: [e.g. "hreflang errors in GSC", "duplicate content across regions", "wrong country ranking"]

## Content to gather
- Hreflang tag implementation (HTML head, HTTP headers, or sitemap)
- Language/region routing configuration
- Localized page examples (same page in different languages)
- Geo-targeting settings in Google Search Console
- Sitemap structure for multi-language/region pages
- Content localization quality samples

## Don't forget
- [ ] Include the same page URL in all available languages/regions
- [ ] Note any x-default hreflang usage
- [ ] Include any geo-redirect or IP-based redirect logic
- [ ] Note which countries/languages drive the most traffic

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'seo-site-architecture',
    name: 'Site Architecture SEO',
    description: 'Audits URL structure, content siloing, crawl depth, internal linking topology, and information architecture for SEO.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your sitemap, URL structure, navigation components, and routing configuration...',
    systemPrompt: SYSTEM_PROMPTS['seo-site-architecture'],
    prepPrompt: `I'm preparing my site for a **Site Architecture SEO** audit. Please help me collect the relevant content.

## Project context (fill in)
- Site size: [e.g. 50 pages, 5,000 pages, 1M+ pages]
- Site type: [e.g. e-commerce, SaaS, publisher, marketplace]
- Framework: [e.g. Next.js, WordPress, custom]
- Known concerns: [e.g. "deep pages not indexed", "crawl budget waste", "poor siloing"]

## Content to gather
- Complete sitemap.xml or URL list
- URL structure patterns and routing configuration
- Navigation components (header, footer, sidebar, breadcrumbs)
- Internal linking patterns and contextual link implementation
- Pagination implementation
- Content taxonomy and category/tag structure

## Don't forget
- [ ] Include crawl depth data if available (how many clicks from homepage)
- [ ] Note any orphan pages (pages with no internal links pointing to them)
- [ ] Include redirect chains or redirect maps
- [ ] Note planned site growth (new sections, content types)

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'seo-core-web-vitals',
    name: 'Core Web Vitals SEO',
    description: 'Audits Core Web Vitals (LCP, CLS, INP) as ranking factors and page experience signals for search performance.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your page HTML, performance data, Lighthouse reports, and layout/rendering code...',
    systemPrompt: SYSTEM_PROMPTS['seo-core-web-vitals'],
    prepPrompt: `I'm preparing my site for a **Core Web Vitals SEO** audit. Please help me collect the relevant content.

## Project context (fill in)
- Framework: [e.g. Next.js 15, WordPress, Shopify]
- Current CWV status: [pass/fail in GSC, or specific LCP/CLS/INP values]
- Hosting: [e.g. Vercel, AWS, shared hosting]
- Known concerns: [e.g. "high LCP", "layout shift on load", "slow interactions"]

## Content to gather
- Lighthouse or PageSpeed Insights reports for key pages
- LCP element and its rendering path (images, fonts, CSS)
- Layout shift sources (dynamic content, ads, images without dimensions)
- INP-heavy interactions (JavaScript event handlers, third-party scripts)
- CrUX data from Google Search Console or PageSpeed Insights
- HTTPS implementation and certificate details

## Don't forget
- [ ] Include both field data (CrUX) and lab data (Lighthouse) if available
- [ ] Note which pages fail Core Web Vitals assessment in GSC
- [ ] Include third-party scripts that may impact performance
- [ ] Note any interstitials or intrusive popups

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'seo-structured-data',
    name: 'Structured Data SEO',
    description: 'Audits Schema.org markup, JSON-LD implementation, rich result eligibility, and structured data opportunities.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your JSON-LD markup, page HTML with structured data, or schema implementation code...',
    systemPrompt: SYSTEM_PROMPTS['seo-structured-data'],
    prepPrompt: `I'm preparing my site for a **Structured Data SEO** audit. Please help me collect the relevant content.

## Project context (fill in)
- Site type: [e.g. e-commerce, blog, local business, SaaS, recipe site]
- Current structured data: [e.g. "basic Organization schema only", "product schema on all products", "none"]
- Rich results status: [any rich results currently showing in Google?]
- Known concerns: [e.g. "schema validation errors", "no rich results despite markup", "missing required properties"]

## Content to gather
- All JSON-LD or structured data blocks from key pages
- Page HTML for 3-5 representative page types
- Google Rich Results Test output (if available)
- Schema markup generation code or CMS configuration
- Knowledge Graph / Google Business Profile connection

## Don't forget
- [ ] Include structured data from EVERY page type (home, product, article, FAQ, etc.)
- [ ] Note any rich results you want but are not getting
- [ ] Include Google Search Console enhancement reports
- [ ] Note any dynamically generated structured data

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'seo-indexation',
    name: 'Indexation & Crawl Management',
    description: 'Audits indexation issues, canonical conflicts, crawl errors, orphan pages, index bloat, and crawl directives.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your robots.txt, sitemap, canonical tags, meta robots directives, and Search Console data...',
    systemPrompt: SYSTEM_PROMPTS['seo-indexation'],
    prepPrompt: `I'm preparing my site for an **Indexation & Crawl Management** audit. Please help me collect the relevant content.

## Project context (fill in)
- Site size: [e.g. 100 pages, 10,000 pages, 1M+ URLs]
- Indexed pages: [approximate count from Google Search Console or site: search]
- Framework: [e.g. Next.js, WordPress, custom]
- Known concerns: [e.g. "pages not indexed", "index bloat", "canonical conflicts", "crawl errors"]

## Content to gather
- robots.txt (full contents)
- XML sitemap(s) or sitemap index
- Canonical tag implementation across page types
- Meta robots and X-Robots-Tag usage
- Google Search Console Index Coverage report data
- Crawl error logs or crawl stats from GSC
- Noindex / nofollow usage patterns

## Don't forget
- [ ] Include pages that are submitted but not indexed
- [ ] Note any recent site migrations or URL changes
- [ ] Include redirect chains and redirect maps
- [ ] Note any pages you want indexed but Google is ignoring

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'seo-video',
    name: 'Video SEO',
    description: 'Audits video optimization for search — video schema, sitemaps, YouTube SEO, thumbnails, transcripts, and SERP features.',
    category: 'SEO',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-700',
    placeholder: 'Paste your video embed code, video schema markup, YouTube metadata, or video sitemap...',
    systemPrompt: SYSTEM_PROMPTS['seo-video'],
    prepPrompt: `I'm preparing my site for a **Video SEO** audit. Please help me collect the relevant content.

## Project context (fill in)
- Video hosting: [e.g. YouTube, Vimeo, self-hosted, Wistia]
- Video count: [e.g. 10 videos, 100+ videos]
- Video types: [e.g. tutorials, product demos, testimonials, vlogs]
- Known concerns: [e.g. "videos not appearing in search", "no video schema", "poor YouTube rankings"]

## Content to gather
- Video embed code and player implementation
- Video schema markup (VideoObject JSON-LD)
- Video sitemap or video sitemap entries
- YouTube channel and video metadata (titles, descriptions, tags)
- Thumbnail implementation and quality
- Transcript or caption availability
- Pages containing video content (full HTML)

## Don't forget
- [ ] Include your video hosting strategy rationale
- [ ] Note any videos that appear in Google Video results
- [ ] Include YouTube analytics data if available
- [ ] Note your thumbnail creation process and A/B testing

Keep total under 30,000 characters.`,
  }),

  // ─── Bloat & Lean Code ──────────────────────────────────────────
  builtin({
    id: 'code-bloat',
    name: 'Code Bloat',
    description: 'Finds dead code, over-abstraction, copy-paste duplication, unused dependencies, and unnecessary complexity.',
    category: 'Code Quality',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-800 hover:bg-orange-700',
    placeholder: 'Paste the code you suspect has bloat — the more files, the better the analysis...',
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
  }),

  // ─── Pain Point Audits ─────────────────────────────────────────
  builtin({
    id: 'marketing-pain-points',
    name: 'Marketing Pain Points',
    description: 'Finds conversion killers: unclear positioning, weak CTAs, missing trust signals, and messaging friction.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your landing page HTML, marketing copy, or page components...',
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
  }),

  // ─── Marketing Audits ─────────────────────────────────────────
  builtin({
    id: 'marketing-copywriting',
    name: 'Copywriting Audit',
    description: 'Audits headlines, CTAs, value props, and persuasion structure using AIDA, PAS, and direct-response frameworks.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your marketing copy, landing page text, ad creative, or email copy...',
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
  }),
  builtin({
    id: 'marketing-landing-pages',
    name: 'Landing Page Audit',
    description: 'Optimizes landing pages for conversion: layout, messaging hierarchy, CTAs, trust signals, and mobile experience.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your landing page HTML, component code, or page copy...',
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
  }),
  builtin({
    id: 'marketing-email-campaigns',
    name: 'Email Campaign Audit',
    description: 'Audits email campaigns for subject lines, deliverability, copy persuasion, CTA effectiveness, and segmentation.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your email HTML, subject lines, campaign copy, or email sequence...',
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
  }),
  builtin({
    id: 'marketing-social-media',
    name: 'Social Media Audit',
    description: 'Evaluates social media profiles, content strategy, engagement patterns, and growth tactics across platforms.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your social media profiles, recent posts, content calendar, or analytics...',
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
  }),
  builtin({
    id: 'marketing-brand-voice',
    name: 'Brand Voice Audit',
    description: 'Assesses tone consistency, messaging alignment, and brand personality across all touchpoints.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste copy from multiple touchpoints: website, emails, social posts, product UI...',
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
  }),
  builtin({
    id: 'marketing-competitor-analysis',
    name: 'Competitor Analysis',
    description: 'Analyzes competitive positioning, messaging gaps, feature differentiation, and strategic white space.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your marketing materials alongside competitor content for comparison...',
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
  }),
  builtin({
    id: 'marketing-pricing-page',
    name: 'Pricing Page Audit',
    description: 'Audits pricing psychology, tier structure, objection handling, and decision architecture to maximize revenue.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your pricing page HTML, pricing structure, or feature comparison matrix...',
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
  }),
  builtin({
    id: 'marketing-onboarding',
    name: 'Onboarding Flow Audit',
    description: 'Evaluates activation flow for time-to-value, progressive disclosure, motivation design, and retention mechanics.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your onboarding flow code, screen copy, user journey, or wireframes...',
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
  }),
  builtin({
    id: 'marketing-analytics',
    name: 'Marketing Analytics Audit',
    description: 'Audits tracking implementation, attribution models, funnel instrumentation, and KPI frameworks.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your analytics configuration, tracking code, GTM setup, or measurement plan...',
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
  }),
  builtin({
    id: 'marketing-content-strategy',
    name: 'Content Strategy Audit',
    description: 'Evaluates topic clusters, content gaps, funnel-stage coverage, SEO alignment, and content distribution.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your content inventory, blog posts, content calendar, or sitemap...',
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
  }),
  builtin({
    id: 'marketing-conversion-rate',
    name: 'Conversion Rate Audit',
    description: 'Identifies conversion blockers using LIFT model, ICE scoring, and recommends A/B tests for key funnel steps.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your conversion funnel code, analytics data, or user flow descriptions...',
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
  }),
  builtin({
    id: 'marketing-product-positioning',
    name: 'Product Positioning Audit',
    description: 'Evaluates ICP fit, competitive frame, differentiation, and messaging using Obviously Awesome and JTBD frameworks.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your product marketing materials, positioning docs, or website copy...',
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
  }),
  builtin({
    id: 'marketing-growth-loops',
    name: 'Growth Loops Audit',
    description: 'Maps viral mechanics, referral programs, content loops, and network effects for compounding growth.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your product code, referral system, sharing mechanics, or growth strategy docs...',
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
  }),
  builtin({
    id: 'marketing-retention',
    name: 'Retention Audit',
    description: 'Identifies churn signals, evaluates engagement loops, lifecycle communication, and win-back strategies.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your lifecycle emails, engagement data, cancellation flow, or retention strategy...',
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
  }),
  builtin({
    id: 'marketing-ab-testing',
    name: 'A/B Testing Strategy',
    description: 'Evaluates experimentation maturity: hypothesis quality, statistical rigor, test prioritization, and learning culture.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your test results, experimentation docs, hypothesis backlog, or testing tool config...',
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
  }),
  builtin({
    id: 'marketing-funnel',
    name: 'Marketing Funnel Audit',
    description: 'Analyzes full-funnel health: TOFU traffic, MOFU nurture, BOFU conversion, and stage transition rates.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your funnel data, marketing strategy, campaign materials, or analytics...',
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
  }),
  builtin({
    id: 'marketing-value-proposition',
    name: 'Value Proposition Audit',
    description: 'Evaluates unique selling points, benefit clarity, customer-problem fit, and differentiation using the Value Proposition Canvas.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your product messaging, marketing materials, or value proposition statements...',
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
  }),
  builtin({
    id: 'marketing-user-research',
    name: 'User Research Audit',
    description: 'Assesses persona quality, JTBD alignment, research methodology, and insight-to-action pipeline.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your personas, research findings, survey results, or interview transcripts...',
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
  }),
  builtin({
    id: 'marketing-gtm-strategy',
    name: 'Go-to-Market Strategy Audit',
    description: 'Evaluates launch readiness: market definition, channel strategy, sales enablement, and execution sequencing.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-800 hover:bg-pink-700',
    placeholder: 'Paste your GTM strategy, launch plan, marketing materials, or product brief...',
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
  }),
  builtin({
    id: 'ai-messaging',
    name: 'AI Messaging Auditor',
    description: 'Spots AI hype, unsupported claims, and tech-first framing that alienate skeptical developers — with outcome-first rewrites.',
    category: 'Marketing',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your landing page HTML, hero section copy, FAQ, or any marketing content that references AI...',
    systemPrompt: SYSTEM_PROMPTS['ai-messaging'],
    prepPrompt: `I'm preparing my site for an **AI Messaging Audit**.

Paste any of the following:
- Landing page HTML or raw copy
- Hero section / value proposition
- FAQ section
- Feature descriptions that mention AI
- Any marketing content referencing AI, LLMs, or automation

The auditor will flag hype language, unsupported claims, missing disclosures, and tech-first framing — and suggest concrete, skeptic-proof rewrites.

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'developer-pain-points',
    name: 'Developer Pain Points',
    description: 'Spots DX friction: confusing APIs, unhelpful errors, inconsistent patterns, and onboarding barriers.',
    category: 'Code Quality',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-700 hover:bg-amber-600',
    placeholder: 'Paste the code a new developer would need to understand and work with...',
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
  }),

  // ─── New Performance Agents ─────────────────────────────────────
  builtin({
    id: 'network-performance',
    name: 'Network Performance',
    description: 'Audits HTTP/2, connection pooling, DNS resolution, CDN config, prefetch hints, and request waterfalls.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your HTML head, server config, resource loading code, or Lighthouse network report...',
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
  }),
  builtin({
    id: 'database-performance',
    name: 'Database Performance',
    description: 'Detects N+1 queries (database calls that multiply with data size), missing indexes, full table scans, connection pool issues, and query anti-patterns.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your ORM models, database queries, API route handlers, or EXPLAIN output...',
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
  }),
  builtin({
    id: 'image-optimization',
    name: 'Image Optimization',
    description: 'Reviews image formats, responsive sizing, lazy loading, CDN delivery, and LCP (Core Web Vitals) image optimization.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your image components, HTML with img tags, or image loading configuration...',
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
  }),
  builtin({
    id: 'ssr-performance',
    name: 'SSR Performance',
    description: 'Analyzes streaming SSR (server-side rendering), selective hydration, server timing, TTFB (time to first byte — server response speed), and rendering strategy selection.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your page components, data fetching logic, layout files, and server configuration...',
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
  }),
  builtin({
    id: 'api-performance',
    name: 'API Performance',
    description: 'Reviews response times, payload sizes, batching, caching headers, and serialization efficiency.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your API route handlers, middleware, serialization logic, or OpenAPI spec...',
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
  }),
  builtin({
    id: 'css-performance',
    name: 'CSS Performance',
    description: 'Audits critical CSS, unused styles, selector complexity, layout thrashing, and CLS (Core Web Vitals)-causing patterns.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your CSS files, styled components, Tailwind config, or component styling code...',
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
  }),
  builtin({
    id: 'javascript-performance',
    name: 'JavaScript Performance',
    description: 'Analyzes main thread blocking, long tasks, code splitting, tree-shaking, and script loading strategy.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your JS/TS entry points, component code, build config, or bundle analysis output...',
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
  }),
  builtin({
    id: 'animation-performance',
    name: 'Animation Performance',
    description: 'Reviews GPU compositing, jank prevention, requestAnimationFrame usage, will-change, and scroll effects.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your animation code, CSS transitions, scroll handlers, or Framer Motion components...',
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
  }),
  builtin({
    id: 'web-vitals',
    name: 'Core Web Vitals',
    description: 'Optimizes LCP, INP, CLS, FCP (Core Web Vitals), and TTFB (time to first byte — server response speed) against Google thresholds with specific remediation steps.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your page components, Lighthouse report, or PageSpeed Insights results...',
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
  }),
  builtin({
    id: 'runtime-performance',
    name: 'Runtime Performance',
    description: 'Detects memory leaks, GC pressure, event listener accumulation, closure captures, and unbounded caches.',
    category: 'Performance',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your components, event handlers, subscription code, or memory-intensive modules...',
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
  }),
  builtin({
    id: 'build-performance',
    name: 'Build Performance',
    description: 'Optimizes compile times, HMR (hot module reload) speed, bundler config, caching strategies, and CI build pipelines.',
    category: 'Performance',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your build config, tsconfig, CI pipeline, or npm run build output...',
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
  }),
  builtin({
    id: 'navigation-ux',
    name: 'Navigation UX',
    description: 'Audits information architecture, wayfinding, breadcrumbs, menus, and deep-linking patterns.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your navigation markup, site map structure, menu components, or route configuration...',
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
  }),
  builtin({
    id: 'micro-interactions',
    name: 'Micro-interactions',
    description: 'Reviews feedback patterns, loading states, transitions, empty states, and state change animations.',
    category: 'Design',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your UI components with state handling, loading patterns, empty states, or transition code...',
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
  }),
  builtin({
    id: 'error-ux',
    name: 'Error UX',
    description: 'Evaluates error messages, recovery flows, 404/500 pages, validation UX, and graceful degradation.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your error pages, validation components, error boundary code, or error message patterns...',
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
  }),
  builtin({
    id: 'mobile-ux',
    name: 'Mobile UX',
    description: 'Audits touch targets, gesture design, thumb zones, bottom sheets, and mobile-first interaction patterns.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your mobile layouts, touch-interactive components, responsive CSS, or viewport configuration...',
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
  }),
  builtin({
    id: 'data-visualization',
    name: 'Data Visualization',
    description: 'Reviews charts, graphs, dashboards, and visual data accessibility for clarity and correctness.',
    category: 'Design',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your chart components, dashboard layouts, D3/Recharts/Chart.js code, or visualization configs...',
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
  }),
  builtin({
    id: 'content-design',
    name: 'Content Design',
    description: 'Audits microcopy, labels, help text, progressive disclosure, and content readability.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your UI with labels, headings, help text, error messages, tooltips, or onboarding copy...',
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
  }),
  builtin({
    id: 'onboarding-ux',
    name: 'Onboarding UX',
    description: 'Reviews first-run experience, tutorials, tooltips, progressive revelation, and user activation flow.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your onboarding flow, setup wizard, tutorial components, or first-run experience code...',
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
  }),
  builtin({
    id: 'search-ux',
    name: 'Search UX',
    description: 'Evaluates autocomplete, filters, results display, no-results handling, and search accessibility.',
    category: 'Design',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your search components, filter UI, results display, autocomplete logic, or search config...',
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
  }),
  builtin({
    id: 'table-design',
    name: 'Table & List Design',
    description: 'Audits table sorting, filtering, pagination, responsive behavior, and data table accessibility.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your data table components, list views, grid layouts, or tabular data display code...',
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
  }),
  builtin({
    id: 'notification-ux',
    name: 'Notification UX',
    description: 'Reviews toasts, alerts, badges, interruption hierarchy, and notification accessibility.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your toast/snackbar components, alert banners, badge UI, or notification system code...',
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
  }),
  builtin({
    id: 'spacing-layout',
    name: 'Spacing & Layout',
    description: 'Audits visual rhythm, whitespace strategy, grid systems, alignment, and spacing token consistency.',
    category: 'Design',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your CSS with spacing values, Tailwind config, layout components, or design tokens...',
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
  }),
  builtin({
    id: 'loading-states',
    name: 'Loading & Skeleton States',
    description: 'Audits loading patterns, skeleton screens, spinners, shimmer effects, and perceived performance optimization.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your loading components, skeleton screens, spinner code, or suspense boundaries...',
    systemPrompt: SYSTEM_PROMPTS['loading-states'],
    prepPrompt: `I'm preparing code for a **Loading & Skeleton States** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. React, Vue, Svelte, Next.js]
- Data fetching: [e.g. React Query, SWR, Apollo, fetch, Suspense]
- Current loading approach: [e.g. "full-page spinner", "skeleton screens", "none", "mixed"]
- Known concerns: [e.g. "layout shift on load", "no feedback during fetch", "inconsistent spinners"]

## Files to gather
- Loading/spinner/skeleton components
- Suspense boundaries or lazy-loaded routes
- Data fetching hooks or utilities
- Pages or views with significant async data
- Any loading state context providers or global indicators
- CSS/animations for shimmer or pulse effects

## Don't forget
- [ ] Include ALL loading component variants (spinner, skeleton, progress bar)
- [ ] Show how error and empty states transition from loading
- [ ] Include any Suspense or streaming SSR boundaries
- [ ] Note any pages that lack loading feedback entirely
- [ ] Show how nested loading states are handled (avoid "spinner waterfalls")

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'empty-states',
    name: 'Empty States',
    description: 'Reviews zero-data views, first-use experiences, no-results screens, and actionable placeholder content.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your empty state components, zero-data views, or no-results screens...',
    systemPrompt: SYSTEM_PROMPTS['empty-states'],
    prepPrompt: `I'm preparing code for an **Empty States** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. React, Vue, Svelte, Next.js]
- App type: [e.g. dashboard, e-commerce, SaaS, social]
- Current empty state approach: [e.g. "plain text", "illustrations", "none", "mixed"]
- Known concerns: [e.g. "blank pages confuse users", "no onboarding guidance", "search returns nothing with no help"]

## Files to gather
- Dedicated empty state or placeholder components
- List/table/grid views that can be empty
- Search results pages and filter views
- First-use or onboarding screens
- Dashboard or analytics pages with potential zero-data
- Illustration or icon assets used in empty states

## Don't forget
- [ ] Include ALL views that can display zero items
- [ ] Show first-time user experience for new accounts
- [ ] Include search and filter no-results states
- [ ] Note which empty states have a call-to-action vs. plain text
- [ ] Show how empty states differ between authenticated and guest users

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'modal-dialog',
    name: 'Modal & Dialog',
    description: 'Audits overlay patterns, focus trapping, scroll locking, z-index management, and accessible dialog implementation.',
    category: 'Design',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your modal, dialog, drawer, or overlay components and their trigger logic...',
    systemPrompt: SYSTEM_PROMPTS['modal-dialog'],
    prepPrompt: `I'm preparing code for a **Modal & Dialog** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. React, Vue, Svelte, Next.js]
- Modal library: [e.g. Headless UI, Radix, custom, native dialog element]
- Portal strategy: [e.g. React Portal, Teleport, inline rendering]
- Known concerns: [e.g. "focus not trapped", "scroll bleeds through", "z-index wars", "no close on Escape"]

## Files to gather
- Modal/dialog/drawer/sheet base components
- Overlay/backdrop components
- Focus trap or focus management utilities
- Scroll lock hooks or utilities
- z-index scale definitions (CSS variables, Tailwind config, constants)
- Pages or flows that trigger modals (confirmation, forms, alerts)

## Don't forget
- [ ] Include ALL modal/dialog variants (alert, confirm, form, drawer, sheet)
- [ ] Show how focus is trapped and restored on close
- [ ] Include scroll-locking behavior and body overflow handling
- [ ] Note z-index values and stacking context management
- [ ] Show keyboard interaction (Escape to close, Tab trapping)
- [ ] Include nested or stacked modal scenarios if they exist

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'icon-consistency',
    name: 'Icon Consistency',
    description: 'Reviews icon set coherence, sizing scales, stroke width uniformity, and icon accessibility patterns.',
    category: 'Design',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your icon components, SVG files, icon utility wrappers, or icon import patterns...',
    systemPrompt: SYSTEM_PROMPTS['icon-consistency'],
    prepPrompt: `I'm preparing code for an **Icon Consistency** audit. Please help me collect the relevant files.

## Project context (fill in)
- Icon source: [e.g. Heroicons, Lucide, FontAwesome, custom SVGs, mixed]
- Icon format: [e.g. inline SVG, icon font, sprite sheet, React components]
- Size scale: [e.g. "sm/md/lg", "16/20/24px", "ad-hoc sizes"]
- Known concerns: [e.g. "mixed icon sets", "inconsistent sizes", "no alt text", "blurry at small sizes"]

## Files to gather
- Icon wrapper or utility components
- SVG icon files or icon component library
- Places where icons are used inline (buttons, nav, lists, alerts)
- Tailwind config or CSS with icon sizing tokens
- Any icon sprite sheet or icon font setup
- Accessibility wrappers for decorative vs. semantic icons

## Don't forget
- [ ] Include icons from ALL sources used in the project
- [ ] Show icon sizing across different contexts (nav, buttons, inline text)
- [ ] Note stroke width differences between icon sets
- [ ] Include aria-hidden, role="img", and alt text patterns
- [ ] Show how decorative vs. informational icons are distinguished
- [ ] Include any icon color/theming patterns

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'print-styles',
    name: 'Print Styles',
    description: 'Audits print stylesheets, page-break rules, print-friendly colors, and cross-browser print rendering.',
    category: 'Design',
    accentClass: 'text-sky-400 hover:bg-sky-500/10',
    buttonClass: 'bg-sky-700 hover:bg-sky-600',
    placeholder: 'Paste your print stylesheets, @media print rules, or printable page components...',
    systemPrompt: SYSTEM_PROMPTS['print-styles'],
    prepPrompt: `I'm preparing code for a **Print Styles** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. React, Vue, Svelte, Next.js]
- Print use cases: [e.g. invoices, reports, receipts, articles, tickets]
- Current print support: [e.g. "dedicated print CSS", "none", "basic @media print", "react-to-print"]
- Known concerns: [e.g. "pages break mid-table", "colors waste ink", "nav prints on every page", "images missing"]

## Files to gather
- Print-specific stylesheets or @media print blocks
- Global CSS with any print rules
- Components for printable content (invoices, reports, receipts)
- Print trigger buttons or print utility functions
- Tailwind config print variant setup if applicable
- Any PDF generation or server-side print rendering code

## Don't forget
- [ ] Include ALL @media print rules across the codebase
- [ ] Show pages that users are most likely to print
- [ ] Include header/footer/nav components (to verify they hide in print)
- [ ] Note any background colors or images that need print-color-adjust
- [ ] Show table or long-content components for page-break behavior
- [ ] Include any print-specific JavaScript (window.print triggers, beforeprint events)

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'drag-drop',
    name: 'Drag & Drop',
    description: 'Reviews drag interactions, drop zone feedback, keyboard alternatives, reorder accessibility, and touch drag support.',
    category: 'Design',
    accentClass: 'text-lime-400 hover:bg-lime-500/10',
    buttonClass: 'bg-lime-700 hover:bg-lime-600',
    placeholder: 'Paste your drag-and-drop components, sortable lists, or file upload drop zones...',
    systemPrompt: SYSTEM_PROMPTS['drag-drop'],
    prepPrompt: `I'm preparing code for a **Drag & Drop** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. React, Vue, Svelte, Next.js]
- DnD library: [e.g. dnd-kit, react-beautiful-dnd, native HTML5 DnD, Sortable.js, custom]
- Use cases: [e.g. "kanban board", "file upload", "list reorder", "image gallery sort"]
- Known concerns: [e.g. "no keyboard alternative", "broken on touch devices", "janky animations", "no drop zone feedback"]

## Files to gather
- Drag-and-drop provider/context setup
- Draggable item components
- Drop zone / droppable area components
- Sortable list or grid components
- File upload drop zone components
- Keyboard reorder alternatives (move up/down buttons)
- Touch gesture handling code
- Animation or transition logic for drag operations

## Don't forget
- [ ] Include ALL drag-and-drop interactions in the app
- [ ] Show drop zone visual feedback (hover, valid/invalid drop)
- [ ] Include keyboard alternatives for every drag interaction
- [ ] Note how drag state is announced to screen readers
- [ ] Show touch device handling and scroll-vs-drag disambiguation
- [ ] Include any drag handle or grip affordance components

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'multi-step-flows',
    name: 'Multi-step Flows',
    description: 'Audits wizard and stepper patterns, step validation, progress indicators, state persistence, and branching logic.',
    category: 'Design',
    accentClass: 'text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste your wizard, stepper, or multi-step form components and their state management...',
    systemPrompt: SYSTEM_PROMPTS['multi-step-flows'],
    prepPrompt: `I'm preparing code for a **Multi-step Flows** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. React, Vue, Svelte, Next.js]
- Form library: [e.g. React Hook Form, Formik, Zod, native]
- Multi-step use cases: [e.g. "onboarding wizard", "checkout flow", "registration", "setup guide"]
- Known concerns: [e.g. "users lose progress on refresh", "no back button", "unclear which step they're on", "validation only at end"]

## Files to gather
- Stepper/wizard wrapper components
- Individual step components or pages
- Step validation schemas or logic
- Progress indicator or step tracker components
- State management for multi-step data (context, store, URL params)
- Navigation guards or unsaved-changes warnings
- Any branching or conditional step logic

## Don't forget
- [ ] Include ALL multi-step flows in the application
- [ ] Show the progress indicator / step tracker component
- [ ] Include per-step validation logic
- [ ] Note how state persists across steps (and on page refresh)
- [ ] Show back/forward navigation and step skipping rules
- [ ] Include any branching logic (conditional steps based on input)
- [ ] Show the final submission and error recovery flow

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'settings-preferences',
    name: 'Settings & Preferences',
    description: 'Reviews settings page organization, toggle patterns, instant-apply vs save, dangerous action confirmations, and reset flows.',
    category: 'Design',
    accentClass: 'text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-700 hover:bg-teal-600',
    placeholder: 'Paste your settings pages, preference components, or configuration management code...',
    systemPrompt: SYSTEM_PROMPTS['settings-preferences'],
    prepPrompt: `I'm preparing code for a **Settings & Preferences** audit. Please help me collect the relevant files.

## Project context (fill in)
- Framework: [e.g. React, Vue, Svelte, Next.js]
- Settings scope: [e.g. user preferences, account settings, app config, team/org settings]
- Save behavior: [e.g. "instant apply on toggle", "save button", "mixed", "auto-save"]
- Known concerns: [e.g. "unclear what's saved", "no confirmation for dangerous actions", "settings are disorganized", "no reset to defaults"]

## Files to gather
- Settings page layout and navigation (tabs, sidebar, sections)
- Individual settings section components (profile, notifications, security, billing)
- Toggle, switch, and radio group components used in settings
- Save/cancel/reset button logic and feedback
- Dangerous action flows (delete account, revoke access, reset data)
- Settings persistence layer (API calls, local storage, context)
- Any settings search or filter functionality

## Don't forget
- [ ] Include ALL settings pages and sections
- [ ] Show how save/apply feedback is communicated to users
- [ ] Include dangerous action confirmation dialogs (delete, reset, revoke)
- [ ] Note which settings apply instantly vs. require explicit save
- [ ] Show form validation and error handling in settings
- [ ] Include any "reset to defaults" functionality
- [ ] Show how settings are organized and categorized

Keep total under 30,000 characters.`,
  }),

  // ── Subscription & Monetization ─────────────────────────────────
  builtin({
    id: 'subscription-billing',
    name: 'Subscription Billing',
    category: 'Monetization',
    description: 'Reviews subscription and billing integration code — Stripe, Paddle, Chargebee — for webhook security, idempotency, entitlement correctness, dunning logic, proration, and fraud vectors.',
    accentClass: 'text-emerald-400 bg-emerald-400/10',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    placeholder: `// Paste your billing integration code
// e.g. webhook handlers, subscription creation,
// entitlement checks, plan change logic`,
    systemPrompt: SYSTEM_PROMPTS['subscription-billing'],
    prepPrompt: `I'm preparing code for a **Subscription Billing** audit. Please help me collect and format the relevant files.

## Project context (fill in)
- Billing provider: [e.g. Stripe, Paddle, Chargebee, Recurly]
- Subscription model: [e.g. monthly/annual plans, seat-based, usage-based]
- Stack: [e.g. Node.js + Next.js, Rails, Django]

## Files to gather

### 1. Webhook handlers
- Payment succeeded / failed handlers
- Subscription created / updated / cancelled handlers
- Invoice and customer event handlers

### 2. Subscription lifecycle
- Plan creation and upgrade/downgrade logic
- Proration handling
- Trial start and conversion logic
- Cancellation and reactivation flows

### 3. Entitlement checks
- Code that gates features by subscription status or plan tier
- Any middleware that validates active subscriptions

### 4. Configuration
- Plan/price ID definitions (Stripe price IDs, plan slugs, etc.)
- Billing-related environment variable references (no actual secrets)

## Formatting rules

Format each file like this:
\`\`\`
--- path/to/filename.ext ---
[full file contents]
\`\`\`

Separate files with a blank line. If total exceeds 30,000 characters, prioritise webhook handlers and entitlement logic, truncate long files to their first 100 lines, and note what was omitted.`,
  }),
  builtin({
    id: 'feature-entitlements',
    name: 'Feature Entitlements',
    category: 'Monetization',
    description: 'Audits feature flagging and entitlement systems — plan gates, RBAC/ABAC (role and attribute-based access control), trial enforcement, seat limits — checking that paid features are never accessible client-side-only or without proper server-side verification.',
    accentClass: 'text-violet-400 bg-violet-400/10',
    buttonClass: 'bg-violet-600 hover:bg-violet-500 text-white',
    placeholder: `// Paste your entitlement / feature-gate code
// e.g. plan checks, feature flags, role guards,
// trial restriction logic`,
    systemPrompt: SYSTEM_PROMPTS['feature-entitlements'],
    prepPrompt: `I'm preparing code for a **Feature Entitlements** audit. Please help me collect and format the relevant files.

## Project context (fill in)
- Billing provider / plan source: [e.g. Stripe, custom DB table, LaunchDarkly]
- Plan tiers: [e.g. Free / Pro / Team / Enterprise]
- Stack: [e.g. Next.js, Rails, Django + DRF]

## Files to gather

### 1. Entitlement / plan-gate logic
- Functions or middleware that check if a user has access to a feature
- Any \`canAccess\`, \`hasFeature\`, \`checkPlan\`, or similar helpers
- Role-based access control (RBAC) guards tied to subscription tier

### 2. Feature flag system
- Feature flag definitions and their plan mappings
- Flag evaluation logic (especially server-side checks)
- Any client-side flag reads (important for finding client-only gates)

### 3. Trial enforcement
- Trial expiry checks
- Seat or usage limit enforcement code
- Upgrade prompt triggers

### 4. API / route middleware
- Auth middleware that attaches subscription/plan info to requests
- Route-level plan guards

## Formatting rules

Format each file like this:
\`\`\`
--- path/to/filename.ext ---
[full file contents]
\`\`\`

Separate files with a blank line. If total exceeds 30,000 characters, prioritise entitlement check functions and any client-side gate code, truncate long files to their first 100 lines, and note what was omitted.`,
  }),
  builtin({
    id: 'trial-conversion',
    name: 'Trial Conversion',
    category: 'Monetization',
    description: 'Evaluates your trial-to-paid conversion flow — onboarding time-to-value, limit communication, upgrade prompt placement, upgrade friction, trial expiry handling, and trust signals — to increase paid conversion rates.',
    accentClass: 'text-pink-400 bg-pink-400/10',
    buttonClass: 'bg-pink-600 hover:bg-pink-500 text-white',
    placeholder: `// Paste your trial onboarding or upgrade flow code
// e.g. trial banner components, upgrade CTAs,
// plan selection page, trial expiry handling`,
    systemPrompt: SYSTEM_PROMPTS['trial-conversion'],
    prepPrompt: `I'm preparing code for a **Trial Conversion** audit. Please help me collect and format the relevant files.

## Project context (fill in)
- Trial model: [e.g. 14-day free trial, freemium with usage limits, opt-in credit card trial]
- Billing provider: [e.g. Stripe, Paddle]
- Stack: [e.g. Next.js + React, Rails + Hotwire]

## Files to gather

### 1. Trial onboarding UI
- Trial banner or status bar component
- First-run / welcome screen
- Empty state components that appear during trial

### 2. Upgrade prompts
- Upgrade CTA components (inline, modal, paywall)
- Plan selection / pricing page
- Upsell trigger logic (where and when upgrades are surfaced)

### 3. Trial expiry handling
- Trial expiry check logic
- Expired trial UI (locked state, downgrade notice)
- Any email triggers tied to trial events (day 7 nudge, expiry warning, etc.)

### 4. Activation tracking (if available)
- Analytics events fired during onboarding (identify, track calls)
- Any time-to-value instrumentation

## Formatting rules

Format each file like this:
\`\`\`
--- path/to/filename.ext ---
[full file contents]
\`\`\`

Separate files with a blank line. If total exceeds 30,000 characters, prioritise upgrade prompt components and trial expiry handling, truncate long files to their first 100 lines, and note what was omitted.`,
  }),
  builtin({
    id: 'dunning-flow',
    name: 'Dunning Flow',
    category: 'Monetization',
    description: 'Reviews your payment failure recovery and dunning strategy — retry schedules, email sequences, in-app payment update flows, access restriction timing, and winback logic — to maximize involuntary churn recovery.',
    accentClass: 'text-amber-400 bg-amber-400/10',
    buttonClass: 'bg-amber-600 hover:bg-amber-500 text-white',
    placeholder: `// Paste your dunning / payment failure handling code
// e.g. failed payment webhooks, dunning email templates,
// in-app payment update UI, access restriction logic`,
    systemPrompt: SYSTEM_PROMPTS['dunning-flow'],
    prepPrompt: `I'm preparing code for a **Dunning Flow** audit. Please help me collect and format the relevant files.

## Project context (fill in)
- Billing provider: [e.g. Stripe, Paddle, Chargebee]
- Retry schedule: [e.g. Stripe Smart Retries, custom schedule at day 1 / 3 / 7 / 14]
- Access policy on failure: [e.g. grace period, immediate downgrade, soft lock]

## Files to gather

### 1. Payment failure webhook handler
- The handler for \`invoice.payment_failed\` (Stripe) or equivalent
- Any retry scheduling logic triggered on failure

### 2. In-app payment update flow
- "Update payment method" UI component
- Hosted billing portal integration or custom card update form

### 3. Dunning email templates
- Payment failed email (initial)
- Follow-up retry emails
- Final notice before cancellation / access loss

### 4. Access restriction logic
- Code that locks or downgrades access after failed payment
- Grace period handling
- Reactivation flow after successful payment recovery

## Formatting rules

Format each file like this:
\`\`\`
--- path/to/filename.ext ---
[full file contents]
\`\`\`

Separate files with a blank line. If total exceeds 30,000 characters, prioritise webhook handlers and access restriction logic, truncate long files to their first 100 lines, and note what was omitted.`,
  }),
  builtin({
    id: 'pricing-architecture',
    name: 'Pricing Architecture',
    category: 'Monetization',
    description: 'Audits your pricing model and implementation — value metric alignment, tier structure, pricing page effectiveness, hardcoded vs. dynamic pricing, and expansion revenue paths — to identify ARPU and conversion improvements.',
    accentClass: 'text-indigo-400 bg-indigo-400/10',
    buttonClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    placeholder: `// Paste your pricing page code or billing configuration
// e.g. plan definitions, pricing page component,
// price IDs, feature comparison table`,
    systemPrompt: SYSTEM_PROMPTS['pricing-architecture'],
    prepPrompt: `I'm preparing code for a **Pricing Architecture** audit. Please help me collect and format the relevant files.

## Project context (fill in)
- Billing provider: [e.g. Stripe, Paddle]
- Current plan tiers and names: [e.g. Starter $9/mo, Pro $29/mo, Team $79/mo]
- Value metric: [e.g. seats, API calls, projects, MAU]
- Known concern: [e.g. "low upgrade rate from Free → Pro", "pricing page bounce rate is high"]

## Files to gather

### 1. Pricing page
- Pricing page component (the full page or section)
- Feature comparison table component
- Plan selection / CTA buttons

### 2. Plan definitions
- Plan/price ID constants or config (Stripe price IDs, plan slugs)
- Feature-to-plan mapping (what features belong to which tier)
- Any pricing config file or database seed

### 3. Upgrade flow entry points
- Components that prompt users to upgrade (paywalls, upsell banners)
- Checkout or plan selection modal

### 4. Billing settings page (if applicable)
- Current plan display
- Plan change UI

## Formatting rules

Format each file like this:
\`\`\`
--- path/to/filename.ext ---
[full file contents]
\`\`\`

Separate files with a blank line. If total exceeds 30,000 characters, prioritise the pricing page and plan definitions, truncate long files to their first 100 lines, and note what was omitted.`,
  }),
  builtin({
    id: 'metered-billing',
    name: 'Metered Billing',
    category: 'Monetization',
    description: 'Audits usage-based billing and metering infrastructure — event ingestion reliability, deduplication, aggregation logic, overage handling, customer usage transparency, and observability — to ensure billing accuracy and prevent revenue loss.',
    accentClass: 'text-cyan-400 bg-cyan-400/10',
    buttonClass: 'bg-cyan-600 hover:bg-cyan-500 text-white',
    placeholder: `// Paste your metering / usage-based billing code
// e.g. usage event emission, aggregation logic,
// billing period cutover, limit enforcement`,
    systemPrompt: SYSTEM_PROMPTS['metered-billing'],
    prepPrompt: `I'm preparing code for a **Metered Billing** audit. Please help me collect and format the relevant files.

## Project context (fill in)
- Billing provider: [e.g. Stripe Metered, Lago, Amberflo, custom]
- Usage metric: [e.g. API calls, compute minutes, seats, storage GB]
- Billing period: [e.g. monthly reset, real-time, prepaid credits]
- Stack: [e.g. Node.js workers, Python Celery, Go services]

## Files to gather

### 1. Usage event emission
- Code that records usage events (API calls, \`stripe.subscriptionItems.createUsageRecord\`, etc.)
- Queue producers or event emitters tied to billable actions

### 2. Aggregation logic
- Code that sums, groups, or rolls up usage events per billing period
- Any deduplication logic for events

### 3. Limit enforcement
- Code that checks current usage against plan limits
- Hard stop vs. soft warning handling
- Overage logic

### 4. Billing period cutover
- Code that handles month rollover / period reset
- Carryover or credits logic
- Any scheduled jobs for billing period close

### 5. Customer-facing usage display (if applicable)
- Usage meter or dashboard component shown to users
- API endpoint that returns current usage

## Formatting rules

Format each file like this:
\`\`\`
--- path/to/filename.ext ---
[full file contents]
\`\`\`

Separate files with a blank line. If total exceeds 30,000 characters, prioritise event emission and aggregation code, truncate long files to their first 100 lines, and note what was omitted.`,
  }),
  builtin({
    id: 'churn-prevention',
    name: 'Churn Prevention',
    category: 'Monetization',
    description: 'Reviews your churn prevention infrastructure — health scoring, churn signals, cancellation flow design, in-app retention triggers, customer success tooling, winback sequences, and retention analytics — to reduce monthly churn.',
    accentClass: 'text-rose-400 bg-rose-400/10',
    buttonClass: 'bg-rose-600 hover:bg-rose-500 text-white',
    placeholder: `// Paste your churn prevention or cancellation flow code
// e.g. cancellation modal, health scoring logic,
// re-engagement emails, winback flow`,
    systemPrompt: SYSTEM_PROMPTS['churn-prevention'],
    prepPrompt: `I'm preparing code for a **Churn Prevention** audit. Please help me collect and format the relevant files.

## Project context (fill in)
- Billing provider: [e.g. Stripe, Paddle, Chargebee]
- Current churn rate: [e.g. ~4% monthly, unknown]
- Primary churn signal sources: [e.g. Stripe cancellations, in-app surveys, support tickets]
- Stack: [e.g. Next.js, Rails, Django]

## Files to gather

### 1. Cancellation flow
- Cancellation modal or page component
- Cancellation reason survey / offboarding form
- Logic that actually cancels or downgrades the subscription

### 2. Retention interventions
- Pause subscription option (if exists)
- Downgrade offer or plan switch prompt
- Discount / offer presentation on cancellation intent

### 3. Health scoring (if applicable)
- User health score calculation logic
- Engagement or activity tracking queries
- At-risk user identification logic

### 4. Re-engagement / winback sequences
- Churn email templates (at-risk nudge, winback after cancellation)
- Any scheduled jobs that trigger re-engagement

### 5. Analytics hooks (if available)
- Events fired on cancellation intent, cancel confirm, save
- Dashboard queries for churn metrics

## Formatting rules

Format each file like this:
\`\`\`
--- path/to/filename.ext ---
[full file contents]
\`\`\`

Separate files with a blank line. If total exceeds 30,000 characters, prioritise the cancellation flow and retention intervention components, truncate long files to their first 100 lines, and note what was omitted.`,
  }),

  // ── Code Quality (new) ─────────────────────────────────────────
  builtin({
    id: 'naming-conventions',
    name: 'Naming Conventions',
    description: 'Audits variable, function, and file naming for consistency, semantic clarity, and casing conventions.',
    category: 'Code Quality',
    accentClass: 'text-blue-400 hover:bg-blue-500/10',
    buttonClass: 'bg-blue-700 hover:bg-blue-600',
    placeholder: 'Paste your source files, modules, or components to audit naming conventions...',
    systemPrompt: SYSTEM_PROMPTS['naming-conventions'],
    prepPrompt: `I'm preparing code for a **Naming Conventions** audit. Please help me collect the relevant files.

## Project context (fill in)
- Language / framework: [e.g. TypeScript + React, Python + Django, Go 1.22]
- Naming style guide in use (if any): [e.g. Airbnb style guide, PEP 8, Google Go style]
- Areas of concern: [e.g. "inconsistent casing across modules", "abbreviations vs full words"]

## Files to gather
- Core source files from 2–3 modules with the most contributors
- Shared utility and helper files (often the worst naming offenders)
- Type definitions, interfaces, and enum files
- Configuration and constant files
- Any existing naming or style documentation
- A sample test file to check test naming patterns

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'dependency-management',
    name: 'Dependency Management',
    description: 'Reviews package dependencies for outdated versions, license risks, duplicates, and unused packages.',
    category: 'Code Quality',
    accentClass: 'text-blue-400 hover:bg-blue-500/10',
    buttonClass: 'bg-blue-700 hover:bg-blue-600',
    placeholder: 'Paste your package.json, lock file excerpts, or dependency tree output...',
    systemPrompt: SYSTEM_PROMPTS['dependency-management'],
    prepPrompt: `I'm preparing code for a **Dependency Management** audit. Please help me collect the relevant files.

## Project context (fill in)
- Language / package manager: [e.g. npm, yarn, pnpm, pip, cargo, go mod]
- Monorepo or single repo: [e.g. Turborepo with 5 packages, single Next.js app]
- Known concerns: [e.g. "duplicate React versions", "haven't audited licenses", "many unused deps"]

## Files to gather
- package.json / pyproject.toml / go.mod / Cargo.toml (all manifest files)
- Lock file excerpt (first 200 lines of package-lock.json / yarn.lock)
- Output of \`npm ls --depth=1\` or equivalent dependency tree
- Any Renovate / Dependabot configuration files
- Bundler config (webpack/vite/esbuild) for tree-shaking context
- CI dependency caching configuration

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'git-hygiene',
    name: 'Git Hygiene',
    description: 'Audits commit messages, branch strategy, PR size, .gitignore completeness, and merge discipline.',
    category: 'Code Quality',
    accentClass: 'text-blue-400 hover:bg-blue-500/10',
    buttonClass: 'bg-blue-700 hover:bg-blue-600',
    placeholder: 'Paste your .gitignore, recent git log output, branch list, or PR descriptions...',
    systemPrompt: SYSTEM_PROMPTS['git-hygiene'],
    prepPrompt: `I'm preparing code for a **Git Hygiene** audit. Please help me collect the relevant files.

## Project context (fill in)
- Team size and branching model: [e.g. 6 devs, GitHub Flow, trunk-based]
- CI/CD platform: [e.g. GitHub Actions, GitLab CI, CircleCI]
- Known concerns: [e.g. "huge PRs", "no commit message convention", "secrets leaked once"]

## Files to gather
- .gitignore and any nested .gitignore files
- Output of \`git log --oneline -30\` for recent commit message samples
- Output of \`git branch -a\` for branch naming review
- PR template file (.github/pull_request_template.md)
- Branch protection rules or CODEOWNERS file
- CI workflow files that run on PRs

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'code-duplication',
    name: 'Code Duplication',
    description: 'Detects copy-paste code, DRY violations, repeated logic, and extract-and-reuse opportunities.',
    category: 'Code Quality',
    accentClass: 'text-blue-400 hover:bg-blue-500/10',
    buttonClass: 'bg-blue-700 hover:bg-blue-600',
    placeholder: 'Paste source files you suspect contain duplicated logic or repeated patterns...',
    systemPrompt: SYSTEM_PROMPTS['code-duplication'],
    prepPrompt: `I'm preparing code for a **Code Duplication** audit. Please help me collect the relevant files.

## Project context (fill in)
- Language / framework: [e.g. TypeScript + Next.js, Python + FastAPI]
- Areas of suspected duplication: [e.g. "API route handlers are very similar", "form components repeat validation"]
- Codebase age: [e.g. "2 years, 3 major rewrites"]

## Files to gather
- Source files from the module or feature area with suspected duplication
- Similar-looking components, handlers, or services (include 3–5 pairs)
- Shared utility files that may already have extractable helpers
- Any existing shared/common module or base class files
- Test files that repeat setup patterns
- Configuration files that duplicate values across environments

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'complexity-metrics',
    name: 'Complexity Metrics',
    description: 'Measures cyclomatic complexity, cognitive complexity, function length, nesting depth, and file size.',
    category: 'Code Quality',
    accentClass: 'text-blue-400 hover:bg-blue-500/10',
    buttonClass: 'bg-blue-700 hover:bg-blue-600',
    placeholder: 'Paste your most complex source files, longest functions, or deeply nested logic...',
    systemPrompt: SYSTEM_PROMPTS['complexity-metrics'],
    prepPrompt: `I'm preparing code for a **Complexity Metrics** audit. Please help me collect the relevant files.

## Project context (fill in)
- Language / framework: [e.g. TypeScript + React, Java + Spring Boot]
- Hotspot areas: [e.g. "checkout flow", "permission resolver", "report generator"]
- Known pain points: [e.g. "one 800-line function", "deeply nested conditionals in auth"]

## Files to gather
- The 3–5 largest source files by line count
- Files with the most if/else or switch/case branching
- Any functions known to be hard to understand or modify
- Core business logic files (often the most complex)
- Middleware or interceptor chains with layered logic
- Any existing linting output showing complexity warnings

Keep total under 30,000 characters.`,
  }),

  // ── Infrastructure (new) ───────────────────────────────────────
  builtin({
    id: 'kubernetes',
    name: 'Kubernetes',
    description: 'Audits K8s manifests for resource limits, RBAC/ABAC (role and attribute-based access control), probes, pod security, and Helm chart quality.',
    category: 'Infrastructure',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
    placeholder: 'Paste your Kubernetes manifests, Helm charts, or deployment configs...',
    systemPrompt: SYSTEM_PROMPTS['kubernetes'],
    prepPrompt: `I'm preparing code for a **Kubernetes** audit. Please help me collect the relevant files.

## Project context (fill in)
- K8s distribution: [e.g. EKS, GKE, AKS, self-managed, k3s]
- Deployment method: [e.g. Helm, Kustomize, raw manifests, ArgoCD]
- Cluster scale: [e.g. 3 nodes, 20 services, multi-tenant]
- Known concerns: [e.g. "no resource limits set", "RBAC is too permissive"]

## Files to gather
- Deployment, StatefulSet, and DaemonSet manifests
- Service, Ingress, and NetworkPolicy definitions
- RBAC roles, bindings, and service account configs
- Helm values.yaml and Chart.yaml (if using Helm)
- Pod security policies or pod security standards
- HPA/VPA autoscaling configurations

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'terraform-iac',
    name: 'Terraform / IaC',
    description: 'Reviews infrastructure-as-code for state management, module structure, provider versioning, and drift risk.',
    category: 'Infrastructure',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
    placeholder: 'Paste your Terraform files, module definitions, or IaC configurations...',
    systemPrompt: SYSTEM_PROMPTS['terraform-iac'],
    prepPrompt: `I'm preparing code for a **Terraform / IaC** audit. Please help me collect the relevant files.

## Project context (fill in)
- IaC tool: [e.g. Terraform 1.7, OpenTofu, Pulumi, CloudFormation]
- Cloud provider(s): [e.g. AWS, GCP, Azure, multi-cloud]
- State backend: [e.g. S3 + DynamoDB, Terraform Cloud, local]
- Known concerns: [e.g. "state file has drifted", "no module versioning", "secrets in tfvars"]

## Files to gather
- Main Terraform files (main.tf, variables.tf, outputs.tf)
- Provider and backend configuration
- Module definitions and module call sites
- terraform.tfvars or .auto.tfvars (redact secrets)
- State configuration and lock files
- CI/CD pipeline files for plan/apply workflows

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'feature-flags',
    name: 'Feature Flags',
    description: 'Audits feature flag hygiene, stale flags, rollout strategy, cleanup discipline, and dependency chains.',
    category: 'Infrastructure',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
    placeholder: 'Paste your feature flag definitions, flag evaluation code, or flag management configs...',
    systemPrompt: SYSTEM_PROMPTS['feature-flags'],
    prepPrompt: `I'm preparing code for a **Feature Flags** audit. Please help me collect the relevant files.

## Project context (fill in)
- Flag system: [e.g. LaunchDarkly, Unleash, Flipt, custom/homegrown]
- Number of active flags: [e.g. ~30 flags, unknown]
- Cleanup process: [e.g. "we never clean up", "quarterly review", "tech debt tickets"]
- Known concerns: [e.g. "flags from 2 years ago still in code", "nested flag dependencies"]

## Files to gather
- Feature flag configuration or definition files
- Flag evaluation/check code (where flags are consumed)
- Flag provider/context setup code
- Any flag cleanup or lifecycle documentation
- Components or routes with multiple flag checks
- Tests that mock or override feature flags

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'message-queues',
    name: 'Message Queues',
    description: 'Reviews event-driven patterns, dead letter queues, retry/backoff, idempotency, and schema evolution.',
    category: 'Infrastructure',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
    placeholder: 'Paste your message queue producers, consumers, event schemas, or queue configs...',
    systemPrompt: SYSTEM_PROMPTS['message-queues'],
    prepPrompt: `I'm preparing code for a **Message Queues** audit. Please help me collect the relevant files.

## Project context (fill in)
- Queue system: [e.g. RabbitMQ, SQS, Kafka, Redis Streams, BullMQ]
- Message patterns: [e.g. pub/sub, work queues, event sourcing, CQRS]
- Scale: [e.g. ~1000 msgs/sec, 15 consumer services]
- Known concerns: [e.g. "messages getting lost", "no dead letter queue", "duplicate processing"]

## Files to gather
- Message producer/publisher code
- Consumer/subscriber handler code
- Event schema definitions or contracts
- Dead letter queue configuration and handlers
- Retry and backoff logic
- Queue infrastructure configuration (connection, topology)

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'dns-cdn',
    name: 'DNS & CDN',
    description: 'Audits DNS configuration, CDN caching rules, edge routing, TTL strategy, and cache invalidation.',
    category: 'Infrastructure',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
    placeholder: 'Paste your DNS records, CDN configuration, caching rules, or edge routing configs...',
    systemPrompt: SYSTEM_PROMPTS['dns-cdn'],
    prepPrompt: `I'm preparing code for a **DNS & CDN** audit. Please help me collect the relevant files.

## Project context (fill in)
- DNS provider: [e.g. Cloudflare, Route 53, Google Cloud DNS]
- CDN provider: [e.g. Cloudflare, CloudFront, Fastly, Vercel Edge]
- Domain count: [e.g. 3 domains, 12 subdomains]
- Known concerns: [e.g. "cache hit ratio is low", "TTLs are all default", "no cache invalidation strategy"]

## Files to gather
- DNS zone files or record exports
- CDN configuration (caching rules, page rules, edge functions)
- Cache-Control and caching header configuration in application code
- Edge routing or redirect rules
- SSL/TLS certificate configuration
- Any IaC files managing DNS or CDN resources

Keep total under 30,000 characters.`,
  }),

  // ── Design (new) ───────────────────────────────────────────────
  builtin({
    id: 'tooltip-popover',
    name: 'Tooltip & Popover',
    description: 'Audits tooltip timing, popover positioning, touch fallbacks, hover vs click triggers, and accessibility.',
    category: 'Design',
    accentClass: 'text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your tooltip or popover components, trigger logic, or positioning code...',
    systemPrompt: SYSTEM_PROMPTS['tooltip-popover'],
    prepPrompt: `I'm preparing code for a **Tooltip & Popover** audit. Please help me collect the relevant files.

## Project context (fill in)
- UI framework: [e.g. React + Radix, Vue + Headless UI, Svelte]
- Tooltip/popover library: [e.g. Floating UI, Tippy.js, custom built]
- Touch device support required: [yes/no]
- Known concerns: [e.g. "tooltips clip on mobile", "no keyboard access", "inconsistent delay timing"]

## Files to gather
- Tooltip and popover component source files
- Trigger/wrapper components that invoke tooltips
- Positioning and portal logic
- CSS/styles for tooltip appearance and animation
- Accessibility-related ARIA attribute usage
- Mobile or touch-specific tooltip handling

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'file-upload',
    name: 'File Upload',
    description: 'Reviews upload UX including drag-to-upload, progress indicators, file validation, and error recovery.',
    category: 'Design',
    accentClass: 'text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your file upload components, dropzone logic, or upload handler code...',
    systemPrompt: SYSTEM_PROMPTS['file-upload'],
    prepPrompt: `I'm preparing code for a **File Upload** audit. Please help me collect the relevant files.

## Project context (fill in)
- UI framework: [e.g. React, Vue, Svelte]
- Upload destination: [e.g. S3 presigned URLs, direct server upload, Cloudinary]
- File types supported: [e.g. images only, documents, any file type]
- Known concerns: [e.g. "no progress bar", "drag-drop doesn't work on mobile", "large files fail silently"]

## Files to gather
- File upload / dropzone component source
- Upload progress and status indicator components
- File validation logic (size limits, type checking, virus scanning)
- Server-side upload handler or presigned URL generation
- Error handling and retry logic for failed uploads
- Any thumbnail preview or file processing code

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'date-time-picker',
    name: 'Date & Time Picker',
    description: 'Audits date/time input patterns, timezone handling, locale formatting, and calendar accessibility.',
    category: 'Design',
    accentClass: 'text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your date picker components, timezone handling, or calendar UI code...',
    systemPrompt: SYSTEM_PROMPTS['date-time-picker'],
    prepPrompt: `I'm preparing code for a **Date & Time Picker** audit. Please help me collect the relevant files.

## Project context (fill in)
- UI framework: [e.g. React, Vue, Angular]
- Date library: [e.g. date-fns, Day.js, Luxon, native Intl API]
- Timezone requirements: [e.g. multi-timezone, UTC only, user-local]
- Known concerns: [e.g. "timezone bugs", "calendar not keyboard accessible", "locale formatting wrong"]

## Files to gather
- Date and time picker component source files
- Calendar/date grid rendering components
- Timezone conversion and display utilities
- Locale and internationalization configuration
- Date validation and range-checking logic
- Any date formatting helper functions

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'breadcrumb-wayfinding',
    name: 'Breadcrumb & Wayfinding',
    description: 'Reviews breadcrumbs, back-button behavior, location awareness, and navigation hierarchy clarity.',
    category: 'Design',
    accentClass: 'text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your breadcrumb components, navigation hierarchy, or routing configuration...',
    systemPrompt: SYSTEM_PROMPTS['breadcrumb-wayfinding'],
    prepPrompt: `I'm preparing code for a **Breadcrumb & Wayfinding** audit. Please help me collect the relevant files.

## Project context (fill in)
- UI framework and router: [e.g. Next.js App Router, React Router, Vue Router]
- Navigation depth: [e.g. 3 levels, deeply nested admin panels]
- Breadcrumb generation: [e.g. manual per-page, auto from route, CMS-driven]
- Known concerns: [e.g. "breadcrumbs don't match URL", "back button breaks", "users get lost"]

## Files to gather
- Breadcrumb component source files
- Route/page hierarchy configuration
- Layout components that render navigation chrome
- Back-button or history management logic
- Page title and meta/heading management
- Any sitemap or navigation tree data structures

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'dashboard-layout',
    name: 'Dashboard Layout',
    description: 'Audits dashboard composition, widget density, data hierarchy, KPI prominence, and responsive grid patterns.',
    category: 'Design',
    accentClass: 'text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste your dashboard page components, widget/card layouts, or grid system code...',
    systemPrompt: SYSTEM_PROMPTS['dashboard-layout'],
    prepPrompt: `I'm preparing code for a **Dashboard Layout** audit. Please help me collect the relevant files.

## Project context (fill in)
- UI framework: [e.g. React + Tailwind, Vue + Vuetify, Angular Material]
- Dashboard purpose: [e.g. analytics, admin panel, customer portal, internal ops]
- Grid system: [e.g. CSS Grid, flexbox, charting library grid]
- Known concerns: [e.g. "too many widgets", "not responsive", "KPIs buried below fold"]

## Files to gather
- Main dashboard page/layout component
- Individual widget or card components (3–5 examples)
- Grid or layout system configuration
- Data fetching hooks or services for dashboard data
- Responsive breakpoint and media query handling
- Any dashboard customization or widget arrangement logic

Keep total under 30,000 characters.`,
  }),

  // ── AI / LLM ───────────────────────────────────────────────────
  builtin({
    id: 'prompt-engineering',
    name: 'Prompt Engineering',
    description: 'Reviews LLM prompt quality, injection defense, output parsing, few-shot patterns, and token efficiency.',
    category: 'AI / LLM',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your LLM prompt templates, completion handlers, or prompt construction code...',
    systemPrompt: SYSTEM_PROMPTS['prompt-engineering'],
    prepPrompt: `I'm preparing code for a **Prompt Engineering** audit. Please help me collect the relevant files.

## Project context (fill in)
- LLM provider(s): [e.g. OpenAI, Anthropic, local Llama, multiple]
- Use case: [e.g. chatbot, code generation, content summarization, data extraction]
- Prompt management: [e.g. hardcoded strings, template files, prompt management platform]
- Known concerns: [e.g. "prompt injection risk", "output is inconsistent", "token costs too high"]

## Files to gather
- All prompt templates and system prompt definitions
- LLM API call wrappers and completion handlers
- Output parsing and validation logic
- Any prompt injection defense or input sanitization
- Few-shot example definitions
- Token counting or context window management code

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'ai-safety',
    name: 'AI Safety',
    description: 'Audits AI guardrails, content filtering, bias detection, hallucination mitigation, and abuse prevention.',
    category: 'AI / LLM',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your AI safety guardrails, content filters, or moderation pipeline code...',
    systemPrompt: SYSTEM_PROMPTS['ai-safety'],
    prepPrompt: `I'm preparing code for an **AI Safety** audit. Please help me collect the relevant files.

## Project context (fill in)
- AI features in product: [e.g. chatbot, content generation, recommendation engine]
- Moderation approach: [e.g. pre/post filtering, human-in-the-loop, none yet]
- User-facing AI: [yes/no, and whether users can provide free-form input]
- Known concerns: [e.g. "no content filtering", "hallucinated links", "potential for abuse"]

## Files to gather
- Content filtering and moderation logic
- Input validation and sanitization for AI inputs
- Output validation and safety checking code
- Bias detection or fairness evaluation code
- Rate limiting and abuse prevention for AI endpoints
- Logging and monitoring configuration for AI outputs

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'rag-patterns',
    name: 'RAG Patterns',
    description: 'Reviews retrieval-augmented generation architecture, chunking strategy, embedding quality, and citation accuracy.',
    category: 'AI / LLM',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your RAG pipeline code, embedding logic, vector store queries, or retrieval chains...',
    systemPrompt: SYSTEM_PROMPTS['rag-patterns'],
    prepPrompt: `I'm preparing code for a **RAG Patterns** audit. Please help me collect the relevant files.

## Project context (fill in)
- Vector store: [e.g. Pinecone, Weaviate, pgvector, Chroma, FAISS]
- Embedding model: [e.g. OpenAI text-embedding-3, Cohere, local model]
- Document types: [e.g. PDFs, markdown docs, database records, web pages]
- Known concerns: [e.g. "retrieval misses relevant docs", "chunks too large", "no citation tracking"]

## Files to gather
- Document ingestion and chunking pipeline
- Embedding generation and storage code
- Vector similarity search and retrieval logic
- Context assembly and prompt construction with retrieved docs
- Citation extraction and source attribution code
- Any re-ranking or relevance scoring logic

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'ai-ux',
    name: 'AI UX',
    description: 'Audits AI-powered feature UX including confidence display, streaming output, error communication, and feedback loops.',
    category: 'AI / LLM',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your AI-powered UI components, streaming handlers, or AI feature interaction code...',
    systemPrompt: SYSTEM_PROMPTS['ai-ux'],
    prepPrompt: `I'm preparing code for an **AI UX** audit. Please help me collect the relevant files.

## Project context (fill in)
- AI feature type: [e.g. chat interface, autocomplete, content generator, search]
- Streaming support: [yes/no, and which protocol — SSE, WebSocket, etc.]
- User feedback mechanism: [e.g. thumbs up/down, regenerate button, none]
- Known concerns: [e.g. "no loading state for AI", "errors show raw API messages", "no confidence indicators"]

## Files to gather
- AI-powered UI components (chat, suggestions, completions)
- Streaming response handling and progressive rendering
- Loading, error, and empty state components for AI features
- User feedback collection components (ratings, corrections)
- Confidence or uncertainty display logic
- Fallback and graceful degradation when AI is unavailable

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'llm-cost',
    name: 'LLM Cost Optimization',
    description: 'Reviews token usage, model selection strategy, prompt/response caching, batching, and cost monitoring.',
    category: 'AI / LLM',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your LLM API integration code, caching logic, or cost tracking implementation...',
    systemPrompt: SYSTEM_PROMPTS['llm-cost'],
    prepPrompt: `I'm preparing code for an **LLM Cost Optimization** audit. Please help me collect the relevant files.

## Project context (fill in)
- LLM provider(s) and models: [e.g. GPT-4o, Claude Sonnet, mixed models]
- Monthly LLM spend: [e.g. $500, $10K, unknown]
- Caching strategy: [e.g. semantic cache, exact match, none]
- Known concerns: [e.g. "costs spiking", "no caching", "using GPT-4 for everything", "no token tracking"]

## Files to gather
- LLM API client wrapper and configuration
- Model selection and routing logic
- Prompt and response caching implementation
- Token counting and budget enforcement code
- Request batching or queue management
- Cost monitoring, logging, and alerting setup

Keep total under 30,000 characters.`,
  }),

  // ── AI / LLM (batch 2) ────────────────────────────────────────────────

  builtin({
    id: 'agent-patterns',
    name: 'Agent Patterns',
    description: 'Audits multi-agent orchestration, tool use design, memory management, planning loops, and error recovery.',
    category: 'AI / LLM',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your agent orchestration code, tool definitions, or planning logic...',
    systemPrompt: SYSTEM_PROMPTS['agent-patterns'],
    prepPrompt: `I'm preparing code for an **Agent Patterns** audit. Please help me collect the relevant files.

## Project context (fill in)
- Agent framework: [e.g. LangGraph, CrewAI, AutoGen, custom]
- Number of agents: [e.g. single agent, 3 specialized agents, dynamic spawning]
- Tool use approach: [e.g. function calling, ReAct loop, custom tool executor]
- Memory/state management: [e.g. in-memory, Redis, database-backed]
- Known concerns: [e.g. "agents loop forever", "no error recovery", "tool calls fail silently"]

## Files to gather
- Agent definition and orchestration code
- Tool registration and execution logic
- Memory and state management implementation
- Planning loop and decision-making logic
- Error recovery and retry mechanisms
- Inter-agent communication or delegation code

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'llm-evaluation',
    name: 'LLM Evaluation',
    description: 'Reviews eval frameworks, prompt regression testing, benchmark design, golden datasets, and continuous evaluation.',
    category: 'AI / LLM',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your eval scripts, test cases, scoring rubrics, or benchmark configs...',
    systemPrompt: SYSTEM_PROMPTS['llm-evaluation'],
    prepPrompt: `I'm preparing code for an **LLM Evaluation** audit. Please help me collect the relevant files.

## Project context (fill in)
- Eval framework: [e.g. custom scripts, promptfoo, Braintrust, LangSmith]
- Model(s) under evaluation: [e.g. GPT-4o, Claude Sonnet, fine-tuned model]
- Eval types: [e.g. accuracy, safety, latency, cost, hallucination detection]
- Golden dataset size: [e.g. 50 cases, 500 cases, none yet]
- Known concerns: [e.g. "no regression tests", "evals not in CI", "subjective scoring"]

## Files to gather
- Eval scripts and test runners
- Golden dataset or test case definitions
- Scoring rubrics and grading logic
- Benchmark configuration files
- CI integration for eval pipelines
- Prompt versioning and regression detection code

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'ai-ethics',
    name: 'AI Ethics',
    description: 'Audits AI fairness, transparency, explainability, bias testing, consent mechanisms, and harm mitigation.',
    category: 'AI / LLM',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your AI feature code, model integration, or content filtering logic...',
    systemPrompt: SYSTEM_PROMPTS['ai-ethics'],
    prepPrompt: `I'm preparing code for an **AI Ethics** audit. Please help me collect the relevant files.

## Project context (fill in)
- AI use case: [e.g. content moderation, hiring decisions, recommendations, medical triage]
- User population: [e.g. general public, enterprise, children, vulnerable groups]
- Transparency measures: [e.g. "AI-generated" labels, explainability features, none]
- Bias testing: [e.g. fairness benchmarks, demographic parity checks, none]
- Known concerns: [e.g. "no consent mechanism", "opaque decisions", "potential demographic bias"]

## Files to gather
- AI feature integration and decision-making code
- Content filtering and safety guardrails
- Bias testing and fairness evaluation scripts
- User consent and disclosure mechanisms
- Explainability or transparency feature code
- Harm mitigation and appeal/override logic

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'vector-search',
    name: 'Vector Search',
    description: 'Reviews vector DB usage, embedding strategies, hybrid search, reranking pipelines, and index optimization.',
    category: 'AI / LLM',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your vector DB queries, embedding code, or search pipeline...',
    systemPrompt: SYSTEM_PROMPTS['vector-search'],
    prepPrompt: `I'm preparing code for a **Vector Search** audit. Please help me collect the relevant files.

## Project context (fill in)
- Vector database: [e.g. Pinecone, Weaviate, Qdrant, pgvector, Milvus]
- Embedding model: [e.g. OpenAI text-embedding-3-small, Cohere embed-v3, custom]
- Search type: [e.g. pure vector, hybrid with keyword, filtered vector search]
- Index size: [e.g. 10K vectors, 1M vectors, 100M+]
- Known concerns: [e.g. "slow queries", "poor relevance", "no reranking", "index not optimized"]

## Files to gather
- Embedding generation and storage code
- Vector DB client configuration and index setup
- Search query construction and execution logic
- Reranking or relevance scoring pipeline
- Hybrid search (keyword + vector) integration
- Index management and optimization scripts

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'ai-streaming',
    name: 'AI Streaming',
    description: 'Audits LLM streaming implementation, token rendering, abort handling, retry logic, and streaming error UX.',
    category: 'AI / LLM',
    accentClass: 'text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
    placeholder: 'Paste your streaming API routes, SSE handlers, or token rendering components...',
    systemPrompt: SYSTEM_PROMPTS['ai-streaming'],
    prepPrompt: `I'm preparing code for an **AI Streaming** audit. Please help me collect the relevant files.

## Project context (fill in)
- Streaming protocol: [e.g. SSE, WebSocket, fetch streaming, Vercel AI SDK]
- LLM provider: [e.g. OpenAI, Anthropic, self-hosted]
- Frontend framework: [e.g. React, Next.js, Vue, vanilla JS]
- Abort support: [e.g. AbortController, manual cancel, none]
- Known concerns: [e.g. "tokens flicker", "no abort button", "errors swallowed during stream", "memory leak on long streams"]

## Files to gather
- Streaming API route or server handler
- SSE or WebSocket connection management
- Client-side stream consumption and token rendering
- Abort and cancellation handling
- Retry and reconnection logic
- Error handling during active streams

Keep total under 30,000 characters.`,
  }),

  // ── Testing ────────────────────────────────────────────────────────────

  builtin({
    id: 'e2e-testing',
    name: 'E2E Testing',
    description: 'Reviews Playwright/Cypress test patterns, page objects, test stability, CI integration, and flake detection.',
    category: 'Testing',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-700 hover:bg-amber-600',
    placeholder: 'Paste your e2e test files, page objects, or test configuration...',
    systemPrompt: SYSTEM_PROMPTS['e2e-testing'],
    prepPrompt: `I'm preparing code for an **E2E Testing** audit. Please help me collect the relevant files.

## Project context (fill in)
- E2E framework: [e.g. Playwright, Cypress, Selenium, Puppeteer]
- Application type: [e.g. SPA, SSR, mobile web, desktop app]
- CI runner: [e.g. GitHub Actions, CircleCI, Jenkins]
- Test count: [e.g. 20 tests, 200 tests, 1000+]
- Known concerns: [e.g. "flaky tests", "slow CI", "no page objects", "tests break on UI changes"]

## Files to gather
- E2E test files (representative sample of different patterns)
- Page object or component abstraction files
- Test configuration (playwright.config.ts, cypress.config.js)
- CI workflow files for E2E test execution
- Test fixture and data setup utilities
- Any flake detection or retry configuration

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'load-testing',
    name: 'Load Testing',
    description: 'Audits load test scripts, scenario design, ramp-up patterns, SLA (uptime guarantee) validation, and bottleneck identification.',
    category: 'Testing',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-700 hover:bg-amber-600',
    placeholder: 'Paste your k6, Artillery, or JMeter test scripts and configs...',
    systemPrompt: SYSTEM_PROMPTS['load-testing'],
    prepPrompt: `I'm preparing code for a **Load Testing** audit. Please help me collect the relevant files.

## Project context (fill in)
- Load testing tool: [e.g. k6, Artillery, JMeter, Locust, Gatling]
- Target system: [e.g. REST API, GraphQL, WebSocket, full web app]
- Current SLAs: [e.g. p99 < 200ms, 1000 RPS, 99.9% uptime]
- Test environment: [e.g. staging, dedicated perf env, production shadow]
- Known concerns: [e.g. "never load tested", "no SLAs defined", "tests don't match real traffic", "results not tracked over time"]

## Files to gather
- Load test scripts and scenario definitions
- Test configuration and environment setup
- Ramp-up and traffic pattern definitions
- SLA threshold and assertion configs
- CI integration for performance testing
- Results analysis or reporting scripts

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'contract-testing',
    name: 'Contract Testing',
    description: 'Reviews consumer-driven contracts, API compatibility checks, schema evolution, and breaking change detection.',
    category: 'Testing',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-700 hover:bg-amber-600',
    placeholder: 'Paste your Pact contracts, API schemas, or provider verification tests...',
    systemPrompt: SYSTEM_PROMPTS['contract-testing'],
    prepPrompt: `I'm preparing code for a **Contract Testing** audit. Please help me collect the relevant files.

## Project context (fill in)
- Contract testing tool: [e.g. Pact, Spring Cloud Contract, Specmatic, custom]
- API style: [e.g. REST, GraphQL, gRPC, event-driven]
- Number of services: [e.g. 2 services, microservices (10+), monolith with external APIs]
- Schema format: [e.g. OpenAPI, Protobuf, JSON Schema, Avro]
- Known concerns: [e.g. "no contract tests", "breaking changes reach prod", "schema drift between services"]

## Files to gather
- Contract definition files (Pact JSON, OpenAPI specs, Protobuf)
- Consumer test files generating contracts
- Provider verification test files
- Schema evolution and versioning configuration
- CI pipeline for contract verification
- Breaking change detection setup

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'visual-regression',
    name: 'Visual Regression',
    description: 'Audits screenshot testing setup, component snapshots, cross-browser visual QA, and baseline management.',
    category: 'Testing',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-700 hover:bg-amber-600',
    placeholder: 'Paste your visual regression test config, snapshot tests, or Percy/Chromatic setup...',
    systemPrompt: SYSTEM_PROMPTS['visual-regression'],
    prepPrompt: `I'm preparing code for a **Visual Regression** audit. Please help me collect the relevant files.

## Project context (fill in)
- Visual testing tool: [e.g. Percy, Chromatic, BackstopJS, Playwright screenshots, reg-suit]
- Component library: [e.g. Storybook, custom, none]
- Browser targets: [e.g. Chrome only, Chrome + Firefox + Safari, mobile browsers]
- Baseline management: [e.g. auto-approve on main, manual review, cloud-managed]
- Known concerns: [e.g. "too many false positives", "no visual tests", "flaky screenshots", "slow pipeline"]

## Files to gather
- Visual regression test configuration
- Screenshot capture test files
- Baseline image management setup
- Storybook or component showcase configuration
- CI integration for visual testing
- Threshold and diff sensitivity settings

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'test-architecture',
    name: 'Test Architecture',
    description: 'Reviews test pyramid balance, fixture management, test data factories, mock strategy, and coverage approach.',
    category: 'Testing',
    accentClass: 'text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-700 hover:bg-amber-600',
    placeholder: 'Paste your test directory structure, shared fixtures, factories, or test utilities...',
    systemPrompt: SYSTEM_PROMPTS['test-architecture'],
    prepPrompt: `I'm preparing code for a **Test Architecture** audit. Please help me collect the relevant files.

## Project context (fill in)
- Test frameworks: [e.g. Jest, Vitest, pytest, Go testing, JUnit]
- Test types in use: [e.g. unit, integration, e2e, contract, visual]
- Coverage target: [e.g. 80%, no target, per-module targets]
- Mock approach: [e.g. jest.mock, MSW, dependency injection, test doubles]
- Known concerns: [e.g. "too many mocks", "slow test suite", "no test data factories", "coverage gaps in critical paths"]

## Files to gather
- Test configuration files (jest.config, vitest.config, pytest.ini)
- Shared test utilities and helper functions
- Test data factories and fixture definitions
- Mock setup and shared test doubles
- Coverage configuration and reports
- Representative test files from each test layer (unit, integration, e2e)

Keep total under 30,000 characters.`,
  }),

  // ── Data Engineering ───────────────────────────────────────────────────

  builtin({
    id: 'data-modeling',
    name: 'Data Modeling',
    description: 'Audits schema design, normalization decisions, entity relationships, index strategy, and migration planning.',
    category: 'Data Engineering',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
    placeholder: 'Paste your database schema, migration files, or entity relationship definitions...',
    systemPrompt: SYSTEM_PROMPTS['data-modeling'],
    prepPrompt: `I'm preparing code for a **Data Modeling** audit. Please help me collect the relevant files.

## Project context (fill in)
- Database type: [e.g. PostgreSQL, MySQL, MongoDB, DynamoDB, multi-database]
- ORM/query builder: [e.g. Prisma, Drizzle, SQLAlchemy, TypeORM, raw SQL]
- Schema size: [e.g. 10 tables, 50 tables, 200+ tables]
- Data volume: [e.g. thousands of rows, millions, billions]
- Known concerns: [e.g. "over-normalized", "missing indexes", "no migration strategy", "schema drift between environments"]

## Files to gather
- Database schema definitions (SQL DDL, Prisma schema, etc.)
- Migration files (recent and any problematic ones)
- Entity relationship or model definitions
- Index definitions and query patterns
- Seed data or fixture scripts
- Any schema documentation or ERD definitions

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'etl-pipelines',
    name: 'ETL Pipelines',
    description: 'Reviews data pipeline quality, transformation correctness, scheduling, error handling, and idempotency.',
    category: 'Data Engineering',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
    placeholder: 'Paste your ETL scripts, Airflow DAGs, dbt models, or pipeline configs...',
    systemPrompt: SYSTEM_PROMPTS['etl-pipelines'],
    prepPrompt: `I'm preparing code for an **ETL Pipelines** audit. Please help me collect the relevant files.

## Project context (fill in)
- Pipeline framework: [e.g. Airflow, dbt, Prefect, Dagster, custom scripts]
- Data sources: [e.g. PostgreSQL, S3, APIs, Kafka, flat files]
- Data destinations: [e.g. data warehouse, analytics DB, S3, Elasticsearch]
- Schedule frequency: [e.g. hourly, daily, real-time, event-driven]
- Known concerns: [e.g. "pipelines not idempotent", "silent failures", "no data validation", "slow transformations"]

## Files to gather
- Pipeline definitions (DAGs, workflow files, dbt models)
- Extraction and data source connection code
- Transformation logic and business rules
- Loading and destination write code
- Error handling and retry configuration
- Scheduling and orchestration configuration

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'data-quality',
    name: 'Data Quality',
    description: 'Audits validation rules, data profiling, anomaly detection, freshness monitoring, and schema drift detection.',
    category: 'Data Engineering',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
    placeholder: 'Paste your data validation logic, quality checks, or monitoring configs...',
    systemPrompt: SYSTEM_PROMPTS['data-quality'],
    prepPrompt: `I'm preparing code for a **Data Quality** audit. Please help me collect the relevant files.

## Project context (fill in)
- Data quality tool: [e.g. Great Expectations, dbt tests, Soda, custom checks]
- Data platform: [e.g. Snowflake, BigQuery, PostgreSQL, Databricks]
- Validation approach: [e.g. schema validation, statistical checks, rule-based, none]
- Monitoring: [e.g. freshness alerts, anomaly detection, dashboard, none]
- Known concerns: [e.g. "no data validation", "stale data not detected", "schema changes break downstream", "duplicate records"]

## Files to gather
- Data validation rules and check definitions
- Data profiling and statistical analysis scripts
- Freshness and staleness monitoring configuration
- Schema drift detection setup
- Anomaly detection and alerting configuration
- Data quality dashboard or reporting code

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'data-governance',
    name: 'Data Governance',
    description: 'Reviews data lineage, catalog practices, ownership, retention policies, PII classification, and access controls.',
    category: 'Data Engineering',
    accentClass: 'text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
    placeholder: 'Paste your data catalog config, access policies, or retention rule definitions...',
    systemPrompt: SYSTEM_PROMPTS['data-governance'],
    prepPrompt: `I'm preparing code for a **Data Governance** audit. Please help me collect the relevant files.

## Project context (fill in)
- Data catalog tool: [e.g. DataHub, Amundsen, Atlan, custom metadata store]
- Compliance requirements: [e.g. GDPR, CCPA, HIPAA, SOC 2, none specific]
- PII handling: [e.g. encryption, masking, tokenization, classification tags]
- Data ownership model: [e.g. domain-based, team-based, none defined]
- Known concerns: [e.g. "no data lineage", "PII not classified", "no retention policies", "access controls too broad"]

## Files to gather
- Data catalog or metadata configuration
- Access control policies and role definitions
- PII classification and tagging logic
- Data retention and deletion policies
- Data lineage tracking setup
- Ownership and stewardship documentation or config

Keep total under 30,000 characters.`,
  }),

  // ── Infrastructure (batch 2) ───────────────────────────────────────────

  builtin({
    id: 'api-gateway',
    name: 'API Gateway',
    description: 'Audits gateway configuration, request routing, edge rate limiting, request transformation, and authentication.',
    category: 'Infrastructure',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
    placeholder: 'Paste your API gateway config (Kong, AWS API Gateway, Traefik, nginx)...',
    systemPrompt: SYSTEM_PROMPTS['api-gateway'],
    prepPrompt: `I'm preparing code for an **API Gateway** audit. Please help me collect the relevant files.

## Project context (fill in)
- Gateway solution: [e.g. Kong, AWS API Gateway, Traefik, nginx, Envoy, custom]
- Architecture: [e.g. single gateway, multi-gateway, BFF pattern]
- Auth at gateway: [e.g. JWT validation, API key, OAuth2, mTLS, none]
- Rate limiting: [e.g. per-user, per-IP, per-API-key, none]
- Known concerns: [e.g. "no rate limiting", "auth bypassed at gateway", "routing too complex", "no request validation"]

## Files to gather
- Gateway configuration files (kong.yml, nginx.conf, traefik.yml)
- Route definitions and upstream mappings
- Authentication and authorization middleware
- Rate limiting and throttling configuration
- Request/response transformation rules
- Health check and circuit breaker setup

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'secrets-management',
    name: 'Secrets Management',
    description: 'Reviews Vault/KMS usage, rotation policies, access patterns, least privilege, and secret lifecycle management.',
    category: 'Infrastructure',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
    placeholder: 'Paste your secrets management config, Vault policies, or KMS setup (never paste actual secrets)...',
    systemPrompt: SYSTEM_PROMPTS['secrets-management'],
    prepPrompt: `I'm preparing code for a **Secrets Management** audit. Please help me collect the relevant files.

## Project context (fill in)
- Secrets solution: [e.g. HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, doppler]
- Secret types: [e.g. API keys, database credentials, TLS certs, signing keys]
- Rotation policy: [e.g. 90-day rotation, auto-rotation, manual, none]
- Access model: [e.g. per-service identity, shared secrets, environment variables]
- Known concerns: [e.g. "secrets in env vars", "no rotation", "shared credentials", "secrets in git history"]

## Files to gather
- Secrets management configuration (Vault policies, IAM roles)
- Secret access patterns in application code (never paste actual secret values)
- Rotation automation scripts or configuration
- CI/CD secret injection setup
- .gitignore and secret scanning configuration
- Access audit logging setup

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'backup-recovery',
    name: 'Backup & Recovery',
    description: 'Audits backup strategy, disaster recovery plans, RTO/RPO targets, restore testing, and geo-redundancy.',
    category: 'Infrastructure',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
    placeholder: 'Paste your backup configs, DR runbooks, or recovery procedure documentation...',
    systemPrompt: SYSTEM_PROMPTS['backup-recovery'],
    prepPrompt: `I'm preparing code for a **Backup & Recovery** audit. Please help me collect the relevant files.

## Project context (fill in)
- Data stores: [e.g. PostgreSQL, MongoDB, S3, Redis, Elasticsearch]
- Backup method: [e.g. automated snapshots, pg_dump, WAL archiving, manual]
- RTO/RPO targets: [e.g. RTO 1hr / RPO 15min, not defined]
- Recovery testing: [e.g. quarterly DR drills, never tested, automated restore tests]
- Known concerns: [e.g. "never tested restore", "no offsite backups", "RPO undefined", "no DR plan"]

## Files to gather
- Backup automation scripts and schedules
- Disaster recovery runbooks or procedures
- Infrastructure-as-code for backup resources (Terraform, CloudFormation)
- Restore verification and testing scripts
- Monitoring and alerting for backup health
- Geo-redundancy and replication configuration

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'service-mesh',
    name: 'Service Mesh',
    description: 'Reviews Istio/Linkerd configuration, mTLS, traffic management, distributed tracing, and circuit breaking.',
    category: 'Infrastructure',
    accentClass: 'text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
    placeholder: 'Paste your service mesh configs, VirtualService definitions, or DestinationRules...',
    systemPrompt: SYSTEM_PROMPTS['service-mesh'],
    prepPrompt: `I'm preparing code for a **Service Mesh** audit. Please help me collect the relevant files.

## Project context (fill in)
- Service mesh: [e.g. Istio, Linkerd, Consul Connect, AWS App Mesh, custom]
- Cluster setup: [e.g. single cluster, multi-cluster, multi-cloud]
- mTLS status: [e.g. strict mode, permissive, not enabled]
- Traffic management: [e.g. canary deployments, traffic splitting, fault injection]
- Known concerns: [e.g. "mTLS not enforced", "no circuit breaking", "sidecar overhead too high", "tracing gaps"]

## Files to gather
- Service mesh installation and configuration
- VirtualService, DestinationRule, and Gateway definitions
- mTLS and PeerAuthentication policies
- Traffic management and routing rules
- Distributed tracing configuration
- Circuit breaker and retry policy definitions

Keep total under 30,000 characters.`,
  }),

  // ── Monetization (batch 2) ─────────────────────────────────────────────

  builtin({
    id: 'payment-integration',
    name: 'Payment Integration',
    description: 'Audits Stripe/payment gateway implementation, webhook idempotency, PCI scope, and SCA/3DS compliance.',
    category: 'Monetization',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-700 hover:bg-yellow-600',
    placeholder: 'Paste your payment integration code, webhook handlers, or checkout flow...',
    systemPrompt: SYSTEM_PROMPTS['payment-integration'],
    prepPrompt: `I'm preparing code for a **Payment Integration** audit. Please help me collect the relevant files.

## Project context (fill in)
- Payment provider: [e.g. Stripe, Braintree, Adyen, PayPal, Square]
- Payment types: [e.g. one-time charges, subscriptions, metered billing, marketplace payouts]
- PCI scope: [e.g. SAQ-A (hosted checkout), SAQ-A-EP (client-side tokenization), SAQ-D]
- SCA/3DS: [e.g. enabled, not implemented, EU customers only]
- Known concerns: [e.g. "webhook failures", "no idempotency", "PCI scope unclear", "double charges reported"]

## Files to gather
- Payment gateway integration and client setup
- Checkout flow and payment intent creation
- Webhook handler and event processing code
- Idempotency key generation and dedup logic
- Refund and dispute handling code
- Payment-related database models and state machines

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'usage-tracking',
    name: 'Usage Tracking',
    description: 'Reviews metering accuracy, usage event ingestion, quota enforcement, overage handling, and billing reconciliation.',
    category: 'Monetization',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-700 hover:bg-yellow-600',
    placeholder: 'Paste your usage metering code, event tracking, or quota enforcement logic...',
    systemPrompt: SYSTEM_PROMPTS['usage-tracking'],
    prepPrompt: `I'm preparing code for a **Usage Tracking** audit. Please help me collect the relevant files.

## Project context (fill in)
- Metering approach: [e.g. real-time counters, event log aggregation, periodic batch]
- Usage dimensions: [e.g. API calls, storage, compute time, tokens, seats]
- Billing integration: [e.g. Stripe metered billing, custom invoicing, usage-based pricing]
- Quota enforcement: [e.g. hard limits, soft limits with overage, no enforcement]
- Known concerns: [e.g. "metering inaccurate", "no quota enforcement", "billing reconciliation gaps", "events lost under load"]

## Files to gather
- Usage event emission and ingestion code
- Metering aggregation and counting logic
- Quota enforcement and limit checking code
- Overage detection and handling
- Billing reconciliation and invoice generation
- Usage dashboard and reporting queries

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'invoice-receipts',
    name: 'Invoice & Receipts',
    description: 'Audits invoice generation, tax calculation, receipt emails, credit notes, and compliance with VAT/GST rules.',
    category: 'Monetization',
    accentClass: 'text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-700 hover:bg-yellow-600',
    placeholder: 'Paste your invoice generation code, receipt templates, or tax calculation logic...',
    systemPrompt: SYSTEM_PROMPTS['invoice-receipts'],
    prepPrompt: `I'm preparing code for an **Invoice & Receipts** audit. Please help me collect the relevant files.

## Project context (fill in)
- Invoice generation: [e.g. Stripe Invoicing, custom PDF generation, third-party service]
- Tax calculation: [e.g. Stripe Tax, TaxJar, Avalara, manual rates, none]
- Jurisdictions: [e.g. US only, EU (VAT), global, B2B reverse charge]
- Receipt delivery: [e.g. email, in-app download, both]
- Known concerns: [e.g. "tax not calculated", "no credit notes", "invoices missing required fields", "VAT compliance gaps"]

## Files to gather
- Invoice generation and PDF rendering code
- Tax calculation and rate determination logic
- Receipt email templates and delivery code
- Credit note and refund documentation logic
- Invoice numbering and sequential ID generation
- Tax reporting and compliance export code

Keep total under 30,000 characters.`,
  }),

  // ── Developer Experience ───────────────────────────────────────────────

  builtin({
    id: 'readme-quality',
    name: 'README Quality',
    description: 'Audits README completeness, getting-started instructions, examples, badges, and contribution guidelines.',
    category: 'Developer Experience',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your README.md, CONTRIBUTING.md, or project documentation...',
    systemPrompt: SYSTEM_PROMPTS['readme-quality'],
    prepPrompt: `I'm preparing content for a **README Quality** audit. Please help me collect the relevant files.

## Project context (fill in)
- Project type: [e.g. open-source library, internal tool, SaaS product, CLI tool]
- Target audience: [e.g. external developers, internal team, open-source community]
- Current README status: [e.g. minimal, outdated, comprehensive but messy]
- Documentation elsewhere: [e.g. docs site, wiki, none]
- Known concerns: [e.g. "no getting started guide", "examples outdated", "missing contribution guidelines", "no badges"]

## Files to gather
- README.md (full contents)
- CONTRIBUTING.md (if it exists)
- CHANGELOG.md or release notes
- package.json / pyproject.toml (for project metadata)
- Any docs/ folder index or table of contents
- LICENSE file

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'sdk-design',
    name: 'SDK Design',
    description: 'Reviews SDK ergonomics, method naming, error messages, type exports, versioning, and tree-shaking support.',
    category: 'Developer Experience',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your SDK source code, public API surface, or package.json...',
    systemPrompt: SYSTEM_PROMPTS['sdk-design'],
    prepPrompt: `I'm preparing code for an **SDK Design** audit. Please help me collect the relevant files.

## Project context (fill in)
- SDK language: [e.g. TypeScript, Python, Go, Java, multi-language]
- Distribution: [e.g. npm, PyPI, Maven, private registry]
- API style: [e.g. REST wrapper, GraphQL client, WebSocket, RPC]
- Versioning: [e.g. semver, calver, no formal versioning]
- Known concerns: [e.g. "poor error messages", "no tree-shaking", "types not exported", "breaking changes without major bump"]

## Files to gather
- Public API surface (main entry point, exported functions/classes)
- Type definitions and exported interfaces
- Error handling and custom error classes
- Package configuration (package.json, tsconfig, build config)
- Example usage code or quickstart
- Changelog or versioning policy

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'api-docs',
    name: 'API Documentation',
    description: 'Audits API documentation quality, endpoint descriptions, examples, error catalog, and interactive playground setup.',
    category: 'Developer Experience',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your API documentation, OpenAPI spec, or doc generation config...',
    systemPrompt: SYSTEM_PROMPTS['api-docs'],
    prepPrompt: `I'm preparing content for an **API Documentation** audit. Please help me collect the relevant files.

## Project context (fill in)
- API type: [e.g. REST, GraphQL, gRPC, WebSocket]
- Doc generation: [e.g. OpenAPI/Swagger, Redoc, Stoplight, custom, manual]
- Interactive playground: [e.g. Swagger UI, GraphiQL, Postman collection, none]
- Auth documentation: [e.g. documented, partially documented, not documented]
- Known concerns: [e.g. "docs out of date", "no examples", "error responses undocumented", "no playground"]

## Files to gather
- OpenAPI / Swagger specification file
- API documentation pages or markdown files
- Doc generation configuration
- Example request/response snippets
- Error catalog or error code documentation
- Authentication and authorization documentation

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'pwa',
    name: 'Progressive Web App',
    description: 'Reviews service worker implementation, web app manifest, offline support, cache strategies, and install prompts.',
    category: 'Developer Experience',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your service worker, manifest.json, or offline caching code...',
    systemPrompt: SYSTEM_PROMPTS['pwa'],
    prepPrompt: `I'm preparing code for a **Progressive Web App** audit. Please help me collect the relevant files.

## Project context (fill in)
- PWA framework: [e.g. Workbox, next-pwa, vite-plugin-pwa, custom service worker]
- Offline strategy: [e.g. cache-first, network-first, stale-while-revalidate, no offline support]
- Install prompt: [e.g. custom prompt, browser default, not implemented]
- Push notifications: [e.g. implemented, planned, not needed]
- Known concerns: [e.g. "service worker caching stale content", "no offline page", "manifest incomplete", "install prompt not showing"]

## Files to gather
- Service worker file (sw.js, service-worker.ts)
- Web app manifest (manifest.json, manifest.webmanifest)
- Service worker registration code
- Cache strategy configuration (Workbox config)
- Offline fallback page or component
- Install prompt and app update notification code

Keep total under 30,000 characters.`,
  }),
  builtin({
    id: 'browser-compat',
    name: 'Browser Compatibility',
    description: 'Audits polyfills, feature detection, CSS vendor prefixes, browserslist config, and progressive enhancement patterns.',
    category: 'Developer Experience',
    accentClass: 'text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your browserslist config, polyfill setup, or feature detection code...',
    systemPrompt: SYSTEM_PROMPTS['browser-compat'],
    prepPrompt: `I'm preparing code for a **Browser Compatibility** audit. Please help me collect the relevant files.

## Project context (fill in)
- Target browsers: [e.g. last 2 versions, IE 11+, modern only, specific mobile browsers]
- Build tools: [e.g. Babel, SWC, PostCSS, esbuild, Vite]
- Polyfill strategy: [e.g. core-js, polyfill.io, manual polyfills, none]
- CSS approach: [e.g. Tailwind, CSS modules, styled-components, vanilla CSS]
- Known concerns: [e.g. "broken on Safari", "no polyfills", "CSS not prefixed", "browserslist not configured"]

## Files to gather
- Browserslist configuration (.browserslistrc, package.json browserslist field)
- Babel or SWC configuration with preset-env settings
- PostCSS configuration with Autoprefixer setup
- Polyfill imports and feature detection code
- Any browser-specific CSS or JS workarounds
- Build configuration relevant to transpilation targets

Keep total under 30,000 characters.`,
  }),
];

export function getAgent(id: string): AgentConfig {
  const agent = agents.find((a) => a.id === id);
  if (!agent) {
    throw new Error(
      `Agent "${id}" not found in registry. This likely means VALID_AGENT_TYPES and the agents array are out of sync.`
    );
  }
  return agent;
}

// DX-001: Startup validation — fail fast if registry and schema are out of sync.
const registryIds = new Set(agents.map((a) => a.id));
const schemaIds = new Set<string>(VALID_AGENT_TYPES);
for (const id of registryIds) {
  if (!schemaIds.has(id)) {
    throw new Error(`Agent "${id}" is in registry but not in VALID_AGENT_TYPES. Add it to lib/schemas/auditRequest.ts`);
  }
}
for (const id of schemaIds) {
  if (!registryIds.has(id)) {
    throw new Error(`"${id}" is in VALID_AGENT_TYPES but has no matching agent in registry. Add it to lib/agents/registry.ts`);
  }
}
