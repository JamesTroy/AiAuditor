// ARCH-013: AgentType is derived from the Zod schema to avoid duplication.
export type { AgentTypeValue as AgentType } from '@/lib/schemas/auditRequest';

// Keep these interfaces for any consumers that reference them directly.
export interface AuditRequestBody {
  agentType: import('@/lib/schemas/auditRequest').AgentTypeValue;
  input: string;
}

export interface CustomAuditRequestBody {
  agentType: 'custom';
  systemPrompt: string;
  input: string;
}

export interface AgentConfig {
  id: string; // built-in AgentType values or custom UUID
  // ARCH-014: Discriminator so callers can branch on agent origin without
  // duplicating the built-in ID allowlist or doing set lookups.
  kind: 'builtin' | 'custom';
  name: string;
  description: string;
  category: string;
  accentClass: string;
  buttonClass: string;
  placeholder: string;
  systemPrompt: string;
}
