import { describe, it, expect } from 'vitest';
import { annotateBlastRadius, groupByBlastRadius } from '@/lib/agents/blastRadius';
import type { DependencyGraph } from '@/lib/chunking/dependencyGraph';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

function f(location: string | undefined): StructuredFinding {
  return {
    id: 'f',
    severity: 'high',
    confidence: 'certain',
    classification: 'vulnerability',
    title: 't',
    location,
    remediation: 'r',
  };
}

const graph: DependencyGraph = {
  edges: [
    // lib/auth.ts imported by FIVE other files → shared
    { from: 'app/api/a/route.ts', to: 'lib/auth.ts', specifier: '@/lib/auth' },
    { from: 'app/api/b/route.ts', to: 'lib/auth.ts', specifier: '@/lib/auth' },
    { from: 'app/api/c/route.ts', to: 'lib/auth.ts', specifier: '@/lib/auth' },
    { from: 'app/api/d/route.ts', to: 'lib/auth.ts', specifier: '@/lib/auth' },
    { from: 'app/api/e/route.ts', to: 'lib/auth.ts', specifier: '@/lib/auth' },
    // lib/utils.ts imported by 2 → module
    { from: 'app/api/a/route.ts', to: 'lib/utils.ts', specifier: '@/lib/utils' },
    { from: 'app/api/b/route.ts', to: 'lib/utils.ts', specifier: '@/lib/utils' },
    // app/api/a/route.ts imports stuff but nobody imports it → leaf (0 in-degree)
  ],
  hotImports: [],
  hotImporters: [],
};

describe('annotateBlastRadius', () => {
  it('tags shared (4+ importers)', () => {
    const r = annotateBlastRadius([f('lib/auth.ts:42')], graph);
    expect(r[0].tier).toBe('shared');
    expect(r[0].importerCount).toBe(5);
  });

  it('tags module (1–3 importers)', () => {
    const r = annotateBlastRadius([f('lib/utils.ts:7')], graph);
    expect(r[0].tier).toBe('module');
    expect(r[0].importerCount).toBe(2);
  });

  it('tags leaf (0 importers — file is in graph but nothing imports it)', () => {
    const r = annotateBlastRadius([f('app/api/a/route.ts:10')], graph);
    expect(r[0].tier).toBe('leaf');
    expect(r[0].importerCount).toBe(0);
  });

  it('tags unknown when the location does not match any graph node', () => {
    const r = annotateBlastRadius([f('totally/unknown/file.ts')], graph);
    expect(r[0].tier).toBe('unknown');
  });

  it('tags unknown when location is missing', () => {
    const r = annotateBlastRadius([f(undefined)], graph);
    expect(r[0].tier).toBe('unknown');
  });

  it('tolerates location strings with extra context', () => {
    const r = annotateBlastRadius([f('see lib/auth.ts:42 in middleware')], graph);
    expect(r[0].tier).toBe('shared');
  });

  it('preserves input order in the output array', () => {
    const r = annotateBlastRadius(
      [f('lib/auth.ts'), f('lib/utils.ts'), f('app/api/a/route.ts'), f(undefined)],
      graph,
    );
    expect(r.map((x) => x.tier)).toEqual(['shared', 'module', 'leaf', 'unknown']);
  });
});

describe('groupByBlastRadius', () => {
  it('groups findings into the right buckets', () => {
    const findings = [f('lib/auth.ts'), f('lib/utils.ts'), f('lib/utils.ts'), f(undefined)];
    const annotations = annotateBlastRadius(findings, graph);
    const groups = groupByBlastRadius(findings, annotations);
    expect(groups.shared).toHaveLength(1);
    expect(groups.module).toHaveLength(2);
    expect(groups.unknown).toHaveLength(1);
  });
});
