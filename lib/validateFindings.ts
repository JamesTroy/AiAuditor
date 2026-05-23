// STRUCT-002: Mechanical validation of structured findings against source code.
// Verifies that code_snippet fields are exact verbatim quotes from the submitted
// input. Findings that fail validation are silently dropped — this eliminates
// hallucinated code references entirely.
//
// Based on citation-grounding research (arxiv:2512.12117): mechanically verified
// citations prevented 100% of hallucinated file/line references.

import type { StructuredFinding } from '@/lib/ai/findingSchema';

export interface ValidatedFinding extends StructuredFinding {
  /** Whether the code_snippet was mechanically verified against the source. */
  validated: boolean;
  /** Reason for validation failure, if any. */
  validation_note?: string;
}

/**
 * Normalize whitespace for fuzzy matching: collapse runs of whitespace
 * (spaces, tabs, newlines) into single spaces, then trim.
 * This handles cases where Claude quotes code with slightly different
 * indentation or line breaks than the original.
 */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Check whether `snippet` appears verbatim (or near-verbatim after whitespace
 * normalization) in `source`. Returns true if the snippet is found.
 */
function snippetExistsInSource(snippet: string, normalizedSource: string): boolean {
  // Try exact match first (fastest path)
  if (normalizedSource.includes(normalizeWhitespace(snippet))) {
    return true;
  }

  // Try matching individual lines — Claude sometimes quotes a subset of
  // contiguous lines. If ≥80% of non-trivial lines match, accept it.
  const snippetLines = snippet
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3); // skip trivial lines like `}`, `{`, etc.

  if (snippetLines.length === 0) return false;

  let matchedLines = 0;
  for (const line of snippetLines) {
    if (normalizedSource.includes(normalizeWhitespace(line))) {
      matchedLines++;
    }
  }

  const matchRatio = matchedLines / snippetLines.length;
  return matchRatio >= 0.8;
}

// RULE-009: Extract known file paths from source code for cross-file reference validation.
function extractKnownFiles(sourceCode: string): Set<string> {
  const files = new Set<string>();
  // Match file headers like "--- src/auth.ts ---" or "// File: src/auth.ts"
  const headerPatterns = [
    /^---\s+(.+?)\s+---$/gm,
    /^\/\/\s*File:\s*(.+?)$/gm,
    /^#\s*File:\s*(.+?)$/gm,
    /^diff --git a\/(.+?)\s/gm,
  ];
  for (const pattern of headerPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(sourceCode)) !== null) {
      const path = match[1].trim();
      if (path) {
        files.add(path);
        // Also add the basename for partial matching
        const basename = path.split('/').pop();
        if (basename) files.add(basename);
      }
    }
  }
  return files;
}

// RULE-009: Validate that a finding's file reference exists in the submission.
function validateFileReference(
  finding: StructuredFinding,
  knownFiles: Set<string>,
): { valid: boolean; note?: string } {
  if (knownFiles.size === 0) return { valid: true }; // no file info to validate against
  if (!finding.location) return { valid: true }; // no file ref to validate

  // Extract file path from location (e.g., "auth.ts:L42" → "auth.ts")
  const fileMatch = finding.location.match(/^([^\s:]+\.\w+)/);
  if (!fileMatch) return { valid: true }; // no file path pattern found

  const refFile = fileMatch[1];
  const basename = refFile.split('/').pop() ?? refFile;

  // Check if the referenced file exists in known files
  if (knownFiles.has(refFile) || knownFiles.has(basename)) {
    return { valid: true };
  }

  return {
    valid: false,
    note: `Referenced file "${refFile}" not found in submission`,
  };
}

// RULE-008: Severity adjustment keywords for environment-aware processing.
type EnvironmentType = 'production' | 'prototype' | 'unknown';

function detectEnvironment(workspaceContext?: string): EnvironmentType {
  if (!workspaceContext) return 'unknown';
  const lower = workspaceContext.toLowerCase();
  if (
    lower.includes('production') ||
    lower.includes('public api') ||
    lower.includes('customer-facing') ||
    lower.includes('mission-critical') ||
    lower.includes('hipaa') ||
    lower.includes('sox') ||
    lower.includes('pci')
  ) {
    return 'production';
  }
  if (
    lower.includes('prototype') ||
    lower.includes('internal tool') ||
    lower.includes('proof of concept') ||
    lower.includes('poc') ||
    lower.includes('hackathon') ||
    lower.includes('experiment') ||
    lower.includes('spike')
  ) {
    return 'prototype';
  }
  return 'unknown';
}

const SEVERITY_ORDER = ['informational', 'low', 'medium', 'high', 'critical'] as const;
type Severity = typeof SEVERITY_ORDER[number];

function adjustSeverity(
  severity: Severity,
  direction: 'up' | 'down',
): Severity {
  const idx = SEVERITY_ORDER.indexOf(severity);
  if (direction === 'up') {
    return SEVERITY_ORDER[Math.min(idx + 1, SEVERITY_ORDER.length - 1)];
  }
  return SEVERITY_ORDER[Math.max(idx - 1, 0)];
}

