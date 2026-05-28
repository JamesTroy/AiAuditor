// Pure diff: given a list of findings and a set of baseline hashes,
// split into NEW (not in baseline) and PRE_EXISTING (in baseline).
//
// Kept dependency-free of the DB so callers can mix and match — e.g., a
// dry-run "what would be new?" check on a fresh audit before deciding to
// save anything, or running the same diff over an in-memory baseline
// loaded from another source.

import type { StructuredFinding } from '@/lib/ai/findingSchema';
import { hashFinding } from '@/lib/baselines/findingHash';

export interface DiffResult {
  newFindings: StructuredFinding[];
  preExisting: StructuredFinding[];
  /** Hash → finding pairs for findings flagged as new. Saves callers from re-hashing. */
  newHashes: string[];
}

export function diffAgainstBaseline(
  findings: StructuredFinding[],
  baselineHashes: Set<string>,
): DiffResult {
  const newFindings: StructuredFinding[] = [];
  const preExisting: StructuredFinding[] = [];
  const newHashes: string[] = [];
  for (const f of findings) {
    const h = hashFinding(f);
    if (baselineHashes.has(h)) {
      preExisting.push(f);
    } else {
      newFindings.push(f);
      newHashes.push(h);
    }
  }
  return { newFindings, preExisting, newHashes };
}
