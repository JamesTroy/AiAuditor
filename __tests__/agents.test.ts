import { describe, it, expect } from 'vitest';
import { agents, getAgent } from '@/lib/agents';
import { VALID_AGENT_TYPES } from '@/lib/schemas/auditRequest';

describe('Agent registry', () => {
  it('has 50 agents', () => {
    expect(agents.length).toBe(50);
  });

  it('every agent has required fields', () => {
    for (const agent of agents) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(agent.category).toBeTruthy();
      expect(agent.systemPrompt).toBeTruthy();
      expect(agent.accentClass).toBeTruthy();
      expect(agent.buttonClass).toBeTruthy();
      expect(agent.placeholder).toBeTruthy();
    }
  });

  it('every agent ID is unique', () => {
    const ids = agents.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every agent ID is in VALID_AGENT_TYPES', () => {
    const validSet = new Set<string>(VALID_AGENT_TYPES);
    for (const agent of agents) {
      expect(validSet.has(agent.id)).toBe(true);
    }
  });

  it('every VALID_AGENT_TYPE has a matching agent', () => {
    for (const type of VALID_AGENT_TYPES) {
      expect(getAgent(type)).toBeDefined();
    }
  });

  it('getAgent returns undefined for unknown IDs', () => {
    expect(getAgent('nonexistent')).toBeUndefined();
  });

  it('every agent belongs to a known category', () => {
    const validCategories = ['Code Quality', 'Security & Privacy', 'Performance', 'Infrastructure', 'Design'];
    for (const agent of agents) {
      expect(validCategories).toContain(agent.category);
    }
  });

  it('system prompts are non-trivial (>100 chars)', () => {
    for (const agent of agents) {
      expect(agent.systemPrompt.length).toBeGreaterThan(100);
    }
  });
});
