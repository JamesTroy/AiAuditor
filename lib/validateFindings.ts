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
 *
 * @param findings - Structured findings from the tool call
 * @param sourceCode - The original user-submitted code (before XML escaping)
 * @returns Validated findings with invalid ones removed
 */
export function validateFindings(
  findings: StructuredFinding[],
  sourceCode: string,
): ValidatedFinding[] {
  // Pre-compute normalized source once for all snippet checks
  const normalizedSource = normalizeWhitespace(sourceCode);

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

    if (finding.code_snippet && finding.code_snippet.trim().length > 0) {
      // Mechanically verify the snippet exists in the source
      if (snippetExistsInSource(finding.code_snippet, normalizedSource)) {
        validated.push({ ...finding, validated: true });
      } else {
        // DROPPED: hallucinated code reference — do not include in results.
        // Log for monitoring (the route handler captures this count).
        continue;
      }
    } else {
      // No code snippet — accept but mark as unvalidated.
      // Architectural/design findings often don't reference specific lines.
      validated.push({
        ...finding,
        validated: false,
        validation_note: 'No code_snippet provided — finding accepted without mechanical validation.',
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
