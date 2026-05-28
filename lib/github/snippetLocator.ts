// Locate a finding's code_snippet back to a {path, line} in the assembled
// audit input bundle, so we can post inline review comments with line
// anchors instead of dumping everything in a top-level walkthrough.
//
// Bundle format used by the PR-audit pipeline (mirrors the format produced
// by buildCombinedPrepPrompt in CodeAuditPanel and the audit-prep flow):
//
//   --- path/to/file.ts ---
//   <file contents>
//
//   --- path/to/other.ts ---
//   <file contents>
//
// The locator does a whitespace-normalised search — agents sometimes echo
// snippets with slightly different indentation than the source. Returns
// null if the snippet can't be confidently located (no match, multiple
// matches in the same file, or match outside any file section).

export interface SourceFile {
  path: string;
  /** 1-indexed line where this file's content starts in the bundled string. */
  startLine: number;
  /** Inclusive line where this file's content ends. */
  endLine: number;
  content: string;
}

export interface BundleIndex {
  bundle: string;
  files: SourceFile[];
}

const FILE_HEADER_RE = /^---\s+(.+?)\s+---\s*$/;

/**
 * Build the bundled string + per-file index from an array of {path, content}.
 * The returned bundle is what gets fed to the model; the index is used by
 * locateSnippet() to translate snippets back to file+line.
 */
export function buildBundle(files: Array<{ path: string; content: string }>): BundleIndex {
  const parts: string[] = [];
  const indexed: SourceFile[] = [];
  let cumulativeLine = 1;

  for (const f of files) {
    const header = `--- ${f.path} ---`;
    parts.push(header);
    cumulativeLine += 1; // header line
    const contentStartLine = cumulativeLine;
    const contentLines = f.content.split('\n');
    parts.push(f.content);
    cumulativeLine += contentLines.length;
    // blank line separator
    parts.push('');
    cumulativeLine += 1;
    indexed.push({
      path: f.path,
      startLine: contentStartLine,
      endLine: contentStartLine + contentLines.length - 1,
      content: f.content,
    });
  }

  return { bundle: parts.join('\n'), files: indexed };
}

function normalize(s: string): string {
  // Collapse internal whitespace runs to a single space and trim per line,
  // so models echoing snippets with slightly different indentation still match.
  return s
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n');
}

export interface LocatedSnippet {
  path: string;
  /** 1-indexed line within the file (not the bundle). */
  line: number;
}

/**
 * Find which file + line a snippet came from.
 * Strategy:
 *  1. Pick the first non-empty line of the snippet as an anchor.
 *  2. Normalise both anchor and each file's content.
 *  3. For each file: count exact matches of the anchor line. A confident hit
 *     requires exactly one match.
 *  4. Across all files, require a unique winner. Ties (snippet appears in
 *     two files) → return null, fall back to walkthrough.
 *
 * This is intentionally conservative: a wrongly-located inline comment on a
 * PR is worse than a finding shown only in the walkthrough.
 */
export function locateSnippet(snippet: string, index: BundleIndex): LocatedSnippet | null {
  const normSnippet = normalize(snippet);
  if (!normSnippet) return null;
  const anchor = normSnippet.split('\n')[0];
  if (!anchor || anchor.length < 6) return null; // too short = too many false matches

  let bestPath: string | null = null;
  let bestLine = -1;
  let totalMatches = 0;

  for (const file of index.files) {
    const lines = file.content.split('\n');
    let firstMatchLine = -1;
    let countInFile = 0;
    for (let i = 0; i < lines.length; i++) {
      const normLine = lines[i].trim().replace(/\s+/g, ' ');
      if (normLine === anchor) {
        countInFile++;
        if (firstMatchLine === -1) firstMatchLine = i + 1; // 1-indexed
        if (countInFile > 1) break;
      }
    }
    if (countInFile === 1) {
      totalMatches++;
      bestPath = file.path;
      bestLine = firstMatchLine;
      if (totalMatches > 1) return null;
    }
  }

  if (totalMatches !== 1 || !bestPath || bestLine < 1) return null;
  return { path: bestPath, line: bestLine };
}

/**
 * Best-effort path extraction from a free-form `location` string when no
 * snippet is provided. Looks for "file.ext:LINE" or "path/to/file.ext"
 * substrings and validates the path exists in the bundle.
 */
export function locationFromString(location: string, index: BundleIndex): LocatedSnippet | null {
  const pathLineMatch = location.match(/([\w./@-]+\.[a-zA-Z]+):(\d+)/);
  if (pathLineMatch) {
    const candidatePath = pathLineMatch[1];
    const candidateLine = parseInt(pathLineMatch[2], 10);
    const file = index.files.find((f) => f.path === candidatePath || f.path.endsWith('/' + candidatePath));
    if (file) return { path: file.path, line: Math.max(1, candidateLine) };
  }
  const pathOnly = location.match(/([\w./@-]+\.[a-zA-Z]+)/);
  if (pathOnly) {
    const candidatePath = pathOnly[1];
    const file = index.files.find((f) => f.path === candidatePath || f.path.endsWith('/' + candidatePath));
    if (file) return { path: file.path, line: 1 };
  }
  return null;
}
