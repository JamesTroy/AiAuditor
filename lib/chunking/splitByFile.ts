// CHUNK-001: Split large multi-file input into logical chunks by file boundary.
//
// When a user pastes a monorepo dump (multiple files concatenated), this module
// splits it into individual file chunks so each can be audited separately or
// the auditor can receive a focused subset that fits in the context window.
//
// Detects common multi-file separators:
//   --- path/to/file.ts ---
//   // === file: path/to/file.ts ===
//   # path/to/file.ts
//   diff --git a/path/to/file.ts b/path/to/file.ts

export interface FileChunk {
  /** File path / name extracted from the separator. */
  path: string;
  /** File content (without the separator line). */
  content: string;
  /** Character count of the content. */
  chars: number;
}

/**
 * Common multi-file separator patterns.
 * Each regex should capture the file path in group 1.
 */
const SEPARATOR_PATTERNS = [
  // --- path/to/file.ts ---
  /^-{3,}\s+(.+?)\s+-{3,}\s*$/,
  // === path/to/file.ts ===
  /^={3,}\s+(.+?)\s+={3,}\s*$/,
  // // === file: path/to/file.ts ===
  /^\/\/\s*={3,}\s*file:\s*(.+?)\s*={3,}\s*$/i,
  // # path/to/file.ts
  /^#\s+(\S+\.\w{1,10})\s*$/,
  // diff --git a/path b/path
  /^diff\s+--git\s+a\/(.+?)\s+b\//,
  // +++ b/path/to/file.ts (unified diff)
  /^\+{3}\s+b\/(.+?)\s*$/,
];

/**
 * Try to detect a file separator line and extract the file path.
 * Returns the path if a separator is detected, null otherwise.
 */
function parseSeparator(line: string): string | null {
  const trimmed = line.trim();
  for (const pattern of SEPARATOR_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

/**
 * Split a multi-file input into individual file chunks.
 * If no file separators are detected, returns a single chunk with the full input.
 */
export function splitByFile(input: string): FileChunk[] {
  const lines = input.split('\n');
  const chunks: FileChunk[] = [];
  let currentPath: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const path = parseSeparator(line);
    if (path) {
      // Flush current chunk
      if (currentPath !== null && currentLines.length > 0) {
        const content = currentLines.join('\n').trim();
        if (content.length > 0) {
          chunks.push({ path: currentPath, content, chars: content.length });
        }
      }
      currentPath = path;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Flush last chunk
  if (currentPath !== null && currentLines.length > 0) {
    const content = currentLines.join('\n').trim();
    if (content.length > 0) {
      chunks.push({ path: currentPath, content, chars: content.length });
    }
  }

  // No separators found — return full input as one chunk
  if (chunks.length === 0) {
    const content = input.trim();
    if (content.length > 0) {
      return [{ path: 'input', content, chars: content.length }];
    }
    return [];
  }

  return chunks;
}

/**
 * Group file chunks into batches that fit within a character budget.
 * Each batch is a self-contained set of files that can be audited together.
 * Files are kept intact — never split mid-file.
 *
 * @param chunks - File chunks from splitByFile()
 * @param budgetChars - Max characters per batch (default: 100k to leave room for prompts)
 * @returns Array of batches, each containing one or more file chunks
 */
export function batchChunks(
  chunks: FileChunk[],
  budgetChars = 100_000,
): FileChunk[][] {
  // Sort by path to keep related files (same directory) together
  const sorted = [...chunks].sort((a, b) => a.path.localeCompare(b.path));

  const batches: FileChunk[][] = [];
  let currentBatch: FileChunk[] = [];
  let currentSize = 0;

  for (const chunk of sorted) {
    // Single file exceeds budget — it gets its own batch (will be truncated by caller)
    if (chunk.chars > budgetChars) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }
      batches.push([chunk]);
      continue;
    }

    // Separator overhead per file: "--- path ---\n" + "\n"
    const overhead = chunk.path.length + 10;

    if (currentSize + chunk.chars + overhead > budgetChars && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push(chunk);
    currentSize += chunk.chars + overhead;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Reassemble a batch of file chunks into a single string for the auditor,
 * with file separators restored.
 */
export function assembleBatch(batch: FileChunk[]): string {
  return batch
    .map((chunk) => `--- ${chunk.path} ---\n${chunk.content}`)
    .join('\n\n');
}
