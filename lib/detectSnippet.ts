/**
 * Detect whether submitted code looks like an isolated snippet rather than a
 * complete file or module.
 *
 * A snippet is code that is missing surrounding context — no imports, no
 * module-level declarations, or code that appears to start inside a function
 * or class body. Auditing a snippet produces findings that may not apply (or
 * fixes that won't work) once the code is seen in its full context.
 *
 * Conservative by design: only flags when there is strong positive evidence
 * the code is a fragment. Ambiguous cases return isSnippet: false to avoid
 * showing the warning when it isn't useful.
 */

export interface SnippetDetection {
  isSnippet: boolean;
  /** Short explanation shown in the UI hint. */
  reason: string;
}

// Patterns that indicate a complete file/module — suppress snippet warning.
const COMPLETE_FILE_PATTERNS: RegExp[] = [
  // Multi-file format from prepPrompt: --- path/to/file.ext ---
  /^---\s+\S.*\S\s+---\s*$/m,
  // PR diff format
  /^#\s*PR:/m,
  // ES module imports
  /^import\s+(?:[\w{},\s*]+\s+from\s+['"]|['"])/m,
  // CommonJS require
  /\brequire\s*\(\s*['"]/m,
  // Python imports
  /^(?:import|from)\s+\w/m,
  // Go package declaration
  /^package\s+\w/m,
  // Java/Kotlin package
  /^package\s+[\w.]+\s*;/m,
  // PHP opening tag
  /^<\?php/m,
  // HTML document
  /^<!DOCTYPE\s+html/im,
  /^<html/im,
  // C/C++/Objective-C includes
  /^#include\s+[<"]/m,
  // Rust crate/use
  /^(?:use\s+\w|extern\s+crate)/m,
  // Ruby require
  /^require(?:_relative)?\s+['"]/m,
  // C# using
  /^using\s+[\w.]+;/m,
  // Shell shebang
  /^#!\//,
  // Swift import
  /^import\s+(?:Foundation|UIKit|SwiftUI|Cocoa|\w+)\s*$/m,
  // Kotlin import
  /^import\s+[\w.]+/m,
  // Top-level export (module root)
  /^export\s+(?:default|const|function|class|type|interface|enum)\s/m,
  // module.exports
  /^module\.exports\s*=/m,
];

// Patterns that are strong positive signals of a snippet.
const SNIPPET_SIGNALS: RegExp[] = [
  // Code clearly starts inside a function body (indented, non-comment first line)
  // handled separately below
];

/** Languages/file types where missing imports are normal — skip snippet detection. */
const IMPORT_FREE_PATTERNS: RegExp[] = [
  // CSS / SCSS / Less (selectors or at-rules at top)
  /^[\s\n]*(?:[@*:.\w#\[]).*\{/m,
  // JSON (starts with { or [)
  /^[\s\n]*[{[]/,
  // YAML (key: value or --- at top)
  /^[\s\n]*(?:---|\w[\w-]*:)/m,
  // SQL
  /^[\s\n]*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\s/im,
  // Markdown (headings or plain text)
  /^[\s\n]*#+\s/m,
  // Dockerfile
  /^[\s\n]*(?:FROM|RUN|COPY|ENV|ARG|EXPOSE|CMD|ENTRYPOINT)\s/m,
  // Shell without shebang (but with shell-specific constructs)
  /^[\s\n]*(?:echo|export|source|if\s+\[|for\s+\w+\s+in|while\s+\[|function\s+\w+\s*\()/m,
  // Terraform HCL
  /^[\s\n]*(?:resource|module|variable|output|provider|terraform)\s+"/m,
  // TOML / INI
  /^[\s\n]*\[[\w.]+\]/m,
  // XML / SVG
  /^[\s\n]*<?xml|^[\s\n]*<svg/im,
  // GraphQL
  /^[\s\n]*(?:type|query|mutation|subscription|schema|fragment|directive)\s+\w/m,
];

function isImportFreeLanguage(code: string): boolean {
  return IMPORT_FREE_PATTERNS.some((re) => re.test(code));
}

function hasCompleteFileMarker(code: string): boolean {
  return COMPLETE_FILE_PATTERNS.some((re) => re.test(code));
}

/** Returns true if the first meaningful code line is indented (inside a scope). */
function startsInsideScope(lines: string[]): boolean {
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip blank lines and comment-only lines
    if (!trimmed) continue;
    if (trimmed.startsWith('//') || trimmed.startsWith('#') ||
        trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    // If the first real line is indented by 2+ spaces or a tab, we're inside a scope
    return /^[ \t]{2,}/.test(line);
  }
  return false;
}

export function detectSnippet(code: string): SnippetDetection {
  const trimmed = code.trim();

  // Too short to bother — the existing "< 200 chars" hint covers this
  if (trimmed.length < 150) {
    return { isSnippet: false, reason: '' };
  }

  // If it looks like a complete file, no warning needed
  if (hasCompleteFileMarker(trimmed)) {
    return { isSnippet: false, reason: '' };
  }

  // Languages where missing imports are normal — skip
  if (isImportFreeLanguage(trimmed)) {
    return { isSnippet: false, reason: '' };
  }

  const lines = trimmed.split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);

  // Very short code with no imports — almost certainly a snippet
  if (nonEmptyLines.length < 15) {
    return {
      isSnippet: true,
      reason: 'no module-level imports or declarations found',
    };
  }

  // Code starts inside a scope (indented first line) — definitely a snippet
  if (startsInsideScope(lines)) {
    return {
      isSnippet: true,
      reason: 'code appears to start inside a function or class body',
    };
  }

  // Moderate-length code with no imports — likely a snippet
  if (nonEmptyLines.length < 50) {
    return {
      isSnippet: true,
      reason: 'no import or module declarations found',
    };
  }

  return { isSnippet: false, reason: '' };
}
