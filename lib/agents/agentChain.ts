// WORKFLOW-7: Agent Chain Workflow (Specialized → General).
// Run a specialized agent first, then feed its findings into a general agent
// as a "second opinion" that cross-references and finds related issues.

import { getAgent } from '@/lib/agents/registry';

// Mapping of specialist agents to their best general-purpose validators
const SPECIALIST_TO_GENERAL: Record<string, string[]> = {
  // Security specialists → general security + code quality
  'sql': ['security', 'code-quality'],
  'auth-review': ['security', 'code-quality'],
  'xss-prevention': ['security', 'code-quality'],
  'csrf-ssrf': ['security', 'api-security'],
  'secrets-scanner': ['security', 'devops'],
  'cryptography': ['security', 'data-security'],
  'cors-headers': ['security', 'api-design'],
  'container-security': ['security', 'devops'],
  'cloud-iam': ['security', 'cloud-infra'],
  'data-security': ['security', 'privacy'],

  // Performance specialists → general performance + code quality
  'frontend-performance': ['performance', 'code-quality'],
  'database-performance': ['performance', 'sql'],
  'bundle-size': ['performance', 'frontend-performance'],
  'caching': ['performance', 'architecture'],
  'network-performance': ['performance', 'api-design'],
  'javascript-performance': ['performance', 'code-quality'],
  'css-performance': ['performance', 'frontend-performance'],
  'ssr-performance': ['performance', 'seo-performance'],

  // Code quality specialists → architecture + security
  'typescript-strictness': ['code-quality', 'architecture'],
  'react-patterns': ['code-quality', 'frontend-performance'],
  'naming-conventions': ['code-quality', 'architecture'],
  'code-bloat': ['code-quality', 'architecture'],
  'error-handling': ['code-quality', 'security'],

  // Design specialists → UX + accessibility
  'design-system': ['ux-review', 'accessibility'],
  'responsive-design': ['ux-review', 'mobile-ux'],
  'navigation-ux': ['ux-review', 'accessibility'],
  'color-typography': ['ux-review', 'accessibility'],
};

export interface ChainConfig {
  /** The specialist agent to run first. */
  specialistId: string;
  /** The general agent to run as second opinion (auto-selected if omitted). */
  generalId?: string;
}

export interface ChainResult {
  specialistId: string;
  generalId: string;
  /** System prompt for the general agent, augmented with specialist findings. */
  chainedSystemPrompt: string;
  /** User message for the general agent, including specialist findings. */
  chainedUserMessage: string;
}

/**
 * Select the best general-purpose agent to validate a specialist's findings.
 */
export function selectGeneralAgent(
  specialistId: string,
  preferredGeneralId?: string,
): string {
  if (preferredGeneralId) {
    const agent = getAgent(preferredGeneralId);
    if (agent) return preferredGeneralId;
  }

  const candidates = SPECIALIST_TO_GENERAL[specialistId];
  if (candidates && candidates.length > 0) {
    // Return the first candidate that exists
    for (const id of candidates) {
      if (getAgent(id)) return id;
    }
  }

  // Fallback to security or code-quality
  return 'code-quality';
}

/**
 * Build the chained prompt for the general agent.
 * The general agent receives the specialist's findings and is asked to
 * verify them and find related issues.
 */
export function buildChainedPrompt(
  generalSystemPrompt: string,
  specialistName: string,
): string {
  return generalSystemPrompt + `

=== SPECIALIST CROSS-REFERENCE MODE ===
A specialist agent ("${specialistName}") has already analyzed this code and produced findings.
Their findings are included in the user message below.

Your additional responsibilities:
1. VERIFY the specialist's findings — confirm or dispute each one based on your analysis.
2. FIND RELATED issues the specialist missed — your broader perspective may catch
   cross-cutting concerns, architectural issues, or patterns the specialist didn't check.
3. AVOID pure duplication — if you agree with a specialist finding, reference it briefly
   rather than restating it in full. Focus your report on NEW findings and verifications.
4. FLAG contradictions — if you disagree with a specialist finding, explain why clearly.

When scoring, give credit for issues the specialist correctly identified.
=== END SPECIALIST CROSS-REFERENCE MODE ===`;
}

/**
 * Build the user message that includes specialist findings + original code.
 */
export function buildChainedInput(
  originalCode: string,
  specialistReport: string,
  specialistName: string,
): string {
  return `<specialist_findings agent="${specialistName}">
${specialistReport.slice(0, 50_000)}
</specialist_findings>

<user_content>
${originalCode}
</user_content>

Please verify the specialist's findings above against the source code, and identify any additional issues they may have missed.`;
}

/**
 * Prepare a full agent chain configuration.
 */
export function prepareAgentChain(
  config: ChainConfig,
): ChainResult | null {
  const specialist = getAgent(config.specialistId);
  if (!specialist) return null;

  const generalId = selectGeneralAgent(config.specialistId, config.generalId);
  const general = getAgent(generalId);
  if (!general) return null;

  return {
    specialistId: config.specialistId,
    generalId,
    chainedSystemPrompt: buildChainedPrompt(general.systemPrompt, specialist.name),
    chainedUserMessage: '', // Populated after specialist report is available
  };
}
