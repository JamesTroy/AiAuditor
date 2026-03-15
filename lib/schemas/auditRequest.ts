// ARCH-013: Single source of truth for audit request validation.
// Imported by the API route (server-side parse) and by client components
// (client-side pre-validation via .safeParse()).
//
// Constraints here must match the server-side ceilings in app/api/audit/route.ts.
import { z } from 'zod';

export const MAX_INPUT_CHARS = 30_000;
export const MAX_SYSTEM_PROMPT_CHARS = 10_000;

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
  'marketing-pain-points',
  'developer-pain-points',
] as const;

export type AgentTypeValue = (typeof VALID_AGENT_TYPES)[number];

const inputField = z
  .string()
  .min(1, 'Input cannot be empty')
  .max(MAX_INPUT_CHARS, `Input too long (max ${MAX_INPUT_CHARS.toLocaleString()} characters)`);

export const builtInAuditRequestSchema = z.object({
  agentType: z.enum(VALID_AGENT_TYPES).describe('Built-in agent type'),
  input: inputField,
  /** When true, uses a higher rate limit for sequential site audit batches. */
  siteAudit: z.boolean().optional(),
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
});

/** Discriminated union covering both built-in and custom audit requests. */
export const auditRequestSchema = z.discriminatedUnion('agentType', [
  builtInAuditRequestSchema,
  customAuditRequestSchema,
]);

export type AuditRequest = z.infer<typeof auditRequestSchema>;
export type BuiltInAuditRequest = z.infer<typeof builtInAuditRequestSchema>;
export type CustomAuditRequest = z.infer<typeof customAuditRequestSchema>;
