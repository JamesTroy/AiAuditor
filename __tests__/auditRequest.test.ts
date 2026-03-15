import { describe, it, expect } from 'vitest';
import {
  auditRequestSchema,
  builtInAuditRequestSchema,
  customAuditRequestSchema,
  MAX_INPUT_CHARS,
  MAX_SYSTEM_PROMPT_CHARS,
  VALID_AGENT_TYPES,
} from '@/lib/schemas/auditRequest';

describe('auditRequestSchema', () => {
  describe('built-in agent requests', () => {
    it('accepts a valid built-in agent request', () => {
      const result = auditRequestSchema.safeParse({
        agentType: 'code-quality',
        input: 'function foo() { return 1; }',
      });
      expect(result.success).toBe(true);
    });

    it('rejects an unknown agent type', () => {
      const result = auditRequestSchema.safeParse({
        agentType: 'nonexistent-agent',
        input: 'some code',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty input', () => {
      const result = builtInAuditRequestSchema.safeParse({
        agentType: 'security',
        input: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects input exceeding MAX_INPUT_CHARS', () => {
      const result = builtInAuditRequestSchema.safeParse({
        agentType: 'security',
        input: 'x'.repeat(MAX_INPUT_CHARS + 1),
      });
      expect(result.success).toBe(false);
    });

    it('accepts input at exactly MAX_INPUT_CHARS', () => {
      const result = builtInAuditRequestSchema.safeParse({
        agentType: 'security',
        input: 'x'.repeat(MAX_INPUT_CHARS),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('custom agent requests', () => {
    it('accepts a valid custom agent request', () => {
      const result = auditRequestSchema.safeParse({
        agentType: 'custom',
        systemPrompt: 'You are a helpful auditor.',
        input: 'const x = 1;',
      });
      expect(result.success).toBe(true);
    });

    it('rejects custom request without systemPrompt', () => {
      const result = customAuditRequestSchema.safeParse({
        agentType: 'custom',
        input: 'some code',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty systemPrompt', () => {
      const result = customAuditRequestSchema.safeParse({
        agentType: 'custom',
        systemPrompt: '',
        input: 'some code',
      });
      expect(result.success).toBe(false);
    });

    it('rejects systemPrompt exceeding MAX_SYSTEM_PROMPT_CHARS', () => {
      const result = customAuditRequestSchema.safeParse({
        agentType: 'custom',
        systemPrompt: 'x'.repeat(MAX_SYSTEM_PROMPT_CHARS + 1),
        input: 'some code',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('VALID_AGENT_TYPES', () => {
    it('contains 61 agent types', () => {
      expect(VALID_AGENT_TYPES.length).toBe(61);
    });

    it('has no duplicates', () => {
      const unique = new Set(VALID_AGENT_TYPES);
      expect(unique.size).toBe(VALID_AGENT_TYPES.length);
    });

    it('all types are kebab-case strings', () => {
      for (const type of VALID_AGENT_TYPES) {
        expect(type).toMatch(/^[a-z][a-z0-9-]*$/);
      }
    });
  });
});
