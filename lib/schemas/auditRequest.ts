// ARCH-013: Single source of truth for audit request validation.
// Imported by the API route (server-side parse) and by client components
// (client-side pre-validation via .safeParse()).
//
// Constraints here must match the server-side ceilings in app/api/audit/route.ts.
import { z } from 'zod';

// CHUNK-001: Raised from 120k → 500k. Claude Sonnet 4.6 supports ~680k input tokens
// (~2.7M chars). 500k accommodates large monorepos while leaving room for system
// prompt, context files, and structured output. For inputs > 100k, the skeleton
// extractor and file-boundary chunker help the auditor navigate the codebase.
export const MAX_INPUT_CHARS = 500_000;
export const MAX_SYSTEM_PROMPT_CHARS = 10_000;
export const MAX_RUNTIME_CONTEXT_CHARS = 15_000;
export const MAX_CONTEXT_FILE_CHARS = 20_000;
export const MAX_CONTEXT_FILES = 5;

export const VALID_AGENT_TYPES = [
  'code-quality',
  'security',
  'seo-performance',
  'accessibility',
  'sql',
  'api-design',
  'devops',
  'performance',
  'privacy',
  'test-quality',
  'architecture',
  'ux-review',
  'design-system',
  'responsive-design',
  'color-typography',
  'motion-interaction',
  'documentation',
  'dependency-security',
  'auth-review',
  'frontend-performance',
  'caching',
  'memory-profiler',
  'cloud-infra',
  'observability',
  'database-infra',
  'data-security',
  'error-handling',
  'typescript-strictness',
  'react-patterns',
  'i18n',
  'rate-limiting',
  'logging',
  'database-migrations',
  'concurrency',
  'ci-cd',
  'regex-review',
  'monorepo',
  'graphql',
  'websocket',
  'container-security',
  'cors-headers',
  'api-security',
  'secrets-scanner',
  'xss-prevention',
  'csrf-ssrf',
  'cryptography',
  'cloud-iam',
  'secure-sdlc',
  'threat-modeling',
  'zero-trust',
  'incident-response',
  'compliance-audit',
  'seo-technical',
  'seo-basics',
  'seo-search-engines',
  'seo-ranking-factors',
  'seo-quick-wins',
  'seo-keyword-research',
  'seo-serp-analysis',
  'seo-search-intent',
  'seo-competitor-research',
  'seo-keyword-gap',
  'bundle-size',
  'forms-validation',
  'dark-mode',
  'email-templates',
  'env-config',
  'openapi',
  'state-machines',
  'pagination',
  'code-bloat',
  'marketing-pain-points',
  'marketing-copywriting',
  'marketing-landing-pages',
  'marketing-email-campaigns',
  'marketing-social-media',
  'marketing-brand-voice',
  'marketing-competitor-analysis',
  'marketing-pricing-page',
  'marketing-onboarding',
  'marketing-analytics',
  'marketing-content-strategy',
  'marketing-conversion-rate',
  'marketing-product-positioning',
  'marketing-growth-loops',
  'marketing-retention',
  'marketing-ab-testing',
  'marketing-funnel',
  'marketing-value-proposition',
  'marketing-user-research',
  'marketing-gtm-strategy',
  'ai-messaging',
  'developer-pain-points',
  'network-performance',
  'database-performance',
  'image-optimization',
  'ssr-performance',
  'api-performance',
  'css-performance',
  'javascript-performance',
  'animation-performance',
  'web-vitals',
  'runtime-performance',
  'build-performance',
  'navigation-ux',
  'micro-interactions',
  'error-ux',
  'mobile-ux',
  'data-visualization',
  'content-design',
  'onboarding-ux',
  'search-ux',
  'table-design',
  'notification-ux',
  'spacing-layout',
  'loading-states',
  'empty-states',
  'modal-dialog',
  'icon-consistency',
  'print-styles',
  'drag-drop',
  'multi-step-flows',
  'settings-preferences',
  'seo-local',
  'seo-ecommerce',
  'seo-content-audit',
  'seo-link-building',
  'seo-mobile',
  'seo-international',
  'seo-site-architecture',
  'seo-core-web-vitals',
  'seo-structured-data',
  'seo-indexation',
  'seo-video',
  // Subscription & Monetization
  'subscription-billing',
  'feature-entitlements',
  'trial-conversion',
  'dunning-flow',
  'pricing-architecture',
  'metered-billing',
  'churn-prevention',
  // Code Quality
  'naming-conventions',
  'dependency-management',
  'git-hygiene',
  'code-duplication',
  'complexity-metrics',
  // Infrastructure
  'kubernetes',
  'terraform-iac',
  'feature-flags',
  'message-queues',
  'dns-cdn',
  // Design
  'tooltip-popover',
  'file-upload',
  'date-time-picker',
  'breadcrumb-wayfinding',
  'dashboard-layout',
  // AI / LLM
  'prompt-engineering',
  'ai-safety',
  'rag-patterns',
  'ai-ux',
  'llm-cost',
  'agent-patterns',
  'llm-evaluation',
  'ai-ethics',
  'vector-search',
  'ai-streaming',
  // Testing
  'e2e-testing',
  'load-testing',
  'contract-testing',
  'visual-regression',
  'test-architecture',
  // Data Engineering
  'data-modeling',
  'etl-pipelines',
  'data-quality',
  'data-governance',
  // Infrastructure
  'api-gateway',
  'secrets-management',
  'backup-recovery',
  'service-mesh',
  // Monetization
  'payment-integration',
  'usage-tracking',
  'invoice-receipts',
  // Developer Experience
  'readme-quality',
  'sdk-design',
  'api-docs',
  'pwa',
  'browser-compat',
  // Compliance (framework-specific)
  'pci-dss',
  'hipaa-security',
  'soc2-controls',
] as const;