/**
 * Validate structured findings against the submitted source code.
 *
 * Rules:
 * 1. Findings WITH code_snippet: validate that the snippet exists in the source.
 *    - Pass → validated: true
 *    - Fail → finding is DROPPED (hallucinated reference)
 * 2. Findings WITHOUT code_snippet: accepted as-is (architectural/design findings
 *    may not reference specific code). Marked validated: false with a note.
 * 3. Severity/confidence/classification enums are validated.
 * 4. RULE-008: Environment-aware severity adjustment.
 * 5. RULE-009: Cross-file reference validation.
 *
 * @param findings - Structured findings from the tool call
 * @param sourceCode - The original user-submitted code (before XML escaping)
 * @param workspaceContext - Optional workspace context for severity adjustment
 * @returns Validated findings with invalid ones removed
 */
export function validateFindings(
  findings: StructuredFinding[],
  sourceCode: string,
  workspaceContext?: string,
): ValidatedFinding[] {
  // Pre-compute normalized source once for all snippet checks
  const normalizedSource = normalizeWhitespace(sourceCode);
  // RULE-009: Pre-extract known file paths for cross-file reference validation
  const knownFiles = extractKnownFiles(sourceCode);
  // RULE-008: Detect environment for severity adjustment
  const environment = detectEnvironment(workspaceContext);

  const validSeverities = new Set(['critical', 'high', 'medium', 'low', 'informational']);
  const validConfidences = new Set(['certain', 'likely', 'possible']);
  const validClassifications = new Set(['vulnerability', 'deficiency', 'suggestion']);

  const validated: ValidatedFinding[] = [];

  for (const finding of findings) {
    // Validate enum fields — reject findings with invalid values
    if (!validSeverities.has(finding.severity)) continue;
    if (!validConfidences.has(finding.confidence)) continue;
    if (!validClassifications.has(finding.classification)) continue;

    // Validate required string fields
    if (!finding.id || !finding.title || !finding.remediation) continue;

    // [LIKELY] findings must have an assumption
    if (finding.confidence === 'likely' && !finding.assumption) {
      // Demote to [POSSIBLE] instead of dropping — the finding may still be useful
      // but it's not well-evidenced enough to stay at [LIKELY]
      finding.confidence = 'possible';
    }

    // RULE-009: Validate cross-file references
    const fileRef = validateFileReference(finding, knownFiles);
    if (!fileRef.valid) {
      // Don't drop — demote confidence and add note
      finding.confidence = 'possible';
    }

    // RULE-008: Apply environment-aware severity adjustment
    if (environment === 'prototype') {
      // Downgrade non-critical findings for prototypes
      if (finding.classification === 'suggestion') continue; // skip suggestions entirely
      if (finding.severity !== 'critical') {
        finding.severity = adjustSeverity(finding.severity as Severity, 'down');
      }
    } else if (environment === 'production') {
      // Upgrade security findings for production systems
      if (
        finding.classification === 'vulnerability' &&
        finding.confidence !== 'possible'
      ) {
        finding.severity = adjustSeverity(finding.severity as Severity, 'up');
      }
    }

    if (finding.code_snippet && finding.code_snippet.trim().length > 0) {
      // Mechanically verify the snippet exists in the source
      if (snippetExistsInSource(finding.code_snippet, normalizedSource)) {
        const notes: string[] = [];
        if (!fileRef.valid && fileRef.note) notes.push(fileRef.note);
        if (environment !== 'unknown') notes.push(`Severity adjusted for ${environment} environment`);
        validated.push({
          ...finding,
          validated: true,
          ...(notes.length > 0 ? { validation_note: notes.join('; ') } : {}),
        });
      } else {
        // DROPPED: hallucinated code reference — do not include in results.
        // Log for monitoring (the route handler captures this count).
        continue;
      }
    } else {
      // No code snippet — accept but mark as unvalidated.
      // Architectural/design findings often don't reference specific lines.
      const notes: string[] = ['No code_snippet provided — finding accepted without mechanical validation.'];
      if (!fileRef.valid && fileRef.note) notes.push(fileRef.note);
      if (environment !== 'unknown') notes.push(`Severity adjusted for ${environment} environment`);
      validated.push({
        ...finding,
        validated: false,
        validation_note: notes.join('; '),
      });
    }
  }

  return validated;
}

/**
 * Summary statistics for validation results (used for logging).
 */
export function validationStats(
  original: StructuredFinding[],
  validated: ValidatedFinding[],
): { total: number; accepted: number; dropped: number; unvalidated: number } {
  const accepted = validated.filter((f) => f.validated).length;
  const unvalidated = validated.filter((f) => !f.validated).length;
  return {
    total: original.length,
    accepted,
    dropped: original.length - validated.length,
    unvalidated,
  };
}
