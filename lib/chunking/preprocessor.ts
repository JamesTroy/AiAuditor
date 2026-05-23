// WORKFLOW-003: Smart input preprocessing pipeline.
// Runs before prompt assembly to clean, compress, and optimize user input.
// Saves ~10-30% of token budget by removing noise, allowing deeper analysis.

export interface PreprocessResult {
  /** The preprocessed/cleaned code. */
  output: string;
  /** Original character count. */
  originalChars: number;
  /** Final character count after preprocessing. */
  finalChars: number;
  /** Percentage of chars saved. */
  savings: number;
  /** What transformations were applied. */
  transforms: string[];
}

/**
 * Strip base64-encoded content and data URIs that waste token budget.
 * Replaces with a placeholder noting the original size.
 */
function stripBinaryContent(code: string): { code: string; stripped: boolean } {
  let stripped = false;

  // Data URIs > 200 chars
  const dataUriResult = code.replace(
    /data:[a-zA-Z0-9/+.-]+;base64,[A-Za-z0-9+/=]{200,}/g,
    (match) => {
      stripped = true;
      return `[BASE64_DATA_URI: ${match.length} chars stripped]`;
    },
  );

  // Standalone base64 blocks (lines of 60+ base64 chars)
  const base64Result = dataUriResult.replace(
    /^[A-Za-z0-9+/=]{60,}$/gm,
    (match) => {
      stripped = true;
      return `[BASE64_BLOCK: ${match.length} chars stripped]`;
    },
  );

  // SVG data / large inline styles
  const svgResult = base64Result.replace(
    /<svg[^>]*>[\s\S]{1000,}?<\/svg>/gi,
    (match) => {
      stripped = true;
      return `[INLINE_SVG: ${match.length} chars stripped]`;
    },
  );

  return { code: svgResult, stripped };
}

/**
 * Collapse repetitive license headers and auto-generated markers.
 * Keeps the first occurrence and replaces subsequent ones with a placeholder.
 */
function collapseLicenseHeaders(code: string): { code: string; collapsed: boolean } {
  let collapsed = false;
  const seen = new Set<string>();

  // Match common license/auto-generated comment blocks (3+ lines starting with // or /*)
  const result = code.replace(
    /(?:^\/\/[^\n]*\n){3,}|\/\*[\s\S]*?(?:license|copyright|auto-?generated|do not (?:edit|modify))[\s\S]*?\*\//gim,
    (match) => {
      // Normalize for dedup
      const key = match.replace(/\s+/g, ' ').slice(0, 100);
      if (seen.has(key)) {
        collapsed = true;
        return `// [LICENSE/AUTO-GENERATED HEADER — duplicate removed, ${match.length} chars]`;
      }
      seen.add(key);
      return match;
    },
  );

  return { code: result, collapsed };
}

/**
 * Normalize line endings and remove trailing whitespace.
 */
function normalizeWhitespace(code: string): string {
  return code
    .replace(/\r\n/g, '\n')     // CRLF → LF
    .replace(/\r/g, '\n')       // CR → LF
    .replace(/[ \t]+$/gm, '')   // trailing whitespace per line
    .replace(/\n{4,}/g, '\n\n\n'); // collapse 4+ blank lines to 3
}

/**
 * Collapse long runs of identical or near-identical lines (e.g., test fixtures,
 * data arrays with 100+ similar entries).
 */
function collapseRepetitiveBlocks(code: string): { code: string; collapsed: boolean } {
  const lines = code.split('\n');
  const result: string[] = [];
  let collapsed = false;
  let repeatCount = 0;
  let lastNormalized = '';

  for (let i = 0; i < lines.length; i++) {
    const normalized = lines[i].trim().replace(/\d+/g, 'N').replace(/'[^']*'/g, "'S'").replace(/"[^"]*"/g, '"S"');

    if (normalized === lastNormalized && normalized.length > 5) {
      repeatCount++;
      if (repeatCount <= 3) {
        result.push(lines[i]); // keep first 3
      } else if (repeatCount === 4) {
        // Will be replaced when run ends
      }
    } else {
      if (repeatCount > 3) {
        result.push(`  // ... [${repeatCount - 3} similar lines collapsed]`);
        collapsed = true;
      }
      result.push(lines[i]);
      repeatCount = 0;
    }

    lastNormalized = normalized;
  }

  // Handle trailing repeat
  if (repeatCount > 3) {
    result.push(`  // ... [${repeatCount - 3} similar lines collapsed]`);
    collapsed = true;
  }

  return { code: result.join('\n'), collapsed };
}

/**
 * Strip .d.ts type declaration noise — keep only exported type signatures,
 * remove JSDoc blocks and implementation comments.
 */
function compressTypeDeclarations(code: string): { code: string; compressed: boolean } {
  let compressed = false;

  // Find .d.ts-style content and strip verbose JSDoc
  const result = code.replace(
    /\/\*\*[\s\S]*?\*\/\s*(?=export\s+(?:type|interface|declare|const|function|class))/g,
    () => {
      compressed = true;
      return '';
    },
  );

  return { code: result, compressed };
}

/**
 * Run the full preprocessing pipeline on user input.
 * Each transform is applied in order; later transforms see the output of earlier ones.
 */
export function preprocessInput(input: string): PreprocessResult {
  const originalChars = input.length;
  const transforms: string[] = [];

  let code = input;

  // 1. Normalize whitespace first
  code = normalizeWhitespace(code);
  if (code.length < originalChars) {
    transforms.push('whitespace-normalized');
  }

  // 2. Strip binary/encoded content
  const binary = stripBinaryContent(code);
  if (binary.stripped) {
    code = binary.code;
    transforms.push('binary-content-stripped');
  }

  // 3. Collapse license headers
  const license = collapseLicenseHeaders(code);
  if (license.collapsed) {
    code = license.code;
    transforms.push('license-headers-collapsed');
  }

  // 4. Collapse repetitive blocks
  const repetitive = collapseRepetitiveBlocks(code);
  if (repetitive.collapsed) {
    code = repetitive.code;
    transforms.push('repetitive-blocks-collapsed');
  }

  // 5. Compress type declarations
  const types = compressTypeDeclarations(code);
  if (types.compressed) {
    code = types.code;
    transforms.push('type-declarations-compressed');
  }

  const finalChars = code.length;
  const savings = originalChars > 0
    ? Math.round(((originalChars - finalChars) / originalChars) * 100)
    : 0;

  return {
    output: code,
    originalChars,
    finalChars,
    savings,
    transforms,
  };
}
