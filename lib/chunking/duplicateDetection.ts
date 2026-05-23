// RULE-006: Near-duplicate code detection via rolling hash.
// Normalizes code blocks (strips whitespace/comments, lowercases identifiers)
// and uses a content hash to find near-duplicate segments across files.
// Injected as a <duplicate_blocks> summary so code-quality and architecture
// agents can identify DRY violations without the LLM discovering them.

import { createHash } from 'crypto';
import type { FileChunk } from './splitByFile';

export interface DuplicateBlock {
  /** Content hash of the normalized block. */
  hash: string;
  /** All locations where this duplicate appears. */
  locations: { path: string; startLine: number; endLine: number }[];
  /** The normalized content (for display). */
  normalizedPreview: string;
  /** Number of lines in each occurrence. */
  lineCount: number;
}

export interface DuplicateResult {
  /** Groups of duplicate blocks (each with ≥2 locations). */
  duplicates: DuplicateBlock[];
  /** Total number of duplicated line groups found. */
  totalDuplicateGroups: number;
  /** Total duplicated lines across all groups. */
  totalDuplicatedLines: number;
}

// ── Normalization ──────────────────────────────────────────────

/**
 * Normalize a line of code for comparison:
 * - Strip comments (// and #)
 * - Collapse whitespace
 * - Lowercase (makes identifier comparison case-insensitive)
 * - Remove string literals (replaced with placeholder)
 */
function normalizeLine(line: string): string {
  return line
    .replace(/\/\/.*$/, '')            // JS comments
    .replace(/#.*$/, '')               // Python comments
    .replace(/'(?:[^'\\]|\\.)*'/g, "'STR'")  // single-quoted strings
    .replace(/"(?:[^"\\]|\\.)*"/g, '"STR"')  // double-quoted strings
    .replace(/`(?:[^`\\]|\\.)*`/g, '`STR`')  // template literals
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Check if a line is meaningful code (not just whitespace, braces, or trivial).
 */
function isMeaningful(normalized: string): boolean {
  if (normalized.length <= 3) return false;
  // Skip lone braces, brackets, semicolons
  if (/^[{}()\[\];,]+$/.test(normalized)) return false;
  // Skip import/require lines (these are naturally duplicated)
  if (/^(?:import|from|require|export)\b/.test(normalized)) return false;
  // Skip package/module declarations
  if (/^(?:package|module)\b/.test(normalized)) return false;
  return true;
}

/**
 * Hash a window of normalized lines.
 */
function hashBlock(lines: string[]): string {
  const content = lines.join('\n');
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Detect near-duplicate code blocks across file chunks.
 * Uses a sliding window of `windowSize` lines and hashes each block.
 *
 * @param chunks File chunks from splitByFile()
 * @param windowSize Number of lines per block to compare (default: 6)
 * @returns Duplicate detection results
 */
export function detectDuplicates(
  chunks: FileChunk[],
  windowSize = 6,
): DuplicateResult {
  // Map: hash → locations
  const hashMap = new Map<string, { path: string; startLine: number; endLine: number; normalized: string }[]>();

  for (const chunk of chunks) {
    const rawLines = chunk.content.split('\n');
    const normalizedLines: { text: string; originalLine: number }[] = [];

    // Build array of meaningful normalized lines with their original line numbers
    for (let i = 0; i < rawLines.length; i++) {
      const norm = normalizeLine(rawLines[i]);
      if (isMeaningful(norm)) {
        normalizedLines.push({ text: norm, originalLine: i + 1 });
      }
    }

    // Slide window across normalized lines
    for (let i = 0; i <= normalizedLines.length - windowSize; i++) {
      const window = normalizedLines.slice(i, i + windowSize);
      const windowTexts = window.map((l) => l.text);
      const hash = hashBlock(windowTexts);

      const entry = {
        path: chunk.path,
        startLine: window[0].originalLine,
        endLine: window[window.length - 1].originalLine,
        normalized: windowTexts.join('\n'),
      };

      if (!hashMap.has(hash)) {
        hashMap.set(hash, [entry]);
      } else {
        const existing = hashMap.get(hash)!;
        // Avoid adding overlapping blocks from the same file
        const isDuplicate = existing.some(
          (e) => e.path === entry.path &&
            Math.abs(e.startLine - entry.startLine) < windowSize,
        );
        if (!isDuplicate) {
          existing.push(entry);
        }
      }
    }
  }

  // Filter to only groups with duplicates from different files (or distant in same file)
  const duplicates: DuplicateBlock[] = [];
  let totalDuplicatedLines = 0;

  for (const [hash, locations] of hashMap) {
    if (locations.length < 2) continue;

    // Must span at least 2 different files OR be >50 lines apart in the same file
    const files = new Set(locations.map((l) => l.path));
    if (files.size < 2) {
      const sameFileDistant = locations.some((a) =>
        locations.some((b) => a !== b && Math.abs(a.startLine - b.startLine) > 50),
      );
      if (!sameFileDistant) continue;
    }

    duplicates.push({
      hash,
      locations: locations.map((l) => ({
        path: l.path,
        startLine: l.startLine,
        endLine: l.endLine,
      })),
      normalizedPreview: locations[0].normalized.slice(0, 200),
      lineCount: windowSize,
    });
    totalDuplicatedLines += windowSize * locations.length;
  }

  // Sort by number of occurrences (most duplicated first)
  duplicates.sort((a, b) => b.locations.length - a.locations.length);

  return {
    duplicates: duplicates.slice(0, 30), // cap to avoid bloat
    totalDuplicateGroups: duplicates.length,
    totalDuplicatedLines,
  };
}

/**
 * Format duplicate detection results as a prompt-injectable block.
 * Returns null if no significant duplicates are found.
 */
export function formatDuplicates(result: DuplicateResult): string | null {
  if (result.duplicates.length === 0) return null;

  const lines: string[] = [
    `[Duplicate Code Detection — ${result.totalDuplicateGroups} duplicate groups, ~${result.totalDuplicatedLines} duplicated lines]`,
    '',
    'The following code blocks appear in multiple locations. Consider extracting shared utilities:',
    '',
  ];

  for (const dup of result.duplicates.slice(0, 15)) {
    lines.push(`  Duplicate (${dup.locations.length} occurrences, ${dup.lineCount} lines each):`);
    for (const loc of dup.locations) {
      lines.push(`    ${loc.path}:L${loc.startLine}-L${loc.endLine}`);
    }
    lines.push(`    Preview: ${dup.normalizedPreview.split('\n')[0]}`);
    lines.push('');
  }

  if (result.duplicates.length > 15) {
    lines.push(`  ... and ${result.duplicates.length - 15} more duplicate groups`);
  }

  return lines.join('\n');
}
