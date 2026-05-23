// WORKFLOW-5: Diff-aware incremental audit.
// When user submits a diff/patch format input, extract only changed lines with
// surrounding context. Agents focus on the delta rather than the entire file,
// dramatically faster for PR reviews.

export interface DiffHunk {
  /** File path from the diff header. */
  filePath: string;
  /** Added lines with line numbers. */
  additions: { line: number; content: string }[];
  /** Removed lines with line numbers. */
  deletions: { line: number; content: string }[];
  /** Context lines around changes. */
  context: { line: number; content: string }[];
  /** Full hunk content (for embedding). */
  rawHunk: string;
}

export interface DiffAnalysis {
  /** Whether the input appears to be a diff/patch format. */
  isDiff: boolean;
  /** Parsed hunks from the diff. */
  hunks: DiffHunk[];
  /** Total additions across all hunks. */
  totalAdditions: number;
  /** Total deletions across all hunks. */
  totalDeletions: number;
  /** Files touched by the diff. */
  filesChanged: string[];
}

// ── Diff detection ─────────────────────────────────────────────

/**
 * Detect whether the input is in unified diff format.
 */
export function isDiffFormat(input: string): boolean {
  const firstLines = input.slice(0, 2000);
  // Check for unified diff markers
  if (/^diff --git /m.test(firstLines)) return true;
  if (/^--- (?:a\/|\/dev\/null)/.test(firstLines) && /^\+\+\+ (?:b\/|\/dev\/null)/m.test(firstLines)) return true;
  // Check for GitHub PR diff format
  if (/^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(firstLines)) return true;
  return false;
}

/**
 * Parse a unified diff into structured hunks.
 */
export function parseDiff(input: string): DiffAnalysis {
  if (!isDiffFormat(input)) {
    return { isDiff: false, hunks: [], totalAdditions: 0, totalDeletions: 0, filesChanged: [] };
  }

  const lines = input.split('\n');
  const hunks: DiffHunk[] = [];
  let currentFile = '';
  let currentHunkLines: string[] = [];
  let inHunk = false;
  let addLine = 0;
  let delLine = 0;
  let totalAdditions = 0;
  let totalDeletions = 0;
  const filesChanged = new Set<string>();

  const additions: { line: number; content: string }[] = [];
  const deletions: { line: number; content: string }[] = [];
  const context: { line: number; content: string }[] = [];

  function flushHunk() {
    if (currentHunkLines.length > 0 && currentFile) {
      hunks.push({
        filePath: currentFile,
        additions: [...additions],
        deletions: [...deletions],
        context: [...context],
        rawHunk: currentHunkLines.join('\n'),
      });
      additions.length = 0;
      deletions.length = 0;
      context.length = 0;
      currentHunkLines = [];
    }
  }

  for (const line of lines) {
    // File header: diff --git a/path b/path
    const diffMatch = line.match(/^diff --git a\/(.+?) b\//);
    if (diffMatch) {
      flushHunk();
      currentFile = diffMatch[1];
      filesChanged.add(currentFile);
      inHunk = false;
      continue;
    }

    // File header: +++ b/path
    const plusMatch = line.match(/^\+\+\+ b\/(.+)/);
    if (plusMatch && !currentFile) {
      currentFile = plusMatch[1];
      filesChanged.add(currentFile);
      continue;
    }

    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunkMatch) {
      flushHunk();
      delLine = parseInt(hunkMatch[1], 10);
      addLine = parseInt(hunkMatch[2], 10);
      inHunk = true;
      currentHunkLines.push(line);
      continue;
    }

    if (inHunk) {
      currentHunkLines.push(line);

      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions.push({ line: addLine, content: line.slice(1) });
        totalAdditions++;
        addLine++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions.push({ line: delLine, content: line.slice(1) });
        totalDeletions++;
        delLine++;
      } else if (line.startsWith(' ')) {
        context.push({ line: addLine, content: line.slice(1) });
        addLine++;
        delLine++;
      }
    }
  }

  flushHunk();

  return {
    isDiff: true,
    hunks,
    totalAdditions,
    totalDeletions,
    filesChanged: [...filesChanged],
  };
}

/**
 * Format a diff analysis as a prompt-injectable context block.
 * Provides agents with a clear summary of what changed.
 */
export function formatDiffContext(analysis: DiffAnalysis): string | null {
  if (!analysis.isDiff || analysis.hunks.length === 0) return null;

  const lines: string[] = [
    `[Change Analysis — ${analysis.filesChanged.length} files, +${analysis.totalAdditions} / -${analysis.totalDeletions} lines]`,
    '',
    'This submission is a code diff/patch. Focus your audit on the CHANGED code (+ lines).',
    'Context lines (unchanged) are provided for understanding, but do not audit them unless',
    'the changes introduce a problem with the existing code.',
    '',
    'Files changed:',
  ];

  for (const file of analysis.filesChanged) {
    const fileHunks = analysis.hunks.filter((h) => h.filePath === file);
    const adds = fileHunks.reduce((s, h) => s + h.additions.length, 0);
    const dels = fileHunks.reduce((s, h) => s + h.deletions.length, 0);
    lines.push(`  ${file} (+${adds} / -${dels})`);
  }

  lines.push('');
  lines.push('Focus areas for the changed code:');
  lines.push('- Do the additions introduce any bugs, vulnerabilities, or anti-patterns?');
  lines.push('- Do the deletions remove important safety checks or error handling?');
  lines.push('- Is the changed code consistent with the surrounding context?');
  lines.push('- Are there missing tests for the new code paths?');

  return lines.join('\n');
}
