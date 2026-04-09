/**
 * Cross-agent finding deduplication.
 *
 * When a user runs multiple agents on the same code, the same underlying issue
 * often surfaces in several reports under slightly different titles — e.g.
 * "SQL injection via string concatenation" in the Security agent and "Unsafe
 * database query construction" in the Code Quality agent. Without grouping,
 * users see the same problem N times and may think it is N separate problems.
 *
 * This module groups findings across agents by title similarity and returns
 * the groups so the UI can surface them clearly.
 */

import type { Finding } from '@/lib/parseAuditResult';

export interface AgentFindingSet {
  agentId: string;
  agentName: string;
  findings: Finding[];
}

export interface DedupEntry {
  agentId: string;
  agentName: string;
  finding: Finding;
}

/**
 * A group of findings from different agents that refer to the same root issue.
 * `entries` always has ≥ 2 items (single-agent findings are not grouped).
 */
export interface DedupGroup {
  /** The finding title from the highest-severity (or first) entry. */
  title: string;
  highestSeverity: Finding['severity'];
  entries: DedupEntry[];
}

export interface DeduplicationResult {
  /** Total findings across all agents (before deduplication). */
  totalFindings: number;
  /** Number of unique issues after merging duplicates. */
  uniqueCount: number;
  /** Groups of findings that appeared in 2+ agents. */
  duplicateGroups: DedupGroup[];
}

// ---------- Normalisation ----------

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'into',
  'via', 'and', 'or', 'but', 'not', 'no', 'if', 'that', 'this', 'it',
  'its', 'as', 'can', 'may', 'when', 'where', 'which', 'who', 'use',
  'used', 'using', 'found', 'detect', 'detected', 'potential', 'possible',
  'issue', 'issues', 'problem', 'problems', 'error', 'errors', 'risk',
  'risks', 'check', 'ensure', 'should', 'could', 'would', 'has', 'have',
]);

/** Strip finding IDs (VULN-001, SEC-123, etc.) and normalise to a token set. */
function tokenise(title: string): Set<string> {
  const cleaned = title
    .toLowerCase()
    // Remove structured IDs like VULN-001, SEC-1, CWE-89
    .replace(/\b[a-z]+-\d+\b/g, '')
    // Remove punctuation except hyphens between words
    .replace(/[^\w\s-]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  return new Set(tokens);
}

/** Jaccard similarity between two token sets. Returns 0–1. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return intersection / union;
}

/** True if the shorter title's tokens are a subset of the longer's. */
function isSubset(a: Set<string>, b: Set<string>): boolean {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  if (smaller.size === 0) return false;
  for (const t of smaller) if (!larger.has(t)) return false;
  return true;
}

const SEVERITY_RANK: Record<Finding['severity'], number> = {
  critical: 5, high: 4, medium: 3, low: 2, informational: 1,
};

function highestSeverity(entries: DedupEntry[]): Finding['severity'] {
  return entries.reduce<Finding['severity']>((best, e) => {
    return SEVERITY_RANK[e.finding.severity] > SEVERITY_RANK[best]
      ? e.finding.severity
      : best;
  }, 'informational');
}

// ---------- Public API ----------

/**
 * Deduplicate findings across multiple agent result sets.
 *
 * Two findings are considered duplicates when their normalised titles have a
 * Jaccard similarity ≥ 0.40, or when one title's tokens are a full subset of
 * the other's. Only findings from *different* agents are grouped — repeated
 * findings within the same agent are left as-is.
 *
 * Findings marked [SUGGESTION] are excluded from deduplication because they
 * are already filtered from the scored results and rarely refer to the same
 * precise issue across agents.
 */
export function deduplicateFindings(
  agentSets: AgentFindingSet[],
): DeduplicationResult {
  const SIMILARITY_THRESHOLD = 0.40;

  // Flatten all actionable findings with their source agent.
  const flat: DedupEntry[] = [];
  for (const set of agentSets) {
    for (const f of set.findings) {
      // Skip suggestions — they're already excluded from scoring
      if (f.classification === 'suggestion') continue;
      flat.push({ agentId: set.agentId, agentName: set.agentName, finding: f });
    }
  }

  const totalFindings = flat.length;
  if (totalFindings === 0) {
    return { totalFindings: 0, uniqueCount: 0, duplicateGroups: [] };
  }

  // Pre-compute token sets
  const tokens: Set<string>[] = flat.map((e) => tokenise(e.finding.title));

  // Union-Find for grouping
  const parent = flat.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  function union(i: number, j: number) {
    const pi = find(i), pj = find(j);
    if (pi !== pj) parent[pi] = pj;
  }

  // Compare every pair — O(n²) but n is small (typically < 200 findings total)
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      // Never group findings from the same agent
      if (flat[i].agentId === flat[j].agentId) continue;
      const sim = jaccard(tokens[i], tokens[j]);
      if (sim >= SIMILARITY_THRESHOLD || isSubset(tokens[i], tokens[j])) {
        union(i, j);
      }
    }
  }

  // Collect groups
  const groupMap = new Map<number, DedupEntry[]>();
  for (let i = 0; i < flat.length; i++) {
    const root = find(i);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(flat[i]);
  }

  // Separate singletons from multi-agent groups
  const duplicateGroups: DedupGroup[] = [];
  let uniqueCount = 0;

  for (const entries of groupMap.values()) {
    // Only a duplicate group when findings come from 2+ distinct agents
    const agentIds = new Set(entries.map((e) => e.agentId));
    if (agentIds.size < 2) {
      uniqueCount++;
      continue;
    }
    // Use the title from the highest-severity entry as the group representative
    const sorted = [...entries].sort(
      (a, b) => SEVERITY_RANK[b.finding.severity] - SEVERITY_RANK[a.finding.severity],
    );
    duplicateGroups.push({
      title: sorted[0].finding.title,
      highestSeverity: highestSeverity(entries),
      entries: sorted,
    });
    uniqueCount++; // the group counts as one unique issue
  }

  // Sort groups by severity descending
  duplicateGroups.sort(
    (a, b) => SEVERITY_RANK[b.highestSeverity] - SEVERITY_RANK[a.highestSeverity],
  );

  return { totalFindings, uniqueCount, duplicateGroups };
}
