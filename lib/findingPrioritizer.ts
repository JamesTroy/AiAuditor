// WORKFLOW-004: Priority-based finding ordering.
// Post-processing workflow that reorders validated findings using a weighted
// priority score. Groups findings by affected file, then sorts by priority
// within each file. Produces a prioritized view for the dashboard.

import type { ValidatedFinding } from '@/lib/validateFindings';

export interface PrioritizedFinding extends ValidatedFinding {
  /** Computed priority score (0-100, higher = more important). */
  priorityScore: number;
  /** Human-readable priority tier. */
  tier: 'critical-action' | 'high-priority' | 'should-fix' | 'consider' | 'informational';
}

export interface PrioritizedResult {
  findings: PrioritizedFinding[];
  /** Findings grouped by file path (if file info is available). */
  byFile: Map<string, PrioritizedFinding[]>;
  /** Summary counts per tier. */
  tierCounts: Record<PrioritizedFinding['tier'], number>;
}

// ── Weight constants ───────────────────────────────────────────

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
  informational: 10,
};

const CONFIDENCE_WEIGHTS: Record<string, number> = {
  certain: 100,
  likely: 65,
  possible: 30,
};

const CLASSIFICATION_WEIGHTS: Record<string, number> = {
  vulnerability: 100,
  deficiency: 60,
  suggestion: 20,
};

/**
 * Compute a weighted priority score for a finding.
 * Formula: (severity × 0.40) + (confidence × 0.30) + (classification × 0.20) + (evidence × 0.10)
 */
function computePriority(finding: ValidatedFinding): number {
  const severityScore = SEVERITY_WEIGHTS[finding.severity] ?? 0;
  const confidenceScore = CONFIDENCE_WEIGHTS[finding.confidence] ?? 0;
  const classificationScore = CLASSIFICATION_WEIGHTS[finding.classification] ?? 0;
  const evidenceScore = finding.validated ? 100 : (finding.code_snippet ? 50 : 0);

  return Math.round(
    severityScore * 0.40 +
    confidenceScore * 0.30 +
    classificationScore * 0.20 +
    evidenceScore * 0.10,
  );
}

/**
 * Assign a human-readable tier based on priority score.
 */
function assignTier(score: number): PrioritizedFinding['tier'] {
  if (score >= 85) return 'critical-action';
  if (score >= 65) return 'high-priority';
  if (score >= 45) return 'should-fix';
  if (score >= 25) return 'consider';
  return 'informational';
}

/**
 * Extract a file path from finding location or id.
 * Returns 'general' if no file path can be determined.
 */
function extractFilePath(finding: ValidatedFinding): string {
  // Try to extract from location field
  if (finding.location) {
    // Match patterns like "file.ts:L42" or "path/to/file.ts line 42"
    const fileMatch = finding.location.match(/^([^\s:]+\.\w+)/);
    if (fileMatch) return fileMatch[1];
  }

  // Try to extract from the id (e.g., VULN-001 doesn't have file info)
  return 'general';
}

/**
 * Prioritize and reorder validated findings by weighted score.
 * Groups by file and sorts by priority within each group.
 */
export function prioritizeFindings(
  findings: ValidatedFinding[],
): PrioritizedResult {
  // Score and tier each finding
  const prioritized: PrioritizedFinding[] = findings.map((f) => {
    const priorityScore = computePriority(f);
    return {
      ...f,
      priorityScore,
      tier: assignTier(priorityScore),
    };
  });

  // Sort by priority descending
  prioritized.sort((a, b) => b.priorityScore - a.priorityScore);

  // Group by file
  const byFile = new Map<string, PrioritizedFinding[]>();
  for (const f of prioritized) {
    const file = extractFilePath(f);
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file)!.push(f);
  }

  // Count per tier
  const tierCounts: Record<PrioritizedFinding['tier'], number> = {
    'critical-action': 0,
    'high-priority': 0,
    'should-fix': 0,
    'consider': 0,
    'informational': 0,
  };
  for (const f of prioritized) {
    tierCounts[f.tier]++;
  }

  return { findings: prioritized, byFile, tierCounts };
}

/**
 * Format prioritized findings as a JSON block for embedding in stored results.
 */
export function formatPrioritizedFindings(result: PrioritizedResult): string {
  const summary = {
    totalFindings: result.findings.length,
    tierCounts: result.tierCounts,
    findings: result.findings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      confidence: f.confidence,
      classification: f.classification,
      priorityScore: f.priorityScore,
      tier: f.tier,
      validated: f.validated,
      location: f.location,
    })),
  };

  return JSON.stringify(summary);
}
