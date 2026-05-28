// Stability tests for the finding hash. These tests pin down the invariants
// that the baseline-diff feature depends on: same finding → same hash across
// expected runtime variance; different findings → different hashes.

import { describe, it, expect } from 'vitest';
import { hashFinding } from '@/lib/baselines/findingHash';
import { diffAgainstBaseline } from '@/lib/baselines/diff';
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

describe('hashFinding — stability invariants', () => {
  it('produces identical hash for the same finding twice', () => {
    expect(hashFinding(f())).toBe(hashFinding(f()));
  });

  it('is stable across line number shifts in location', () => {
    expect(hashFinding(f({ location: 'app/api/users/route.ts:42' })))
      .toBe(hashFinding(f({ location: 'app/api/users/route.ts:118' })));
  });

  it('is stable across severity changes (model may upgrade/downgrade)', () => {
    expect(hashFinding(f({ severity: 'high' })))
      .toBe(hashFinding(f({ severity: 'critical' })));
  });

  it('is stable across confidence changes (model variance)', () => {
    expect(hashFinding(f({ confidence: 'certain' })))
      .toBe(hashFinding(f({ confidence: 'likely' })));
  });

  it('is stable across remediation phrasing changes', () => {
    expect(hashFinding(f({ remediation: 'Use parameterised queries.' })))
      .toBe(hashFinding(f({ remediation: 'Switch to parameterised queries to prevent injection.' })));
  });

  it('is stable across whitespace/indentation in code_snippet', () => {
    const a = f({ code_snippet: "const user = await db.query('SELECT * FROM users WHERE id = ' + id)" });
    const b = f({ code_snippet: "  const user = await db.query('SELECT * FROM users WHERE id = ' + id)" });
    expect(hashFinding(a)).toBe(hashFinding(b));
  });

  it('is stable across punctuation/markdown noise in title', () => {
    expect(hashFinding(f({ title: 'SQL injection in user lookup' })))
      .toBe(hashFinding(f({ title: 'SQL injection in user lookup.' })));
    expect(hashFinding(f({ title: '`SQL` injection in user lookup' })))
      .toBe(hashFinding(f({ title: 'SQL injection in user lookup' })));
  });

  it('is stable when only the finding id differs (id is model-generated)', () => {
    expect(hashFinding(f({ id: 'finding-001' })))
      .toBe(hashFinding(f({ id: 'finding-002' })));
  });
});

describe('hashFinding — separation invariants', () => {
  it('changes when the file path changes', () => {
    expect(hashFinding(f({ location: 'app/api/users/route.ts:42' })))
      .not.toBe(hashFinding(f({ location: 'app/api/posts/route.ts:42' })));
  });

  it('changes when the title means something different', () => {
    expect(hashFinding(f({ title: 'SQL injection in user lookup' })))
      .not.toBe(hashFinding(f({ title: 'XSS in user profile rendering' })));
  });

  it('changes when classification changes (vulnerability vs suggestion)', () => {
    expect(hashFinding(f({ classification: 'vulnerability' })))
      .not.toBe(hashFinding(f({ classification: 'suggestion' })));
  });

  it('changes when the underlying code (snippet) is rewritten', () => {
    expect(hashFinding(f({ code_snippet: "await db.query('SELECT * FROM users WHERE id = ' + id)" })))
      .not.toBe(hashFinding(f({ code_snippet: "await db.query('SELECT * FROM users WHERE id = $1', [id])" })));
  });
});

describe('hashFinding — degenerate inputs', () => {
  it('hashes findings with no location', () => {
    const h = hashFinding(f({ location: undefined }));
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashes findings with no snippet', () => {
    const h = hashFinding(f({ code_snippet: undefined }));
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it('a missing-snippet finding hashes differently from one with the snippet', () => {
    expect(hashFinding(f({ code_snippet: undefined })))
      .not.toBe(hashFinding(f()));
  });
});

describe('diffAgainstBaseline', () => {
  it('returns every finding as new when baseline is empty', () => {
    const findings = [f({ id: 'a' }), f({ id: 'b', title: 'XSS in profile' })];
    const result = diffAgainstBaseline(findings, new Set());
    expect(result.newFindings).toHaveLength(2);
    expect(result.preExisting).toHaveLength(0);
    expect(result.newHashes).toHaveLength(2);
  });

  it('suppresses findings whose hash is in the baseline', () => {
    const known = f({ id: 'a' });
    const fresh = f({ id: 'b', title: 'XSS in profile' });
    const baseline = new Set([hashFinding(known)]);
    const result = diffAgainstBaseline([known, fresh], baseline);
    expect(result.newFindings).toHaveLength(1);
    expect(result.newFindings[0].title).toBe('XSS in profile');
    expect(result.preExisting).toHaveLength(1);
  });

  it('still treats a finding as pre-existing when line shifted (line not in hash)', () => {
    const original = f({ location: 'app/api/users/route.ts:42' });
    const shifted = f({ id: 'b', location: 'app/api/users/route.ts:177' });
    const baseline = new Set([hashFinding(original)]);
    const { newFindings, preExisting } = diffAgainstBaseline([shifted], baseline);
    expect(newFindings).toHaveLength(0);
    expect(preExisting).toHaveLength(1);
  });
});
