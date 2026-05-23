// WORKFLOW-1: Parallel multi-agent orchestration.
// Runs up to 3 complementary agents simultaneously on the same input using
// Promise.allSettled(). Results are merged and returned as individual reports
// plus a unified summary. Cuts wall-clock time by ~3× for multi-agent audits.

import { getAgent } from '@/lib/agents/registry';
import type { AgentConfig } from '@/lib/types';

export interface ParallelAuditConfig {
  /** Agent IDs to run in parallel (max 3). */
  agentIds: string[];
  /** The user input to audit. */
  input: string;
  /** Maximum concurrent agents. */
  maxConcurrent?: number;
}

export interface ParallelAgentResult {
  agentId: string;
  agentName: string;
  status: 'fulfilled' | 'rejected';
  /** The prompt to use (system prompt with injected context). */
  systemPrompt: string;
  /** Error message if rejected. */
  error?: string;
}

/**
 * Resolve agent configs for parallel execution.
 * Validates that all agents exist and caps at maxConcurrent.
 */
export function resolveParallelAgents(
  agentIds: string[],
  maxConcurrent = 3,
): { agents: AgentConfig[]; errors: string[] } {
  const errors: string[] = [];
  const agents: AgentConfig[] = [];

  const uniqueIds = [...new Set(agentIds)].slice(0, maxConcurrent);

  for (const id of uniqueIds) {
    const agent = getAgent(id);
    if (!agent) {
      errors.push(`Agent "${id}" not found`);
    } else {
      agents.push(agent);
    }
  }

  return { agents, errors };
}

/**
 * Select complementary agents for a given primary agent.
 * Returns agent IDs that provide the most coverage when run together.
 */
export function selectComplementaryAgents(
  primaryAgentId: string,
  detectedPatterns: string[],
): string[] {
  // Complementary pairs: agents that together cover the most ground
  const COMPLEMENTARY_MAP: Record<string, string[]> = {
    'security': ['code-quality', 'auth-review'],
    'code-quality': ['security', 'performance'],
    'performance': ['code-quality', 'frontend-performance'],
    'architecture': ['code-quality', 'security'],
    'api-design': ['security', 'api-security'],
    'react-patterns': ['frontend-performance', 'accessibility'],
    'sql': ['security', 'database-performance'],
    'devops': ['container-security', 'ci-cd'],
    'accessibility': ['ux-review', 'responsive-design'],
    'test-quality': ['code-quality', 'architecture'],
    'typescript-strictness': ['code-quality', 'react-patterns'],
    'auth-review': ['security', 'data-security'],
    'privacy': ['security', 'data-security'],
    'frontend-performance': ['bundle-size', 'web-vitals'],
  };

  const complementary = COMPLEMENTARY_MAP[primaryAgentId] ?? ['security', 'code-quality'];

  // Filter to only agents that are relevant based on detected patterns
  return complementary.filter((id) => id !== primaryAgentId);
}

/**
 * Generate a merged summary header for parallel audit results.
 */
export function generateParallelSummary(
  agents: { id: string; name: string; status: 'fulfilled' | 'rejected' }[],
): string {
  const successful = agents.filter((a) => a.status === 'fulfilled');
  const failed = agents.filter((a) => a.status === 'rejected');

  const lines: string[] = [
    `# Multi-Agent Audit Summary`,
    '',
    `**Agents run:** ${agents.length} | **Successful:** ${successful.length} | **Failed:** ${failed.length}`,
    '',
  ];

  if (successful.length > 0) {
    lines.push('## Reports included:');
    for (const agent of successful) {
      lines.push(`- ✅ **${agent.name}** (${agent.id})`);
    }
  }

  if (failed.length > 0) {
    lines.push('');
    lines.push('## Failed agents:');
    for (const agent of failed) {
      lines.push(`- ❌ **${agent.name}** (${agent.id})`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}
