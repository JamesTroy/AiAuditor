// Deterministic finding identity hash.
//
// Goal: assign the same hash to "the same finding" across two audits of
// approximately the same code, so we can subtract a known baseline from a
// fresh audit and surface only new findings.
//
// What goes into the hash:
//   - file path (extracted from `location` if present)
//   - normalised title (lowercase, whitespace-collapsed, punctuation-stripped)
//   - classification (vulnerability | deficiency | suggestion)
//   - normalised code_snippet (whitespace-collapsed)
//
// What deliberately does NOT go into the hash, and why:
//   - line number — line shifts when unrelated code is added/removed; we
//     want the same finding to keep its identity across those shifts.
//   - severity — models occasionally upgrade/downgrade severity on re-runs;
//     don't let that split one finding into two.
//   - confidence — same reason as severity.
//   - remediation text — model phrasing varies significantly run-to-run.
//   - finding id — entirely model-generated, non-stable.
//
// Known tradeoffs:
//   - File renames break identity (path is in the hash). Acceptable: rename
//     is rare and easy to re-baseline.
//   - A snippet rewrite that fixes the bug also changes the hash, so the
//     hash naturally invalidates when the issue is genuinely addressed.
//   - Two findings with identical title + path + snippet collapse to one;
//     this is intended — they're the same finding by definition.

import { createHash } from 'crypto';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

const PATH_PATTERN = /([\w./@-]+\.[a-zA-Z]+)/;

function normalisePath(input: string | undefined): string {
  if (!input) return '';
  return input.trim().toLowerCase();
}

function extractPathFromLocation(location: string | undefined): string {
  if (!location) return '';
  const m = location.match(PATH_PATTERN);
  return m ? normalisePath(m[1]) : '';
}

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[`*_~]/g, '')          // markdown decorations
    .replace(/[.,;:!?'"()[\]{}]/g, '')// punctuation
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim();
}

function normaliseSnippet(snippet: string | undefined): string {
  if (!snippet) return '';
  return snippet
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n');
}

/**
 * Deterministic 64-character hex hash uniquely identifying a finding
 * for baseline comparison purposes.
 *
 * Two findings hash to the same value iff they have:
 *   - the same file (extracted from location)
 *   - the same normalised title
 *   - the same classification
 *   - the same normalised snippet (or both have none)
 */
export function hashFinding(f: StructuredFinding): string {
  const path = extractPathFromLocation(f.location);
  const title = normaliseTitle(f.title);
  const snippet = normaliseSnippet(f.code_snippet);
  // Separator must be one that can't appear in normalised content. Title is
  // stripped of punctuation, path is lowercase, snippet has internal newlines
  // but no ``. Using a control char avoids any chance of injection.
  const key = `${path}${title}${f.classification}${snippet}`;
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Hash a batch of findings. Useful for building a Set<string> for diff.
 */
export function hashFindings(findings: StructuredFinding[]): string[] {
  return findings.map(hashFinding);
}
