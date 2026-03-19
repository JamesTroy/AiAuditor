/**
 * Regex-based skeleton extractor — pulls function/class/interface signatures
 * from source code without a parser dependency.
 *
 * Used for large inputs (> 40k chars) to give the auditor a structural overview
 * before the full source, improving analysis accuracy on large codebases.
 */

type Language = 'ts' | 'js' | 'python' | 'go' | 'rust' | 'java' | 'other';

function detectLanguage(code: string): Language {
  if (/^\s*(import|export)\s/.test(code) && /:\s*(string|number|boolean|void|Promise)/.test(code)) return 'ts';
  if (/^\s*(import|export|require)\s/.test(code)) return 'js';
  if (/^\s*def\s+\w+\s*\(/.test(code) || /^\s*class\s+\w+.*:/.test(code)) return 'python';
  if (/\bpackage\s+main\b/.test(code) || /\bfunc\s+\w+\s*\(/.test(code)) return 'go';
  if (/\bfn\s+\w+\s*\(/.test(code) || /\bimpl\b/.test(code)) return 'rust';
  if (/\bpublic\s+(class|interface|enum)\b/.test(code) || /\bpublic\s+(static\s+)?\w+\s+\w+\s*\(/.test(code)) return 'java';
  return 'other';
}

const PATTERNS: Record<Language, RegExp[]> = {
  ts: [
    /^(export\s+)?(async\s+)?function\s+\w+[^{]*/m,
    /^(export\s+)?(abstract\s+)?class\s+\w+[^{]*/m,
    /^(export\s+)?interface\s+\w+[^{]*/m,
    /^(export\s+)?type\s+\w+\s*=/m,
    /^(export\s+)?const\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*(:\s*\S+)?\s*=>/m,
    /^\s+(public|private|protected|static|async|readonly)(\s+(public|private|protected|static|async|readonly))*\s+\w+\s*\([^)]*\)[^{]*/m,
  ],
  js: [
    /^(export\s+)?(async\s+)?function\s+\w+[^{]*/m,
    /^(export\s+)?class\s+\w+[^{]*/m,
    /^(export\s+)?const\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*=>/m,
    /^\s+\w+\s*\([^)]*\)\s*\{/m,
  ],
  python: [
    /^(async\s+)?def\s+\w+\s*\([^)]*\)[^:]*:/m,
    /^class\s+\w+[^:]*:/m,
  ],
  go: [
    /^func\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\([^)]*\)[^{]*/m,
    /^type\s+\w+\s+(struct|interface)\s*\{/m,
  ],
  rust: [
    /^(pub(\(crate\))?\s+)?(async\s+)?fn\s+\w+[^{]*/m,
    /^(pub(\(crate\))?\s+)?(struct|enum|trait|impl)\s+\w+[^{]*/m,
  ],
  java: [
    /^(\s+)?(public|private|protected)\s+(static\s+)?\w+\s+\w+\s*\([^)]*\)[^{]*/m,
    /^(public|private|protected)?\s*(abstract\s+)?(class|interface|enum)\s+\w+[^{]*/m,
  ],
  other: [
    /^(function|class|def|func|fn)\s+\w+[^{(]*/m,
  ],
};

/**
 * Extract structural skeleton from source code.
 * Returns a compact list of function/class/type signatures.
 * Returns null if the code is too short to benefit from skeleton extraction.
 */
export function extractSkeleton(code: string): string | null {
  const MIN_LENGTH_FOR_SKELETON = 40_000;
  if (code.length < MIN_LENGTH_FOR_SKELETON) return null;

  const lang = detectLanguage(code);
  const patterns = PATTERNS[lang];
  const lines = code.split('\n');
  const signatures: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;

    for (const pattern of patterns) {
      // Reset lastIndex for global patterns
      const match = trimmed.match(pattern);
      if (match) {
        const sig = match[0].trim().replace(/\s+/g, ' ').slice(0, 120);
        if (!seen.has(sig) && sig.length > 5) {
          seen.add(sig);
          // Add line number for navigability
          signatures.push(`  L${i + 1}: ${sig}`);
        }
        break;
      }
    }
  }

  if (signatures.length === 0) return null;

  const langLabel = lang === 'other' ? 'code' : lang.toUpperCase();
  return [
    `[Code Structure — ${langLabel} — ${signatures.length} signatures extracted from ${(code.length / 1000).toFixed(0)}k char input]`,
    ...signatures.slice(0, 200), // cap at 200 signatures to avoid bloat
    signatures.length > 200 ? `  ... and ${signatures.length - 200} more` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
