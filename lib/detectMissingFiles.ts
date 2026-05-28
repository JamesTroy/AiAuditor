// Identify internal imports in a code paste that aren't satisfied by another
// file in the same paste. Used to give users a concrete "paste this file too"
// hint, which improves audit accuracy and cuts false-positives like
// "missing auth middleware" when the user just didn't paste auth.ts.
//
// Scope: ES module imports + CommonJS require + Python from-imports for
// internal/relative paths only (npm package imports are ignored — those are
// expected to be missing from a paste).
//
// Output is a deduped list of import strings the user might want to add.

const FILE_HEADER_RE = /^---\s+(.+?)\s+---\s*$/gm;

// JS/TS: import ... from "X" or import "X"
const JS_IMPORT_RE = /^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
// JS/TS: require("X")
const JS_REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
// Python: from X import ..., import X
const PY_IMPORT_RE = /^\s*(?:from\s+([\w.]+)\s+import\b|import\s+([\w.]+))/gm;

// Internal = relative (./, ../) or alias-prefixed (@/...).
function isInternal(importPath: string): boolean {
  return importPath.startsWith('.') || importPath.startsWith('@/');
}

// Tolerate "@/lib/auth" resolving to "lib/auth.ts", "lib/auth/index.ts",
// or any "auth" file in the lib dir. We normalise both sides before
// matching: drop leading "@/", drop file extension, drop "/index" suffix.
function normaliseImportPath(p: string): string {
  return p
    .replace(/^@\//, '')
    .replace(/\.(ts|tsx|js|jsx|mjs|cjs|py)$/i, '')
    .replace(/\/index$/, '')
    .toLowerCase();
}

function normaliseFilePath(p: string): string {
  return p
    .replace(/^\.\//, '')
    .replace(/\.(ts|tsx|js|jsx|mjs|cjs|py)$/i, '')
    .replace(/\/index$/, '')
    .toLowerCase();
}

export interface MissingFile {
  /** The import string as written in the source. */
  importPath: string;
  /** Which file in the paste imports it (null for single-file paste). */
  fromFile: string | null;
}

export interface MissingFilesResult {
  bundledPaths: string[];
  missing: MissingFile[];
}

/**
 * Parse all internal imports from `code` and return the ones not satisfied
 * by another file in the same paste. Returns an empty list when the input
 * has no internal imports or every internal import is resolved.
 *
 * The matcher is intentionally loose — false negatives (missing an unresolved
 * import) are preferred over false positives (telling the user to paste a
 * file that's already there).
 */
export function detectMissingFiles(code: string): MissingFilesResult {
  // 1) Find every `--- path ---` header so we know what was pasted.
  const bundledPaths: string[] = [];
  FILE_HEADER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FILE_HEADER_RE.exec(code)) !== null) {
    bundledPaths.push(m[1]);
  }

  const bundledNorm = new Set(bundledPaths.map(normaliseFilePath));

  // 2) Slice by file header. For single-file pastes, slice = whole code.
  const sections: Array<{ path: string | null; content: string }> = [];
  if (bundledPaths.length === 0) {
    sections.push({ path: null, content: code });
  } else {
    const headerRegex = /^---\s+(.+?)\s+---\s*$/gm;
    const matches: Array<{ path: string; start: number; end: number }> = [];
    let h: RegExpExecArray | null;
    while ((h = headerRegex.exec(code)) !== null) {
      matches.push({ path: h[1], start: h.index, end: h.index + h[0].length });
    }
    for (let i = 0; i < matches.length; i++) {
      const next = matches[i + 1]?.start ?? code.length;
      sections.push({
        path: matches[i].path,
        content: code.slice(matches[i].end, next),
      });
    }
  }

  // 3) Extract internal imports per section; dedupe; check resolution.
  const seen = new Set<string>();
  const missing: MissingFile[] = [];

  for (const section of sections) {
    const internalImports = new Set<string>();
    let im: RegExpExecArray | null;

    JS_IMPORT_RE.lastIndex = 0;
    while ((im = JS_IMPORT_RE.exec(section.content)) !== null) {
      if (isInternal(im[1])) internalImports.add(im[1]);
    }
    JS_REQUIRE_RE.lastIndex = 0;
    while ((im = JS_REQUIRE_RE.exec(section.content)) !== null) {
      if (isInternal(im[1])) internalImports.add(im[1]);
    }
    PY_IMPORT_RE.lastIndex = 0;
    while ((im = PY_IMPORT_RE.exec(section.content)) !== null) {
      const path = im[1] ?? im[2];
      if (path && path.startsWith('.')) internalImports.add(path);
    }

    for (const importPath of internalImports) {
      const dedupeKey = `${section.path ?? ''}::${importPath}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const norm = normaliseImportPath(importPath);
      const resolved = [...bundledNorm].some(
        (b) => b === norm || b.endsWith('/' + norm) || norm.endsWith('/' + b),
      );
      if (!resolved) {
        missing.push({ importPath, fromFile: section.path });
      }
    }
  }

  return { bundledPaths, missing };
}
