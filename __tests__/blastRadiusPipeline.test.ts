// Tests for the audit-pipeline integration of blast radius — specifically
// the contract we attach to findings after demotion and how the parser
// rehydrates the annotation on read.
//
// The annotator itself is covered by __tests__/blastRadius.test.ts. This
// file covers:
//   1. StructuredFinding accepts blastRadius? without breaking the existing
//      validators.
//   2. parseAuditResult round-trips the blastRadius field through the
//      structured-findings block.
//   3. A finding whose location can't be mapped to the graph stays at
//      tier='unknown' and is filtered out of the audit-side merge (we only
//      attach blastRadius when tier !== 'unknown').

import { describe, it, expect } from 'vitest';
import { parseAuditResult } from '@/lib/parseAuditResult';
import { annotateBlastRadius } from '@/lib/agents/blastRadius';
import type { StructuredFinding, BlastRadiusAnnotation } from '@/lib/ai/findingSchema';
import type { DependencyGraph } from '@/lib/chunking/dependencyGraph';

const sharedFinding: StructuredFinding = {
  id: 'F1',
  severity: 'high',
  confidence: 'certain',
  classification: 'vulnerability',
  title: 'Auth bypass',
  location: 'lib/auth.ts:42',
  remediation: 'Validate.',
};

const leafFinding: StructuredFinding = {
  id: 'F2',
  severity: 'medium',
  confidence: 'likely',
  classification: 'deficiency',
  title: 'Loose error handling',
  location: 'app/api/leaf/route.ts:8',
  remediation: 'Add try.',
};

const graph: DependencyGraph = {
  edges: [
    { from: 'app/api/a/route.ts', to: 'lib/auth.ts', specifier: '@/lib/auth' },
    { from: 'app/api/b/route.ts', to: 'lib/auth.ts', specifier: '@/lib/auth' },
    { from: 'app/api/c/route.ts', to: 'lib/auth.ts', specifier: '@/lib/auth' },
    { from: 'app/api/d/route.ts', to: 'lib/auth.ts', specifier: '@/lib/auth' },
  ],
  hotImports: [],
  hotImporters: [],
};

describe('blast-radius pipeline contract', () => {
  it('annotator + per-finding merge produces a serialisable shape', () => {
    const findings = [sharedFinding, leafFinding];
    const annotations = annotateBlastRadius(findings, graph);
    const merged = findings.map((f, i) => {
      const ann = annotations[i];
      return ann && ann.tier !== 'unknown' ? { ...f, blastRadius: ann } : f;
    });

    // The merge skips 'unknown' tiers — leaf's location isn't in the graph
    // here (only lib/auth.ts is), so the second finding stays untouched.
    expect(merged[0].blastRadius).toBeDefined();
    expect(merged[0].blastRadius?.tier).toBe('shared');
    expect(merged[0].blastRadius?.importerCount).toBe(4);
    expect(merged[1].blastRadius).toBeUndefined();

    // Round-trip through JSON — this is the wire format we persist into the
    // audit result block.
    const wire = JSON.parse(JSON.stringify(merged)) as StructuredFinding[];
    expect(wire[0].blastRadius?.tier).toBe('shared');
    expect(wire[0].blastRadius?.importerCount).toBe(4);
  });

  it('parseAuditResult hydrates blastRadius onto Finding rows', () => {
    const ann: BlastRadiusAnnotation = { tier: 'shared', importerCount: 4 };
    const structuredFindings = [{ ...sharedFinding, blastRadius: ann }];
    const md =
      '# Audit\nScore: 70/100\n\n' +
      '<!-- STRUCTURED_FINDINGS_START -->\n' +
      JSON.stringify(structuredFindings) +
      '\n<!-- STRUCTURED_FINDINGS_END -->\n';
    const metrics = parseAuditResult(md);
    expect(metrics.findings).toHaveLength(1);
    expect(metrics.findings[0].blastRadius?.tier).toBe('shared');
    expect(metrics.findings[0].blastRadius?.importerCount).toBe(4);
  });

  it('parseAuditResult leaves blastRadius undefined when not in the block', () => {
    const md =
      '# Audit\nScore: 90/100\n\n' +
      '<!-- STRUCTURED_FINDINGS_START -->\n' +
      JSON.stringify([sharedFinding]) +
      '\n<!-- STRUCTURED_FINDINGS_END -->\n';
    const metrics = parseAuditResult(md);
    expect(metrics.findings[0].blastRadius).toBeUndefined();
  });
});