export type AgentTypeValue = (typeof VALID_AGENT_TYPES)[number];

const inputField = z
  .string()
  .min(1, 'Input cannot be empty')
  .max(MAX_INPUT_CHARS, `Input too long (max ${MAX_INPUT_CHARS.toLocaleString()} characters)`);

/** Optional stack trace, error log, or runtime context to help the auditor understand runtime behaviour. */
const runtimeContextField = z
  .string()
  .max(MAX_RUNTIME_CONTEXT_CHARS, `Runtime context too long (max ${MAX_RUNTIME_CONTEXT_CHARS.toLocaleString()} characters)`)
  .optional();

/**
 * Related files that provide context for the audit but are NOT themselves being audited.
 * Examples: auth middleware, shared utilities, config files.
 */
const contextFilesField = z
  .array(
    z.object({
      name: z.string().max(255),
      content: z.string().max(MAX_CONTEXT_FILE_CHARS, `Context file too long (max ${MAX_CONTEXT_FILE_CHARS.toLocaleString()} characters per file)`),
    }),
  )
  .max(MAX_CONTEXT_FILES, `Too many context files (max ${MAX_CONTEXT_FILES})`)
  .optional();

export const builtInAuditRequestSchema = z.object({
  agentType: z.enum(VALID_AGENT_TYPES).describe('Built-in agent type'),
  input: inputField,
  runtimeContext: runtimeContextField,
  contextFiles: contextFilesField,
});

export const customAuditRequestSchema = z.object({
  agentType: z.literal('custom'),
  systemPrompt: z
    .string()
    .min(1, 'System prompt cannot be empty')
    .max(
      MAX_SYSTEM_PROMPT_CHARS,
      `System prompt too long (max ${MAX_SYSTEM_PROMPT_CHARS.toLocaleString()} characters)`,
    ),
  input: inputField,
  runtimeContext: runtimeContextField,
  contextFiles: contextFilesField,
});

/** Discriminated union covering both built-in and custom audit requests. */
export const auditRequestSchema = z.discriminatedUnion('agentType', [
  builtInAuditRequestSchema,
  customAuditRequestSchema,
]);

export type AuditRequest = z.infer<typeof auditRequestSchema>;
export type BuiltInAuditRequest = z.infer<typeof builtInAuditRequestSchema>;
export type CustomAuditRequest = z.infer<typeof customAuditRequestSchema>;
