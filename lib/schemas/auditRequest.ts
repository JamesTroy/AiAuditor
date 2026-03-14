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
] as const;

export type AgentTypeValue = (typeof VALID_AGENT_TYPES)[number];

const inputField = z
  .string()
  .min(1, 'Input cannot be empty')
  .max(MAX_INPUT_CHARS, `Input too long (max ${MAX_INPUT_CHARS.toLocaleString()} characters)`);

export const builtInAuditRequestSchema = z.object({
  agentType: z.enum(VALID_AGENT_TYPES).describe('Built-in agent type'),
  input: inputField,
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
