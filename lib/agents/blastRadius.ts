// Annotate findings with a "blast radius" tier indicating how widely the
// affected file is depended on by other files in the same audit input.
//
// Tiers:
//   leaf    — no other file in the bundle imports this file. Local risk;
//             a bug here doesn't propagate elsewhere.
//   module  — 1–3 other files import it. Bounded impact.
//   shared  — 4+ files import it. Cross-cutting; one bug here can cascade.
//   unknown — finding has no locatable file (no `location` we can map to a
//             bundled path), so we can't compute distance.
//
// Uses the existing dependency graph (lib/chunking/dependencyGraph.ts) so
// there's no extra parsing cost — graph is already computed for every
// audit and lives in cache. This is a pure post-processing step on top.

import type { DependencyGraph } from '@/lib/chunking/dependencyGraph';
import type {
  StructuredFinding,
  BlastRadiusAnnotation,
  BlastRadiusTier,
} from '@/lib/ai/findingSchema';

// Re-export so callers can keep importing from this module — the canonical
// definitions live in findingSchema.ts alongside StructuredFinding.
export type { BlastRadiusAnnotation, BlastRadiusTier };

const PATH_PATTERN = /([\w./@-]+\.[a-zA-Z]+)/;

function extractPath(location: string | undefined | null): string | null {
  if (!location) return null;
  const m = location.match(PATH_PATTERN);
  return m ? m[1] : null;
}

/**
 * Build a map of path → number of files in the audit that import it.
 * Cheap O(edges) pass; the graph itself was already computed upstream.
 */
function buildInDegreeMap(graph: DependencyGraph): Map<string, number> {
  const inDegree = new Map<string, number>();
  for (const edge of graph.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }
  return inDegree;
}

function classify(importerCount: number): BlastRadiusTier {
  if (importerCount === 0) return 'leaf';
  if (importerCount <= 3) return 'module';
  return 'shared';
}

/**
 * Compute blast-radius annotations for a list of findings against a graph.
 * Returns the same array length, indexed the same way.
 *
 * Match is "exact path or trailing-path match" — the finding's location
 * field might say `app/api/users/route.ts` while the bundle uses the same
 * path; both should match. Falls back to `unknown` when we can't resolve.
 */
export function annotateBlastRadius(
  findings: StructuredFinding[],
  graph: DependencyGraph,
): BlastRadiusAnnotation[] {
  const inDegree = buildInDegreeMap(graph);
  // Pre-compute lowercase keys for tolerant matching.
  const lowerToPath = new Map<string, string>();
  for (const path of inDegree.keys()) lowerToPath.set(path.toLowerCase(), path);
  for (const e of graph.edges) {
    lowerToPath.set(e.from.toLowerCase(), e.from);
    lowerToPath.set(e.to.toLowerCase(), e.to);
  }

  return findings.map((f) => {
    const path = extractPath(f.location);
    if (!path) return { tier: 'unknown', importerCount: 0 };

    const lookup = path.toLowerCase();
    const matched =
      lowerToPath.get(lookup) ??
      // Trailing-path match: graph has `app/api/route.ts`, finding says `api/route.ts`
      [...lowerToPath.keys()].find((p) => p.endsWith('/' + lookup) || lookup.endsWith('/' + p));

    if (!matched) return { tier: 'unknown', importerCount: 0 };
    const fullPath = lowerToPath.get(matched) ?? matched;
    const count = inDegree.get(fullPath) ?? 0;
    return { tier: classify(count), importerCount: count };
  });
}

/**
 * Group findings by blast-radius tier. Useful for the walkthrough summary
 * where we surface shared-tier findings first (highest impact).
 */
export function groupByBlastRadius(
  findings: StructuredFinding[],
  annotations: BlastRadiusAnnotation[],
): Record<BlastRadiusTier, StructuredFinding[]> {
  const groups: Record<BlastRadiusTier, StructuredFinding[]> = {
    shared: [],
    module: [],
    leaf: [],
    unknown: [],
  };
  for (let i = 0; i < findings.length; i++) {
    const tier = annotations[i]?.tier ?? 'unknown';
    groups[tier].push(findings[i]);
  }
  return groups;
}
