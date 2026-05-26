// FP-CRITIC-001: Test that the adversarial critic fails open under every
// failure mode and applies verdicts correctly when the LLM responds.
//
// The critic itself calls Anthropic via the SDK, so we mock the SDK at the
// top of the test file. The contract under test is: given a set of verdicts,
// the critic returns the correct shape; given any failure, the critic
// returns the original findings unchanged.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ValidatedFinding } from '@/lib/validateFindings';

// Mock Anthropic SDK BEFORE importing the critic. The mock factory MUST
// declare its mock implementation inline (vitest hoists vi.mock calls).
const createMock = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: createMock };
    },
  };
});

// Circuit breaker — mock as always-allow so we can test the critic's own logic
// rather than the breaker's. Separate tests cover the breaker.
vi.mock('@/lib/ai/circuitBreaker', () => ({
  anthropicCircuitBreaker: {
    allowRequest: async () => true,
    onSuccess: vi.fn(async () => {}),
    onFailure: vi.fn(async () => {}),
  },
}));

// Imported after mocks are set up.
const { critiqueFindings } = await import('@/lib/ai/adversarialCritic');

function makeFinding(overrides: Partial<ValidatedFinding> = {}): ValidatedFinding {
  return {
    id: 'TEST-1',
    severity: 'high',
    confidence: 'certain',
    classification: 'vulnerability',
    title: 'Test finding',
    location: 'app/api/test.ts:42',
    code_snippet: 'foo()',
    remediation: 'Fix it',
    validated: true,
    ...overrides,
  };
}

function mockCriticResponse(verdicts: Array<{ finding_id: string; verdict: string; reasoning: string }>) {
  createMock.mockResolvedValueOnce({
    content: [
      { type: 'text', text: 'analysis' },
      {
        type: 'tool_use',
        name: 'report_critique_verdicts',
        input: { verdicts },
      },
    ],
  });
}

