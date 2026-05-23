// RULE-001: Lightweight dependency graph extraction from multi-file inputs.
// Parses import/require/from statements across TS/JS, Python, Go, Rust, and Java
// to build a directed graph of file dependencies. Injected as a <dependency_graph>
// block into the audit prompt so agents understand cross-file data flow.

import type { FileChunk } from './splitByFile';

export interface DependencyEdge {
  from: string;
  to: string;
  /** The raw import specifier (e.g., './auth', '@/lib/db') */
  specifier: string;
}

export interface DependencyGraph {
  edges: DependencyEdge[];
  /** Files that are imported by many others — likely core modules. */
  hotImports: { path: string; inDegree: number }[];
  /** Files that import many others — likely orchestrators/entry points. */
  hotImporters: { path: string; outDegree: number }[];
}

// Import patterns by language family
const IMPORT_PATTERNS: RegExp[] = [
  // JS/TS: import ... from 'path'  |  import 'path'  |  require('path')
  /\bimport\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Dynamic import: import('path')
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Python: from module import ...  |  import module
  /\bfrom\s+([\w.]+)\s+import\b/g,
  /\bimport\s+([\w.]+)/g,
  // Go: import "path" | import ( "path" )
  /\bimport\s+(?:\w+\s+)?["']([^"']+)["']/g,
  // Rust: use crate::module  |  mod module
  /\buse\s+(crate::[\w:]+)/g,
  /\bmod\s+(\w+)\s*;/g,
  // Java/Kotlin: import package.Class
  /\bimport\s+(?:static\s+)?([\w.]+)/g,
];

/**
 * Resolve a relative import specifier against a source file path.
 * Returns a normalised path for matching against file chunks.
 *
 * Example: from='src/api/route.ts', specifier='../lib/auth' → 'src/lib/auth'
 */
function resolveSpecifier(fromPath: string, specifier: string): string {
  // Absolute / package imports — return as-is (may match via basename)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return specifier;
  }

  const fromDir = fromPath.includes('/')
    ? fromPath.substring(0, fromPath.lastIndexOf('/'))
    : '';

  const parts = fromDir ? fromDir.split('/') : [];
  const specParts = specifier.split('/');

  for (const part of specParts) {
    if (part === '.') continue;
    if (part === '..') {
      parts.pop();
    } else {
      parts.push(part);
    }
  }

  return parts.join('/');
}

/**
 * Try to match a resolved specifier to a known file chunk path.
 * Handles missing extensions and index files.
 */
function findMatchingChunk(
  resolved: string,
  chunkPaths: Set<string>,
  pathBasenames: Map<string, string>,
): string | null {
  // Direct match
  if (chunkPaths.has(resolved)) return resolved;

  // Try common extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.kt'];
  for (const ext of extensions) {
    if (chunkPaths.has(resolved + ext)) return resolved + ext;
  }

  // Try index files
  for (const ext of extensions) {
    const indexPath = resolved + '/index' + ext;
    if (chunkPaths.has(indexPath)) return indexPath;
  }

  // Try matching by basename (for package/module imports like '@/lib/auth')
  const basename = resolved.split('/').pop() ?? resolved;
  const match = pathBasenames.get(basename);
  if (match) return match;

  return null;
}

/**
 * Extract a dependency graph from a set of file chunks.
 * Returns edges and identifies hot (highly-connected) files.
 */
export function extractDependencyGraph(chunks: FileChunk[]): DependencyGraph {
  if (chunks.length < 2) {
    return { edges: [], hotImports: [], hotImporters: [] };
  }

  const chunkPaths = new Set(chunks.map((c) => c.path));
  // Map basename → full path (for package import matching)
  const pathBasenames = new Map<string, string>();
  for (const path of chunkPaths) {
    const base = path.split('/').pop()?.replace(/\.\w+$/, '') ?? path;
    // Only set if not already taken (avoid collisions)
    if (!pathBasenames.has(base)) pathBasenames.set(base, path);
  }

  const edges: DependencyEdge[] = [];
  const seenEdges = new Set<string>();

  for (const chunk of chunks) {
    for (const pattern of IMPORT_PATTERNS) {
      // Reset lastIndex for each chunk
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(chunk.content)) !== null) {
        const specifier = match[1];
        if (!specifier) continue;

        const resolved = resolveSpecifier(chunk.path, specifier);
        const target = findMatchingChunk(resolved, chunkPaths, pathBasenames);

        if (target && target !== chunk.path) {
          const edgeKey = `${chunk.path}→${target}`;
          if (!seenEdges.has(edgeKey)) {
            seenEdges.add(edgeKey);
            edges.push({ from: chunk.path, to: target, specifier });
          }
        }
      }
    }
  }

  // Compute in-degree (imported by others) and out-degree (imports others)
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
  }

  // Top hot imports (most depended-upon files)
  const hotImports = [...inDegree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .filter(([, count]) => count >= 2)
    .map(([path, inDeg]) => ({ path, inDegree: inDeg }));

  // Top hot importers (orchestrators / entry points)
  const hotImporters = [...outDegree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .filter(([, count]) => count >= 2)
    .map(([path, outDeg]) => ({ path, outDegree: outDeg }));

  return { edges, hotImports, hotImporters };
}

/**
 * Format the dependency graph as a prompt-injectable block.
 * Returns null if the graph is trivial (< 2 edges).
 */
export function formatDependencyGraph(graph: DependencyGraph): string | null {
  if (graph.edges.length < 2) return null;

  const lines: string[] = [
    `[Dependency Graph — ${graph.edges.length} edges across ${new Set([...graph.edges.map((e) => e.from), ...graph.edges.map((e) => e.to)]).size} files]`,
    '',
  ];

  // Show edges (capped at 50)
  const displayEdges = graph.edges.slice(0, 50);
  for (const edge of displayEdges) {
    lines.push(`  ${edge.from} → ${edge.to}`);
  }
  if (graph.edges.length > 50) {
    lines.push(`  ... and ${graph.edges.length - 50} more edges`);
  }

  if (graph.hotImports.length > 0) {
    lines.push('');
    lines.push('Core modules (most imported):');
    for (const hi of graph.hotImports) {
      lines.push(`  ${hi.path} (imported by ${hi.inDegree} files)`);
    }
  }

  if (graph.hotImporters.length > 0) {
    lines.push('');
    lines.push('Orchestrators (most imports):');
    for (const ho of graph.hotImporters) {
      lines.push(`  ${ho.path} (imports ${ho.outDegree} files)`);
    }
  }

  return lines.join('\n');
}
