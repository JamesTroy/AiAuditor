// ARCH-005: Registry metadata only — system prompts live in ./prompts.ts.
import { AgentConfig } from '../types';
import { SYSTEM_PROMPTS } from './prompts';

export const agents: AgentConfig[] = [
  {
    id: 'code-quality',
    name: 'Code Quality',
    description: 'Detects bugs, anti-patterns, and style issues across any language.',
    category: 'Code Quality',
    accentClass: 'border-blue-500 text-blue-400 hover:bg-blue-500/10',
    buttonClass: 'bg-blue-700 hover:bg-blue-600',
    placeholder: 'Paste your code here...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['code-quality'],
    prepPrompt: `I'm preparing code for a Code Quality audit. Please help me collect and format the relevant files from my project.

Gather:
- The source files for the feature or module I want reviewed
- Any shared utilities or helpers those files depend on
- Type definitions or interfaces
- Configuration files (tsconfig.json, .eslintrc, package.json)

Format each file like this:
--- path/to/filename.ext ---
[full file contents]

Separate files with a blank line. If the total exceeds 30,000 characters, prioritise the files most central to the feature being reviewed and note which were omitted.`,
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Identifies vulnerabilities, attack surfaces, and insecure patterns.',
    category: 'Security & Privacy',
    accentClass: 'border-red-500 text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-700 hover:bg-red-600',
    placeholder: 'Paste your code or describe your system architecture...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['security'],
    prepPrompt: `I'm preparing code for a Security audit. Please help me collect and format the relevant files.

Gather:
- Authentication and authorisation logic (login, session, token handling, middleware)
- API route handlers and input validation
- Database queries and ORM models
- Any code that handles user-supplied input
- Configuration files that affect security (CORS, CSP headers, env var usage)
- Dependencies list (package.json, requirements.txt, go.mod, etc.)

Format each file like this:
--- path/to/filename.ext ---
[full file contents]

Omit purely presentational or styling files. Prioritise code that touches user data, auth flows, or external inputs. Keep total under 30,000 characters.`,
  },
  {
    id: 'seo-performance',
    name: 'SEO / Performance',
    description: 'Analyzes HTML and page structure for search rankings and load speed.',
    category: 'Performance',
    accentClass: 'border-yellow-500 text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-800 hover:bg-yellow-700',
    placeholder: 'Paste your page HTML or describe your page structure and content...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['seo-performance'],
    prepPrompt: `I'm preparing a page for an SEO & Performance audit. Please help me collect the relevant content.

Gather:
- The fully rendered HTML of the page (or the JSX/template that generates it)
- The complete <head> section: title, meta description, Open Graph tags, canonical URL, hreflang, robots meta
- Any structured data markup (JSON-LD scripts or microdata)
- Image tags with their src, alt, width, height, and loading attributes
- Font loading strategy (link tags, @font-face rules)
- Performance metrics if available: Lighthouse score, Core Web Vitals (LCP, FID/INP, CLS), page weight

Format each section clearly labelled, e.g.:
--- HTML (head) ---
--- HTML (body) ---
--- Structured Data ---
--- Performance Metrics ---

Keep total under 30,000 characters.`,
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'Checks HTML against WCAG 2.2 AA criteria and ARIA best practices.',
    category: 'Code Quality',
    accentClass: 'border-green-500 text-green-400 hover:bg-green-500/10',
    buttonClass: 'bg-green-700 hover:bg-green-600',
    placeholder: 'Paste your HTML here...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['accessibility'],
    prepPrompt: `I'm preparing a UI component or page for an Accessibility audit. Please help me collect the relevant markup.

Gather:
- The full rendered HTML of the component or page (not just the JSX source — rendered output is better)
- All ARIA attributes (role, aria-label, aria-describedby, aria-expanded, aria-live, etc.)
- Form elements with their labels, required attributes, and error messaging markup
- Interactive elements: buttons, links, inputs, modals, dropdowns, tabs
- Focus management logic (any JavaScript that calls .focus() or manages tabIndex)
- Any CSS that hides or shows content (visibility, display:none, sr-only patterns)

Format each section:
--- Rendered HTML ---
--- Focus management JS (if any) ---

Note the component name and its purpose at the top. Keep total under 30,000 characters.`,
  },
  {
    id: 'sql',
    name: 'SQL Auditor',
    description: 'Finds injection risks, N+1 queries, missing indexes, and transaction issues.',
    category: 'Security & Privacy',
    accentClass: 'border-orange-500 text-orange-400 hover:bg-orange-500/10',
    buttonClass: 'bg-orange-700 hover:bg-orange-600',
    placeholder: 'Paste your SQL queries, schema, or ORM code here...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['sql'],
    prepPrompt: `I'm preparing database code for a SQL audit. Please help me collect the relevant files and queries.

Gather:
- Database schema: CREATE TABLE statements or ORM model definitions
- All SQL queries or query-builder calls (raw SQL, Prisma, SQLAlchemy, ActiveRecord, etc.)
- Repository or data-access layer files
- Any code that constructs queries dynamically from user input
- Migration files if relevant
- Index definitions (if separate from the schema)

Format each file or section:
--- schema.sql (or models/user.py, etc.) ---
--- queries/users.ts ---

Add a one-line comment above each query if its purpose isn't obvious. Keep total under 30,000 characters.`,
  },
  {
    id: 'api-design',
    name: 'API Design',
    description: 'Reviews REST and GraphQL APIs for conventions, versioning, and error contracts.',
    category: 'Infrastructure',
    accentClass: 'border-cyan-500 text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-800 hover:bg-cyan-700',
    placeholder: 'Paste your API routes, OpenAPI spec, or GraphQL schema here...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['api-design'],
    prepPrompt: `I'm preparing an API for a design review. Please help me collect the relevant files.

Gather:
- OpenAPI / Swagger spec (openapi.yaml or openapi.json) if it exists
- All route/endpoint definitions (Express router files, FastAPI routes, Rails routes, etc.)
- Request and response type definitions or schemas
- Authentication/authorisation middleware applied to routes
- Error response format and any error-handling middleware
- API versioning strategy (URL prefix, headers, etc.) if visible in the code

Format each file:
--- routes/users.ts ---
--- openapi.yaml ---
--- types/api.ts ---

If there's no OpenAPI spec, include a brief description of the API's purpose at the top. Keep total under 30,000 characters.`,
  },
  {
    id: 'devops',
    name: 'Docker / DevOps',
    description: 'Audits Dockerfiles, CI/CD pipelines, and infrastructure config for security and efficiency.',
    category: 'Infrastructure',
    accentClass: 'border-slate-400 text-slate-300 hover:bg-slate-500/10',
    buttonClass: 'bg-slate-700 hover:bg-slate-600',
    placeholder: 'Paste your Dockerfile, docker-compose.yml, CI config (.github/workflows, .gitlab-ci.yml), or IaC here...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['devops'],
    prepPrompt: `I'm preparing infrastructure and deployment config for a DevOps audit. Please help me collect the relevant files.

Gather:
- Dockerfile(s) and docker-compose.yml
- CI/CD pipeline configs (.github/workflows/*.yml, .gitlab-ci.yml, Jenkinsfile, etc.)
- Infrastructure-as-code (Terraform .tf files, Helm charts, Kubernetes manifests, Pulumi code)
- Secrets and environment variable handling (how .env files are managed, secret injection strategy)
- Dependency management files (package.json, requirements.txt, go.mod) for supply chain context
- Any deployment scripts or Makefile targets

Format each file:
--- Dockerfile ---
--- .github/workflows/deploy.yml ---
--- terraform/main.tf ---

Omit actual secret values — replace them with placeholders like [REDACTED]. Keep total under 30,000 characters.`,
  },
  {
    id: 'performance',
    name: 'Performance Profiler',
    description: 'Identifies algorithmic complexity, memory leaks, and render performance bottlenecks.',
    category: 'Performance',
    accentClass: 'border-amber-500 text-amber-400 hover:bg-amber-500/10',
    buttonClass: 'bg-amber-800 hover:bg-amber-700',
    placeholder: 'Paste your code — frontend, backend, or algorithm...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['performance'],
    prepPrompt: `I'm preparing code for a Performance audit. Please help me collect the relevant files and context.

Gather:
- The specific function, module, or component suspected of being slow
- Any code it calls that could be contributing to the bottleneck (data fetching, sorting, rendering)
- For frontend: component tree, useEffect/useMemo/useCallback usage, list rendering code
- For backend: request handlers, database calls, caching layer, any loops over large datasets
- For algorithms: the function plus representative input size/shape

Also include:
- Any existing profiler output or benchmark numbers you have (even rough ones)
- A brief description of where in the system this code runs (e.g. "called on every keystroke", "runs at startup", "processes 50k rows nightly")

Format each file:
--- components/DataTable.tsx ---
--- api/reports/route.ts ---

Keep total under 30,000 characters.`,
  },
  {
    id: 'privacy',
    name: 'Privacy / GDPR',
    description: 'Checks code and data flows for PII exposure, consent gaps, and GDPR/CCPA compliance.',
    category: 'Security & Privacy',
    accentClass: 'border-pink-500 text-pink-400 hover:bg-pink-500/10',
    buttonClass: 'bg-pink-700 hover:bg-pink-600',
    placeholder: 'Paste your code, data models, API routes, or privacy policy for analysis...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['privacy'],
    prepPrompt: `I'm preparing code for a Privacy & GDPR audit. Please help me collect the relevant files.

Gather:
- Data models and database schemas (any table/model that stores user information)
- API routes and handlers that collect, process, or return personal data
- Analytics and tracking integrations (how events are logged, what data is sent to third parties)
- Consent management code (cookie banners, opt-in/opt-out logic)
- Authentication flows where personal data is processed
- Any code that sends data to external services (email providers, analytics, CDNs)
- Existing privacy policy text (if available)

Format each file:
--- models/user.ts ---
--- api/analytics/route.ts ---
--- components/CookieBanner.tsx ---

Replace any real personal data in examples with placeholders like [email], [name]. Keep total under 30,000 characters.`,
  },
  {
    id: 'test-quality',
    name: 'Test Quality',
    description: 'Reviews test suites for coverage gaps, flaky patterns, and assertion quality.',
    category: 'Code Quality',
    accentClass: 'border-teal-500 text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-700 hover:bg-teal-600',
    placeholder: 'Paste your test files, test suite, or both test and implementation code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['test-quality'],
    prepPrompt: `I'm preparing code for a Test Quality audit. Please help me collect both the test files and the implementation they cover.

Gather:
- The test file(s) to be reviewed (*.test.ts, *.spec.py, *_test.go, etc.)
- The implementation file(s) each test file covers — this allows coverage gap analysis
- Test configuration files (jest.config.ts, vitest.config.ts, pytest.ini, etc.)
- Any shared test utilities, fixtures, or factories used by these tests
- Mock/stub definitions if they live in separate files

Format each file:
--- src/lib/auth.ts (implementation) ---
--- src/lib/auth.test.ts (tests) ---
--- jest.config.ts ---

Include both files for each module if possible — the audit is most useful when it can compare tests against the actual code. Keep total under 30,000 characters.`,
  },
  {
    id: 'architecture',
    name: 'Architecture Review',
    description: 'Evaluates system design for coupling, cohesion, dependency direction, and scalability.',
    category: 'Code Quality',
    accentClass: 'border-indigo-500 text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste your system description, architecture diagram description, module structure, or key source files...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['architecture'],
    prepPrompt: `I'm preparing a system for an Architecture Review. Please help me collect a representative snapshot of the codebase structure.

Gather:
1. Module/folder structure — run \`find . -type f | grep -v node_modules | grep -v .git | sort\` and include the output
2. Entry points: main files, root router, app bootstrapping code
3. Key abstraction layers: services, repositories, domain models, controllers (whichever apply)
4. Dependency injection or service-locator setup if present
5. Inter-module import graph highlights — any files imported by many others
6. External integration points: third-party API clients, message queues, databases

Also write a short paragraph (3–5 sentences) describing:
- What the system does
- The primary tech stack
- Any known architectural pain points or areas of concern

Format:
--- Directory tree ---
--- src/index.ts (entry point) ---
--- src/services/UserService.ts ---

Keep total under 30,000 characters; prefer breadth over depth.`,
  },
  {
    id: 'documentation',
    name: 'Documentation Quality',
    description: 'Audits inline comments, JSDoc/TSDoc, README completeness, and API reference quality.',
    category: 'Code Quality',
    accentClass: 'border-purple-500 text-purple-400 hover:bg-purple-500/10',
    buttonClass: 'bg-purple-700 hover:bg-purple-600',
    placeholder: 'Paste your source files, README, JSDoc comments, or API reference...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['documentation'],
    prepPrompt: `I'm preparing code and documentation for a Documentation Quality audit. Please help me collect the relevant files.

Gather:
- Source files with inline comments and JSDoc/TSDoc annotations
- README.md and any other Markdown documentation files
- API reference files or generated docs if available
- CHANGELOG.md and any Architecture Decision Records (ADRs)
- Any Storybook stories or example files

Format each file:
--- README.md ---
--- src/lib/auth.ts ---
--- docs/api.md ---

Keep total under 30,000 characters. Prioritise public API surfaces and onboarding-critical files.`,
  },
  {
    id: 'dependency-security',
    name: 'Dependency Security',
    description: 'Scans for CVEs, outdated packages, license risks, and supply-chain vulnerabilities.',
    category: 'Security & Privacy',
    accentClass: 'border-emerald-500 text-emerald-400 hover:bg-emerald-500/10',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
    placeholder: 'Paste your package.json, package-lock.json, requirements.txt, go.mod, or similar...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['dependency-security'],
    prepPrompt: `I'm preparing dependency files for a Supply Chain Security audit. Please help me collect the relevant manifests.

Gather:
- package.json and package-lock.json (or yarn.lock / pnpm-lock.yaml)
- requirements.txt and/or Pipfile.lock (Python)
- go.mod and go.sum (Go)
- pom.xml or build.gradle (Java/Kotlin)
- Gemfile.lock (Ruby)
- Any .npmrc, pip.conf, or private registry configuration

Format each file:
--- package.json ---
--- package-lock.json ---

Do NOT include node_modules or the full dependency tree dump — just the manifest and lock files. Keep total under 30,000 characters.`,
  },
  {
    id: 'auth-review',
    name: 'Auth & Session Review',
    description: 'Deep-dives on authentication flows, JWT/session handling, OAuth, and credential security.',
    category: 'Security & Privacy',
    accentClass: 'border-violet-500 text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your authentication code, JWT logic, session handling, or OAuth implementation...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['auth-review'],
    prepPrompt: `I'm preparing authentication code for an Auth & Session Security audit. Please help me collect the relevant files.

Gather:
- Login, signup, and password reset handlers
- JWT creation, validation, and refresh logic
- Session middleware and cookie configuration
- OAuth/OIDC integration code (provider config, callback handlers)
- Authorization middleware and role/permission checks
- Any MFA implementation
- Auth-related configuration (e.g. next-auth config, passport strategies)

Format each file:
--- app/api/auth/route.ts ---
--- middleware/auth.ts ---
--- lib/session.ts ---

Replace any real secrets or credentials with [REDACTED]. Keep total under 30,000 characters.`,
  },
  {
    id: 'frontend-performance',
    name: 'Frontend Performance',
    description: 'Analyzes bundle size, Core Web Vitals risk, rendering bottlenecks, and resource loading.',
    category: 'Performance',
    accentClass: 'border-lime-500 text-lime-400 hover:bg-lime-500/10',
    buttonClass: 'bg-lime-800 hover:bg-lime-700',
    placeholder: 'Paste your component code, build config, HTML, or Lighthouse report...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['frontend-performance'],
    prepPrompt: `I'm preparing frontend code for a Performance audit. Please help me collect the relevant files.

Gather:
- Key page components and their dependencies (the main layout, hero, and heaviest components)
- Build configuration: webpack.config.js, vite.config.ts, next.config.ts
- Any Lighthouse JSON report or Web Vitals measurements you have
- CSS files for the critical path
- Image tags and their attributes (src, width, height, loading, fetchpriority)
- Third-party script tags and their loading strategy

Also include:
- Bundle size output (e.g. \`next build\` output, webpack-bundle-analyzer screenshot description)
- A brief note on the target device profile (low-end mobile, desktop, etc.)

Format each file:
--- components/HeroSection.tsx ---
--- next.config.ts ---
--- public/index.html (head section) ---

Keep total under 30,000 characters.`,
  },
  {
    id: 'caching',
    name: 'Caching Strategy',
    description: 'Reviews HTTP cache headers, CDN config, Redis patterns, and cache invalidation logic.',
    category: 'Performance',
    accentClass: 'border-sky-500 text-sky-400 hover:bg-sky-500/10',
    buttonClass: 'bg-sky-700 hover:bg-sky-600',
    placeholder: 'Paste your API routes, cache configuration, Redis code, or CDN settings...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['caching'],
    prepPrompt: `I'm preparing caching code and configuration for a Caching Strategy audit. Please help me collect the relevant files.

Gather:
- API route handlers that set Cache-Control or other HTTP cache headers
- CDN configuration (Cloudflare page rules, CloudFront behaviors, Fastly VCL)
- Redis/Memcached client code: cache reads, writes, TTL settings, invalidation
- Next.js/Nuxt/Remix caching config (revalidate, ISR settings, fetch cache options)
- Any cache-aside, read-through, or write-through patterns
- Background job or webhook handlers that trigger cache invalidation

Format each file:
--- app/api/products/route.ts ---
--- lib/cache.ts ---
--- infrastructure/cloudfront.tf ---

Keep total under 30,000 characters.`,
  },
  {
    id: 'memory-profiler',
    name: 'Memory & Leak Detection',
    description: 'Identifies memory leaks, unbounded caches, listener accumulation, and heap growth patterns.',
    category: 'Performance',
    accentClass: 'border-cyan-500 text-cyan-400 hover:bg-cyan-500/10',
    buttonClass: 'bg-cyan-800 hover:bg-cyan-700',
    placeholder: 'Paste your component code, Node.js modules, heap snapshot summary, or profiler output...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['memory-profiler'],
    prepPrompt: `I'm preparing code for a Memory & Leak Detection audit. Please help me collect the relevant files.

Gather:
- Components or modules suspected of leaking (those with event listeners, timers, subscriptions)
- React useEffect hooks — especially those with subscriptions, WebSocket connections, or intervals
- Node.js EventEmitter usage or stream handling code
- In-memory cache or store implementations (custom Maps, LRU caches)
- Any heap snapshot text summary or memory profiler output you have
- Long-running background processes or worker code

Also describe:
- The runtime environment (Node.js version, browser, React version)
- Observed symptoms: memory grows over time? Crashes after N hours? High heap usage?

Format each file:
--- components/RealtimeChart.tsx ---
--- lib/eventBus.ts ---
--- workers/jobProcessor.ts ---

Keep total under 30,000 characters.`,
  },
  {
    id: 'cloud-infra',
    name: 'Cloud Infrastructure',
    description: 'Reviews IAM policies, network exposure, storage security, and resilience for AWS/GCP/Azure.',
    category: 'Infrastructure',
    accentClass: 'border-teal-500 text-teal-400 hover:bg-teal-500/10',
    buttonClass: 'bg-teal-700 hover:bg-teal-600',
    placeholder: 'Paste your Terraform, CDK, CloudFormation, or cloud config files...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['cloud-infra'],
    prepPrompt: `I'm preparing cloud infrastructure code for a security and architecture review. Please help me collect the relevant files.

Gather:
- IAM role and policy definitions (Terraform aws_iam_policy, CDK PolicyDocument, etc.)
- VPC and security group / firewall rule configurations
- S3 bucket / GCS bucket / Azure Storage container policies and public access settings
- Compute resource definitions: EC2, ECS task definitions, Lambda functions, GKE node pools
- Secrets Manager, SSM Parameter Store, or Key Vault references
- Any CloudFront / load balancer / API Gateway configuration

Format each file:
--- terraform/iam.tf ---
--- terraform/networking.tf ---
--- infra/s3.tf ---

Replace any real account IDs, ARNs, or secrets with placeholders like [ACCOUNT_ID], [REDACTED]. Keep total under 30,000 characters.`,
  },
  {
    id: 'observability',
    name: 'Observability & Monitoring',
    description: 'Audits logging structure, metrics coverage, alerting rules, tracing, and incident readiness.',
    category: 'Infrastructure',
    accentClass: 'border-rose-500 text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your logging code, Prometheus rules, alert configs, or OpenTelemetry setup...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['observability'],
    prepPrompt: `I'm preparing observability code and configuration for an audit. Please help me collect the relevant files.

Gather:
- Logging setup: logger initialization, log format, log levels, any structured logging middleware
- Metrics: Prometheus scrape config, custom metric definitions, Datadog/CloudWatch metric code
- Alerting rules: Prometheus alerting rules, PagerDuty/OpsGenie policies, alert thresholds
- Tracing: OpenTelemetry setup, Jaeger/Zipkin config, span instrumentation
- Health check endpoints and readiness probe handlers
- Error tracking setup (Sentry, Rollbar, Bugsnag config)
- Any existing runbooks or on-call documentation structure

Format each file:
--- lib/logger.ts ---
--- monitoring/alerts.yaml ---
--- app/api/health/route.ts ---

Keep total under 30,000 characters.`,
  },
  {
    id: 'database-infra',
    name: 'Database Infrastructure',
    description: 'Reviews schema design, indexing, connection pooling, migrations, backup, and replication.',
    category: 'Infrastructure',
    accentClass: 'border-indigo-500 text-indigo-400 hover:bg-indigo-500/10',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-600',
    placeholder: 'Paste your schema SQL, migration files, ORM config, or database infrastructure code...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['database-infra'],
    prepPrompt: `I'm preparing database infrastructure code for an audit. Please help me collect the relevant files.

Gather:
- Schema definitions: CREATE TABLE statements, Prisma schema, SQLAlchemy models, ActiveRecord migrations
- All migration files (in chronological order if possible)
- ORM or database client configuration: connection pool settings, timeout config
- Backup and replication configuration (RDS parameter groups, pg_dump scripts, etc.)
- Any seed or fixture files that reveal data volume expectations
- Query-heavy endpoints or repository files where performance matters most

Also describe:
- Database engine and version (PostgreSQL 15, MySQL 8, MongoDB 6, etc.)
- Approximate table sizes if known (e.g. "users table: 10M rows")
- Any known slow queries or recent performance incidents

Format each file:
--- prisma/schema.prisma ---
--- migrations/20240101_add_indexes.sql ---
--- lib/db.ts ---

Keep total under 30,000 characters.`,
  },
  {
    id: 'ux-review',
    name: 'UX Review',
    description: 'Evaluates user flows, interaction patterns, cognitive load, and usability heuristics.',
    category: 'Design',
    accentClass: 'border-violet-500 text-violet-400 hover:bg-violet-500/10',
    buttonClass: 'bg-violet-700 hover:bg-violet-600',
    placeholder: 'Paste your component HTML/JSX, describe a user flow, or paste a screen description...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['ux-review'],
    prepPrompt: `I'm preparing a UI for a UX Review. Please help me collect the relevant markup and context.

Gather:
- The rendered HTML or JSX of the component, page, or flow being reviewed
- Any state-dependent variations (error state, empty state, loading state, success state)
- Interactive elements with their associated labels, hints, and error messages
- A brief description of the user's goal when they land on this screen

Format each section:
--- Component: [Name] ---
--- State: [normal / error / empty / loading] ---
--- User goal: [one sentence] ---

Keep total under 30,000 characters.`,
  },
  {
    id: 'design-system',
    name: 'Design System',
    description: 'Audits design tokens, component APIs, variant coverage, and documentation completeness.',
    category: 'Design',
    accentClass: 'border-fuchsia-500 text-fuchsia-400 hover:bg-fuchsia-500/10',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600',
    placeholder: 'Paste your design tokens, component code, Storybook stories, or token JSON...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['design-system'],
    prepPrompt: `I'm preparing a design system for an audit. Please help me collect the relevant files.

Gather:
- Token definitions: CSS custom properties, Tailwind config, or tokens.json
- One or two representative component files showing prop interfaces and styling
- Any Storybook stories (*.stories.tsx) for those components
- Component index file (shows the full exported surface area)
- Any existing documentation (README, contributing guide, changelog)

Format each file:
--- tokens/colors.css ---
--- components/Button/Button.tsx ---
--- components/Button/Button.stories.tsx ---

Keep total under 30,000 characters.`,
  },
  {
    id: 'responsive-design',
    name: 'Responsive Design',
    description: 'Reviews breakpoints, fluid layouts, touch targets, and cross-device behaviour.',
    category: 'Design',
    accentClass: 'border-sky-500 text-sky-400 hover:bg-sky-500/10',
    buttonClass: 'bg-sky-700 hover:bg-sky-600',
    placeholder: 'Paste your CSS, Tailwind classes, or component code for responsive analysis...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['responsive-design'],
    prepPrompt: `I'm preparing CSS and layout code for a Responsive Design audit. Please help me collect the relevant files.

Gather:
- The CSS or Tailwind classes responsible for layout (grid, flex, breakpoint utilities)
- The HTML/JSX structure of the component or page being reviewed
- Any CSS media queries or container queries in use
- The Tailwind config (tailwind.config.ts) if Tailwind is used — especially the screens object
- Any viewport meta tag from the HTML head

Format each section:
--- tailwind.config.ts ---
--- components/Layout.tsx ---
--- styles/layout.css (if applicable) ---

Note the target device categories (mobile-only, mobile+desktop, all devices). Keep total under 30,000 characters.`,
  },
  {
    id: 'color-typography',
    name: 'Color & Typography',
    description: 'Checks contrast ratios, type scales, palette harmony, and WCAG color compliance.',
    category: 'Design',
    accentClass: 'border-rose-500 text-rose-400 hover:bg-rose-500/10',
    buttonClass: 'bg-rose-700 hover:bg-rose-600',
    placeholder: 'Paste your color tokens, CSS variables, Tailwind config, or typography definitions...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['color-typography'],
    prepPrompt: `I'm preparing design tokens for a Color & Typography audit. Please help me collect the relevant definitions.

Gather:
- Color tokens: CSS custom properties (:root variables), tailwind.config.ts colors section, or tokens.json
- Typography tokens: font-family, font-size scale, line-height, letter-spacing definitions
- Examples of text-on-background combinations actually used in the UI (e.g. white text on blue-600 button)
- Any dark-mode color overrides

Format each section:
--- Color tokens (CSS / config) ---
--- Typography tokens ---
--- Text-on-background examples ---
--- Dark mode overrides (if any) ---

List at least 5–10 real color combinations used in the product. Keep total under 30,000 characters.`,
  },
  {
    id: 'motion-interaction',
    name: 'Motion & Interaction',
    description: 'Reviews animations, transitions, micro-interactions, and reduced-motion accessibility.',
    category: 'Design',
    accentClass: 'border-lime-500 text-lime-400 hover:bg-lime-500/10',
    buttonClass: 'bg-lime-800 hover:bg-lime-700',
    placeholder: 'Paste your CSS animations, Framer Motion code, or JavaScript animation logic...',
    kind: 'builtin' as const,
    systemPrompt: SYSTEM_PROMPTS['motion-interaction'],
    prepPrompt: `I'm preparing animation and transition code for a Motion & Interaction audit. Please help me collect the relevant files.

Gather:
- CSS keyframes and transition definitions
- JavaScript/TypeScript animation code (Framer Motion variants, GSAP timelines, Web Animations API)
- Any \`@media (prefers-reduced-motion)\` overrides
- Loading state components (spinners, skeletons, progress bars)
- Page/route transition logic if it exists

Format each file:
--- styles/animations.css ---
--- components/PageTransition.tsx ---
--- components/Spinner.tsx ---

Note which animation library is in use (Framer Motion, GSAP, CSS-only, etc.). Keep total under 30,000 characters.`,
  },
];

export function getAgent(id: string): AgentConfig | undefined {
  return agents.find((a) => a.id === id);
}
