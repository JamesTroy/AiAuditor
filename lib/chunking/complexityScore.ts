// RULE-004: Estimate cyclomatic complexity per function.
// Counts branching keywords (if, else, switch, case, for, while, &&, ||, ?:)
// to score each function's complexity. Functions >15 are flagged as hotspots
// and injected into code-quality and performance prompts.

export interface FunctionComplexity {
  /** Function/method name (or 'anonymous' for arrow functions). */
  name: string;
  /** Line number where the function starts (1-indexed). */
  line: number;
  /** Estimated cyclomatic complexity score. */
  complexity: number;
  /** The function signature (first line, truncated). */
  signature: string;
}

export interface ComplexityResult {
  functions: FunctionComplexity[];
  /** Functions with complexity > threshold. */
  hotspots: FunctionComplexity[];
  /** Average complexity across all detected functions. */
  averageComplexity: number;
  /** Total number of functions detected. */
  totalFunctions: number;
}

// ── Function boundary detection ────────────────────────────────

const FUNCTION_START_PATTERNS: RegExp[] = [
  // JS/TS: function name(...) / async function name(...)
  /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
  // JS/TS: class method / public method(...)
  /^\s+(?:public|private|protected|static|async|readonly|\s)*(\w+)\s*\([^)]*\)\s*(?::\s*\S+\s*)?[{]/,
  // JS/TS: const name = (...) => / const name = function(...)
  /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w]+)\s*=>/,
  /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(/,
  // Python: def name(...)
  /^(?:async\s+)?def\s+(\w+)\s*\(/,
  // Go: func name(...) / func (receiver) name(...)
  /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/,
  // Rust: fn name(...) / pub fn name(...)
  /^(?:pub(?:\(crate\))?\s+)?(?:async\s+)?fn\s+(\w+)\s*[(<]/,
  // Java/Kotlin: public void name(...) / fun name(...)
  /^(?:\s+)?(?:public|private|protected|static|\s)*(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+\s*)?[{:]/,
  /^\s*(?:fun|suspend\s+fun)\s+(\w+)\s*\(/,
];

// ── Complexity counting ────────────────────────────────────────

// Branching keywords/operators that increment cyclomatic complexity
const COMPLEXITY_PATTERNS: RegExp[] = [
  /\bif\s*\(/g,
  /\belse\s+if\s*\(/g,
  /\belse\b/g,
  /\bswitch\s*\(/g,
  /\bcase\s+/g,
  /\bfor\s*\(/g,
  /\bfor\s+\w+\s+(?:in|of)\b/g,
  /\bwhile\s*\(/g,
  /\bdo\s*\{/g,
  /\bcatch\s*\(/g,
  /&&/g,
  /\|\|/g,
  /\?\?/g,
  /\?\s*[^?:]+\s*:/g, // ternary (approximate)
  // Python-specific
  /\belif\s+/g,
  /\bexcept\s+/g,
  // Go-specific
  /\bselect\s*\{/g,
  // Rust-specific
  /\bmatch\s+/g,
];

/**
 * Count complexity-incrementing patterns in a block of code.
 * Base complexity is 1 (every function has at least one path).
 */
function countComplexity(codeBlock: string): number {
  let complexity = 1; // base path

  // Strip string literals and comments to avoid false positives
  const stripped = codeBlock
    .replace(/\/\/.*$/gm, '')          // single-line comments
    .replace(/#.*$/gm, '')             // Python comments
    .replace(/\/\*[\s\S]*?\*\//g, '')  // block comments
    .replace(/'(?:[^'\\]|\\.)*'/g, '') // single-quoted strings
    .replace(/"(?:[^"\\]|\\.)*"/g, '') // double-quoted strings
    .replace(/`(?:[^`\\]|\\.)*`/g, ''); // template literals

  for (const pattern of COMPLEXITY_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(stripped)) !== null) {
      complexity++;
    }
  }

  return complexity;
}

/**
 * Find the matching closing brace for a function body.
 * Returns the line index (0-based) of the closing brace.
 */
function findFunctionEnd(lines: string[], startLine: number): number {
  let depth = 0;
  let foundOpen = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') { depth--; }
      if (foundOpen && depth === 0) return i;
    }
  }

  // Python / indentation-based: look for de-indent
  if (!foundOpen) {
    const startIndent = lines[startLine]?.search(/\S/) ?? 0;
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      const indent = line.search(/\S/);
      if (indent >= 0 && indent <= startIndent && i > startLine + 1) {
        return i - 1;
      }
    }
    return lines.length - 1;
  }

  return Math.min(startLine + 200, lines.length - 1); // fallback cap
}

/**
 * Analyze cyclomatic complexity of all detected functions in the code.
 *
 * @param code Source code to analyze
 * @param hotspotThreshold Complexity score above which a function is a "hotspot" (default: 15)
 */
export function analyzeComplexity(
  code: string,
  hotspotThreshold = 15,
): ComplexityResult {
  const lines = code.split('\n');
  const functions: FunctionComplexity[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;

    for (const pattern of FUNCTION_START_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        const name = match[1] || 'anonymous';
        const endLine = findFunctionEnd(lines, i);
        const body = lines.slice(i, endLine + 1).join('\n');
        const complexity = countComplexity(body);

        functions.push({
          name,
          line: i + 1,
          complexity,
          signature: trimmed.slice(0, 100),
        });
        break; // only match first pattern per line
      }
    }
  }

  const hotspots = functions
    .filter((f) => f.complexity > hotspotThreshold)
    .sort((a, b) => b.complexity - a.complexity);

  const totalComplexity = functions.reduce((sum, f) => sum + f.complexity, 0);
  const averageComplexity = functions.length > 0 ? totalComplexity / functions.length : 0;

  return {
    functions,
    hotspots,
    averageComplexity: Math.round(averageComplexity * 10) / 10,
    totalFunctions: functions.length,
  };
}

/**
 * Format complexity analysis as a prompt-injectable block.
 * Returns null if no hotspots are found (complexity is manageable).
 */
export function formatComplexityHotspots(result: ComplexityResult): string | null {
  if (result.hotspots.length === 0 && result.averageComplexity < 10) return null;

  const lines: string[] = [
    `[Complexity Analysis — ${result.totalFunctions} functions, avg complexity: ${result.averageComplexity}]`,
  ];

  if (result.hotspots.length > 0) {
    lines.push('');
    lines.push(`⚠ HIGH COMPLEXITY HOTSPOTS (>${15} cyclomatic complexity):`);
    lines.push('These functions are the highest-risk for bugs, hardest to test, and should be refactored:');
    lines.push('');
    for (const hs of result.hotspots.slice(0, 20)) {
      lines.push(`  L${hs.line} ${hs.name}() — complexity: ${hs.complexity}`);
      lines.push(`    ${hs.signature}`);
    }
    if (result.hotspots.length > 20) {
      lines.push(`  ... and ${result.hotspots.length - 20} more hotspots`);
    }
  }

  return lines.join('\n');
}
