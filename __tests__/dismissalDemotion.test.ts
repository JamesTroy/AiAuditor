// Pure-function tests for dismissal-driven demotion. Exercises the bucket
// thresholds, severity/confidence step tables, demotion metadata shape,
// and the per-finding apply logic. Database queries are not exercised here
// — they're covered indirectly via the dismiss + audit integration paths.

import { describe, it, expect } from 'vitest';
import {
  bucketFor,
  demoteSeverity,
  demoteConfidence,
  applyDemotionsToFindings,
} from '@/lib/baselines/dismissalDemotion';
import { hashFinding } from '@/lib/baselines/findingHash';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

function f(overrides: Partial<StructuredFinding> = {}): StructuredFinding {
  return {
    id: 'f1',
    severity: 'high',
    confidence: 'certain',
    classification: 'vulnerability',
    title: 'SQL injection in user lookup',
    location: 'app/api/users/route.ts:42',
    code_snippet: "const user = await db.query('SELECT * FROM users WHERE id = ' + id)",
    remediation: 'Use parameterised queries.',
    ...overrides,
  };
}

describe('bucketFor', () => {
  it('returns null below threshold', () => {
    expect(bucketFor(0)).toBeNull();
    expect(bucketFor(1)).toBeNull();
    expect(bucketFor(2)).toBeNull();
  });

  it('returns soft bucket at 3, 4 net dismissals', () => {
    expect(bucketFor(3)).toEqual({ sevSteps: 1, confSteps: 1, bucket: 'soft' });
    expect(bucketFor(4)).toEqual({ sevSteps: 1, confSteps: 1, bucket: 'soft' });
  });

  it('returns strong bucket at 5+', () => {
    expect(bucketFor(5)).toEqual({ sevSteps: 2, confSteps: 1, bucket: 'strong' });
    expect(bucketFor(100)).toEqual({ sevSteps: 2, confSteps: 1, bucket: 'strong' });
  });
});

describe('demoteSeverity', () => {
  it('drops one step', () => {
    expect(demoteSeverity('critical', 1)).toBe('high');
    expect(demoteSeverity('high', 1)).toBe('medium');
    expect(demoteSeverity('medium', 1)).toBe('low');
    expect(demoteSeverity('low', 1)).toBe('informational');
  });

  it('drops two steps', () => {
    expect(demoteSeverity('critical', 2)).toBe('medium');
    expect(demoteSeverity('high', 2)).toBe('low');
  });

  it('floors at informational', () => {
    expect(demoteSeverity('informational', 1)).toBe('informational');
    expect(demoteSeverity('low', 2)).toBe('informational');
    expect(demoteSeverity('informational', 5)).toBe('informational');
  });
});

describe('demoteConfidence', () => {
  it('drops one step', () => {
    expect(demoteConfidence('certain', 1)).toBe('likely');
    expect(demoteConfidence('likely', 1)).toBe('possible');
  });

  it('floors at possible', () => {
    expect(demoteConfidence('possible', 1)).toBe('possible');
    expect(demoteConfidence('possible', 9)).toBe('possible');
  });
});

describe('applyDemotionsToFindings', () => {
  it('leaves findings unchanged when count map is empty', () => {
    const findings = [f()];
    const result = applyDemotionsToFindings(findings, new Map(), 'user');
    expect(result.findings[0]).toEqual(findings[0]);
    expect(result.demotedCount).toBe(0);
    expect(result.learnedPatternCount).toBe(0);
  });

  it('demotes a finding whose hash is in the soft bucket', () => {
    const finding = f();
    const counts = new Map([[hashFinding(finding), 3]]);
    const result = applyDemotionsToFindings([finding], counts, 'user');
    expect(result.findings[0].severity).toBe('medium');     // high → medium
    expect(result.findings[0].confidence).toBe('likely');   // certain → likely
    expect(result.findings[0].demotion).toEqual({
      netDismissals: 3,
      originalSeverity: 'high',
      originalConfidence: 'certain',
      bucket: 'soft',
      scope: 'user',
    });
    expect(result.demotedCount).toBe(1);
    expect(result.learnedPatternCount).toBe(1);
  });

  it('demotes more aggressively in the strong bucket', () => {
    const finding = f({ severity: 'critical' });
    const counts = new Map([[hashFinding(finding), 7]]);
    const result = applyDemotionsToFindings([finding], counts, 'organization');
    expect(result.findings[0].severity).toBe('medium');   // critical → medium (2 steps)
    expect(result.findings[0].confidence).toBe('likely'); // certain → likely (1 step)
    expect(result.findings[0].demotion?.bucket).toBe('strong');
    expect(result.findings[0].demotion?.scope).toBe('organization');
  });

  it('does not demote findings whose hash is below threshold', () => {
    const finding = f();
    const counts = new Map([[hashFinding(finding), 2]]);
    const result = applyDemotionsToFindings([finding], counts, 'user');
    expect(result.findings[0]).toEqual(finding);
    expect(result.demotedCount).toBe(0);
  });

  it('counts learned patterns independently of how many fire in this audit', () => {
    // Three patterns past threshold but only one is in this audit's findings.
    const present = f({ title: 'present pattern' });
    const counts = new Map([
      [hashFinding(present), 5],
      ['otherhash1', 4],
      ['otherhash2', 3],
    ]);
    const result = applyDemotionsToFindings([present], counts, 'user');
    expect(result.demotedCount).toBe(1);
    expect(result.learnedPatternCount).toBe(3);
  });

  it('preserves order and untouched fields on the returned array', () => {
    const a = f({ title: 'a', id: 'a1' });
    const b = f({ title: 'b', id: 'b1' });
    const c = f({ title: 'c', id: 'c1' });
    const counts = new Map([[hashFinding(b), 4]]);
    const result = applyDemotionsToFindings([a, b, c], counts, 'user');
    expect(result.findings.map((x) => x.id)).toEqual(['a1', 'b1', 'c1']);
    expect(result.findings[0]).toEqual(a);
    expect(result.findings[2]).toEqual(c);
    expect(result.findings[1].demotion).toBeDefined();
  });
});
