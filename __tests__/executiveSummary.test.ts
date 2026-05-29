// Tests for executive summary shape + zero-findings short-circuit. The
// model call itself isn't unit-tested — that's covered by the
// integration test in app/api/audit/[id]/exec-summary which mocks the
// Anthropic client. Here we verify:
//   1. Zero findings → deterministic output, no model call.
//   2. The shape carries all 5 fields (headline / topRisks /
//      productionImpact / fixEffort / recommendedAction).
//   3. topRisks caps at 3 (the user's spec says "top 3").
//   4. Parser is tolerant of missing optional fields in model output
//      (recovers to '' rather than crashing).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

// Mock the Anthropic client BEFORE importing the module under test so the
// module-level `new Anthropic()` picks up our mock. Default export shape
// matches @anthropic-ai/sdk.
vi.mock('@anthropic-ai/sdk', () => {
  const create = vi.fn();
  class Anthropic {
    messages = { create };
  }
  return { default: Anthropic, __mockCreate: create };
});

import { generateExecutiveSummary } from '@/lib/ai/executiveSummary';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreate = (await import('@anthropic-ai/sdk') as any).__mockCreate as ReturnType<typeof vi.fn>;

function f(overrides: Partial<StructuredFinding> = {}): StructuredFinding {
  return {
    id: 'f1',
    severity: 'high',
    confidence: 'certain',
    classification: 'vulnerability',
    title: 'Bearer token compared with string equality',
    location: 'app/api/webhooks/route.ts:42',
    code_snippet: 'if (token === expected) { ... }',
    remediation: 'Use timingSafeEqual.',
    ...overrides,
  };
}

beforeEach(() => {
  mockCreate.mockReset();
});

describe('generateExecutiveSummary — zero findings short-circuit', () => {
  it('returns deterministic 5-field output without calling the model', async () => {
    const summary = await generateExecutiveSummary({ findings: [], score: 100 });
    expect(summary.headline).toContain('100/100');
    expect(summary.topRisks).toEqual([]);
    expect(summary.productionImpact).toBe('No expected impact.');
    expect(summary.fixEffort).toBe('Nothing to fix.');
    expect(summary.recommendedAction).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('generateExecutiveSummary — model response parsing', () => {
  it('passes through all five fields when the model emits the full shape', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          headline: 'Two auth issues block ship.',
          topRisks: ['Webhook auth uses string equality', 'Session secret in env without rotation'],
          productionImpact: 'An attacker who guesses the token can post arbitrary webhook payloads. Oncall would see noise but not the breach itself.',
          fixEffort: 'A day. Both fixes are localised.',
          recommendedAction: 'Fix the two auth findings before shipping; everything else can wait.',
        }),
      }],
    });
    const summary = await generateExecutiveSummary({ findings: [f()], score: 65 });
    expect(summary.headline).toBe('Two auth issues block ship.');
    expect(summary.topRisks).toHaveLength(2);
    expect(summary.productionImpact).toMatch(/attacker who guesses/);
    expect(summary.fixEffort).toBe('A day. Both fixes are localised.');
    expect(summary.recommendedAction).toMatch(/before shipping/);
  });

  it('caps topRisks at 3 even if the model emits more', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          headline: 'Many issues.',
          topRisks: ['risk 1', 'risk 2', 'risk 3', 'risk 4', 'risk 5'],
          productionImpact: 'x',
          fixEffort: 'y',
          recommendedAction: 'z',
        }),
      }],
    });
    const summary = await generateExecutiveSummary({ findings: [f()], score: 40 });
    expect(summary.topRisks).toEqual(['risk 1', 'risk 2', 'risk 3']);
  });

  it('survives partial output — missing fields degrade to empty strings', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({ headline: 'Only the headline came back.' }),
      }],
    });
    const summary = await generateExecutiveSummary({ findings: [f()], score: 50 });
    expect(summary.headline).toBe('Only the headline came back.');
    expect(summary.topRisks).toEqual([]);
    expect(summary.productionImpact).toBe('');
    expect(summary.fixEffort).toBe('');
    expect(summary.recommendedAction).toBe('');
  });

  it('survives non-JSON output by falling back to the raw text as headline', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json at all' }],
    });
    const summary = await generateExecutiveSummary({ findings: [f()], score: 50 });
    expect(summary.headline).toBe('not json at all');
    expect(summary.topRisks).toEqual([]);
    expect(summary.productionImpact).toBe('');
    expect(summary.fixEffort).toBe('');
  });

  it('strips ```json fences if the model includes them', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: '```json\n{"headline":"fenced","topRisks":[],"productionImpact":"","fixEffort":"","recommendedAction":""}\n```',
      }],
    });
    const summary = await generateExecutiveSummary({ findings: [f()], score: 80 });
    expect(summary.headline).toBe('fenced');
  });
});