describe('critiqueFindings', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  describe('skip conditions', () => {
    it('skips the LLM call when there are no [CERTAIN] findings', async () => {
      const findings = [
        makeFinding({ id: 'A', confidence: 'likely' }),
        makeFinding({ id: 'B', confidence: 'possible' }),
      ];
      const result = await critiqueFindings('source code', findings);
      expect(createMock).not.toHaveBeenCalled();
      expect(result.stats.skipped).toBe(true);
      expect(result.findings).toEqual(findings);
    });

    it('processes only [CERTAIN] findings even when [LIKELY] are present', async () => {
      const findings = [
        makeFinding({ id: 'A', confidence: 'certain' }),
        makeFinding({ id: 'B', confidence: 'likely' }),
      ];
      mockCriticResponse([{ finding_id: 'A', verdict: 'keep', reasoning: 'real' }]);
      const result = await critiqueFindings('source code', findings);
      expect(result.stats.critiqued).toBe(1);
      expect(result.findings).toHaveLength(2);
    });
  });

  describe('verdict application', () => {
    it('keeps a finding when verdict is keep', async () => {
      const findings = [makeFinding({ id: 'A' })];
      mockCriticResponse([{ finding_id: 'A', verdict: 'keep', reasoning: 'real' }]);
      const result = await critiqueFindings('source', findings);
      expect(result.findings[0].confidence).toBe('certain');
      expect(result.stats.kept).toBe(1);
      expect(result.stats.dropped).toBe(0);
    });

    it('demotes [CERTAIN] to [LIKELY] on demote_likely', async () => {
      const findings = [makeFinding({ id: 'A' })];
      mockCriticResponse([{ finding_id: 'A', verdict: 'demote_likely', reasoning: 'maybe' }]);
      const result = await critiqueFindings('source', findings);
      expect(result.findings[0].confidence).toBe('likely');
      expect(result.stats.demotedLikely).toBe(1);
    });

    it('demotes [CERTAIN] to [POSSIBLE] on demote_possible', async () => {
      const findings = [makeFinding({ id: 'A' })];
      mockCriticResponse([{ finding_id: 'A', verdict: 'demote_possible', reasoning: 'unclear' }]);
      const result = await critiqueFindings('source', findings);
      expect(result.findings[0].confidence).toBe('possible');
      expect(result.stats.demotedPossible).toBe(1);
    });

    it('drops the finding on verdict drop', async () => {
      const findings = [makeFinding({ id: 'A' }), makeFinding({ id: 'B' })];
      mockCriticResponse([
        { finding_id: 'A', verdict: 'drop', reasoning: 'wrong' },
        { finding_id: 'B', verdict: 'keep', reasoning: 'real' },
      ]);
      const result = await critiqueFindings('source', findings);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].id).toBe('B');
      expect(result.stats.dropped).toBe(1);
      expect(result.stats.kept).toBe(1);
    });

    it('keeps findings with no verdict (defaults to keep)', async () => {
      const findings = [makeFinding({ id: 'A' }), makeFinding({ id: 'B' })];
      mockCriticResponse([{ finding_id: 'A', verdict: 'drop', reasoning: 'wrong' }]);
      const result = await critiqueFindings('source', findings);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].id).toBe('B');
      expect(result.findings[0].confidence).toBe('certain');
    });

    it('ignores verdicts for findings that do not exist', async () => {
      const findings = [makeFinding({ id: 'A' })];
      mockCriticResponse([
        { finding_id: 'A', verdict: 'keep', reasoning: 'real' },
        { finding_id: 'HALLUCINATED', verdict: 'drop', reasoning: 'made up' },
      ]);
      const result = await critiqueFindings('source', findings);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].confidence).toBe('certain');
    });

    it('ignores verdicts with invalid verdict strings', async () => {
      const findings = [makeFinding({ id: 'A' })];
      mockCriticResponse([{ finding_id: 'A', verdict: 'banana', reasoning: 'invalid' }]);
      const result = await critiqueFindings('source', findings);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].confidence).toBe('certain'); // defaulted to keep
    });
  });

  describe('fail-open behaviour', () => {
    it('returns originals when the SDK throws', async () => {
      const findings = [makeFinding({ id: 'A' })];
      createMock.mockRejectedValueOnce(new Error('network failure'));
      const result = await critiqueFindings('source', findings);
      expect(result.findings).toEqual(findings);
      expect(result.stats.failedOpen).toBe(true);
      expect(result.stats.error).toContain('network failure');
    });

    it('returns originals when no tool_use block is present', async () => {
      const findings = [makeFinding({ id: 'A' })];
      createMock.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I refuse to use the tool' }],
      });
      const result = await critiqueFindings('source', findings);
      expect(result.findings).toEqual(findings);
      expect(result.stats.failedOpen).toBe(true);
      expect(result.stats.error).toBe('no_tool_use_block');
    });

    it('returns originals when verdicts field is missing', async () => {
      const findings = [makeFinding({ id: 'A' })];
      createMock.mockResolvedValueOnce({
        content: [{ type: 'tool_use', name: 'report_critique_verdicts', input: {} }],
      });
      const result = await critiqueFindings('source', findings);
      expect(result.findings).toEqual(findings);
      expect(result.stats.failedOpen).toBe(true);
      expect(result.stats.error).toBe('malformed_verdicts');
    });

    it('returns originals when verdicts is not an array', async () => {
      const findings = [makeFinding({ id: 'A' })];
      createMock.mockResolvedValueOnce({
        content: [{ type: 'tool_use', name: 'report_critique_verdicts', input: { verdicts: 'oops' } }],
      });
      const result = await critiqueFindings('source', findings);
      expect(result.findings).toEqual(findings);
      expect(result.stats.failedOpen).toBe(true);
    });
  });

  describe('input handling', () => {
    it('truncates the source code at the configured ceiling', async () => {
      const giantSource = 'a'.repeat(500_000);
      const findings = [makeFinding({ id: 'A' })];
      mockCriticResponse([{ finding_id: 'A', verdict: 'keep', reasoning: 'real' }]);
      await critiqueFindings(giantSource, findings);
      // Inspect the user message that was sent — should have been truncated.
      const userMessage = createMock.mock.calls[0][0].messages[0].content as string;
      expect(userMessage.length).toBeLessThan(giantSource.length + 5000); // user message has overhead but not the full source twice
      expect(userMessage).toContain('source truncated');
    });

    it('handles findings without code_snippet (architectural)', async () => {
      const findings = [makeFinding({ id: 'A', code_snippet: undefined })];
      mockCriticResponse([{ finding_id: 'A', verdict: 'keep', reasoning: 'real' }]);
      const result = await critiqueFindings('source', findings);
      expect(result.findings).toHaveLength(1);
    });
  });
});
