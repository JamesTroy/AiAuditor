// RULE-003: Lightweight regex-based taint analysis.
// Traces user-controlled input sources through assignments to dangerous sinks.
// Injected as a <taint_paths> block into security audit prompts to help agents
// focus on the most dangerous data flows without burning context window on
// discovery.

export interface TaintSource {
  /** Line number (1-indexed) where the source was found. */
  line: number;
  /** The taint source expression (e.g., 'req.body.email'). */
  expression: string;
  /** Variable name the tainted value is assigned to. */
  variable: string;
}

export interface TaintSink {
  /** Line number (1-indexed) where the sink was found. */
  line: number;
  /** The sink function/property (e.g., 'eval', 'innerHTML'). */
  sink: string;
  /** The full expression containing the sink. */
  expression: string;
}

export interface TaintPath {
  source: TaintSource;
  sink: TaintSink;
  /** Intermediate variables in the taint chain. */
  chain: string[];
}

export interface TaintAnalysisResult {
  sources: TaintSource[];
  sinks: TaintSink[];
  paths: TaintPath[];
  /** Variables that carry tainted data (propagated from sources). */
  taintedVars: Set<string>;
}

// ── Source patterns: user-controlled input ──────────────────────
const SOURCE_PATTERNS: RegExp[] = [
  // Express/Koa/Fastify
  /\breq(?:uest)?\.(?:body|query|params|headers|cookies)(?:\.\w+)*/g,
  /\breq\.(?:param|header|cookie)\s*\(\s*['"][^'"]+['"]\s*\)/g,
  // Next.js / API routes
  /\b(?:searchParams|formData)\.get\s*\(\s*['"][^'"]+['"]\s*\)/g,
  /\bawait\s+request\.(?:json|text|formData)\s*\(\)/g,
  // Python Flask/Django/FastAPI
  /\brequest\.(?:form|args|values|data|json|files)\s*(?:\[['"][^'"]+['"]\]|\.get\s*\()/g,
  /\brequest\.(?:GET|POST|body)\s*(?:\[['"][^'"]+['"]\]|\.get\s*\()/g,
  // Go net/http
  /\br\.(?:FormValue|URL\.Query\(\)\.Get|Body|PostFormValue)\s*\(/g,
  // Generic URL/form data
  /\bnew\s+URL\s*\([^)]*\)\.searchParams/g,
  /\bdocument\.(?:location|URL|referrer)\b/g,
  /\bwindow\.location\.(?:search|hash|href)\b/g,
  // DOM inputs
  /\bdocument\.getElementById\s*\([^)]*\)\.value\b/g,
  /\b(?:getElementById|querySelector)\s*\([^)]*\)\.(?:value|textContent|innerHTML)\b/g,
];

// ── Sink patterns: dangerous operations ────────────────────────
const SINK_PATTERNS: { pattern: RegExp; name: string }[] = [
  // Code execution
  { pattern: /\beval\s*\(/g, name: 'eval()' },
  { pattern: /\bnew\s+Function\s*\(/g, name: 'new Function()' },
  { pattern: /\bsetTimeout\s*\(\s*[^,)]*\b\w+\b/g, name: 'setTimeout(string)' },
  { pattern: /\bsetInterval\s*\(\s*[^,)]*\b\w+\b/g, name: 'setInterval(string)' },
  // Command injection
  { pattern: /\bexec\s*\(/g, name: 'exec()' },
  { pattern: /\bexecSync\s*\(/g, name: 'execSync()' },
  { pattern: /\bspawn\s*\(/g, name: 'spawn()' },
  { pattern: /\bchild_process/g, name: 'child_process' },
  { pattern: /\bos\.system\s*\(/g, name: 'os.system()' },
  { pattern: /\bsubprocess\.\w+\s*\(/g, name: 'subprocess' },
  // XSS / DOM manipulation
  { pattern: /\.innerHTML\s*=/g, name: 'innerHTML' },
  { pattern: /\.outerHTML\s*=/g, name: 'outerHTML' },
  { pattern: /\bdangerouslySetInnerHTML/g, name: 'dangerouslySetInnerHTML' },
  { pattern: /\bdocument\.write\s*\(/g, name: 'document.write()' },
  // SQL injection
  { pattern: /`[^`]*\$\{[^}]+\}[^`]*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM)/gi, name: 'SQL template literal' },
  { pattern: /['"][^'"]*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM)[^'"]*['"]\s*\+/gi, name: 'SQL string concat' },
  { pattern: /\bf['"].*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM)/gi, name: 'SQL f-string' },
  // Path traversal
  { pattern: /\bfs\.(?:readFile|writeFile|unlink|readdir)\s*\(/g, name: 'fs file operation' },
  { pattern: /\bopen\s*\(\s*(?:f['"]|[\w.]+\s*\+)/g, name: 'file open' },
  // SSRF
  { pattern: /\bfetch\s*\(\s*(?!['"]https?:\/\/)/g, name: 'fetch(dynamic)' },
  { pattern: /\baxios\.\w+\s*\(\s*(?!['"])/g, name: 'axios(dynamic)' },
  { pattern: /\brequests\.(?:get|post|put|delete)\s*\(\s*(?!['"])/g, name: 'requests(dynamic)' },
  // Redirect
  { pattern: /\bredirect\s*\(\s*(?!['"])/g, name: 'redirect(dynamic)' },
  { pattern: /\.redirect\s*\(\s*(?!['"])/g, name: '.redirect(dynamic)' },
];

/**
 * Extract taint sources from code — user-controlled input points.
 */
function findSources(code: string, lines: string[]): TaintSource[] {
  const sources: TaintSource[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of SOURCE_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        // Try to find the variable it's assigned to
        const assignMatch = line.match(/(?:const|let|var|)\s*(\w+)\s*=.*$/);
        const variable = assignMatch?.[1] ?? `_taint_L${i + 1}`;
        sources.push({
          line: i + 1,
          expression: match[0].trim(),
          variable,
        });
      }
    }
  }

  return sources;
}

/**
 * Extract dangerous sinks from code.
 */
function findSinks(code: string, lines: string[]): TaintSink[] {
  const sinks: TaintSink[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, name } of SINK_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        sinks.push({
          line: i + 1,
          sink: name,
          expression: line.trim().slice(0, 120),
        });
      }
    }
  }

  return sinks;
}

/**
 * Propagate taint through simple assignments.
 * Tracks: `const x = taintedVar` and `x = taintedVar.something`
 */
function propagateTaint(
  lines: string[],
  initialTainted: Set<string>,
): Set<string> {
  const tainted = new Set(initialTainted);
  // Two passes to catch forward and backward references
  for (let pass = 0; pass < 2; pass++) {
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;

      // Match assignments: const/let/var x = <expr>
      const assignMatch = trimmed.match(/(?:const|let|var|)\s*(\w+)\s*=\s*(.+?)(?:;|$)/);
      if (assignMatch) {
        const [, varName, rhs] = assignMatch;
        // Check if RHS references any tainted variable
        for (const tv of tainted) {
          if (rhs.includes(tv)) {
            tainted.add(varName);
            break;
          }
        }
      }

      // Match destructuring: const { a, b } = taintedVar
      const destructMatch = trimmed.match(/(?:const|let|var)\s*\{\s*([\w,\s]+)\s*\}\s*=\s*(\w+)/);
      if (destructMatch) {
        const [, vars, source] = destructMatch;
        if (tainted.has(source)) {
          for (const v of vars.split(',')) {
            const clean = v.trim();
            if (clean) tainted.add(clean);
          }
        }
      }
    }
  }

  return tainted;
}

/**
 * Perform lightweight taint analysis on source code.
 * Identifies user input sources, dangerous sinks, and traces connections.
 */
export function analyzeTaint(code: string): TaintAnalysisResult {
  const lines = code.split('\n');
  const sources = findSources(code, lines);
  const sinks = findSinks(code, lines);

  if (sources.length === 0 || sinks.length === 0) {
    return {
      sources,
      sinks,
      paths: [],
      taintedVars: new Set(),
    };
  }

  // Build initial tainted variable set from sources
  const initialTainted = new Set(sources.map((s) => s.variable));
  const taintedVars = propagateTaint(lines, initialTainted);

  // Find paths: tainted variable used in a sink line
  const paths: TaintPath[] = [];
  for (const sink of sinks) {
    const sinkLine = lines[sink.line - 1] ?? '';
    for (const tv of taintedVars) {
      if (sinkLine.includes(tv)) {
        // Find the original source for this tainted var
        const source = sources.find((s) => s.variable === tv)
          ?? sources.find((s) => {
            // Check propagation chain
            return taintedVars.has(s.variable);
          });
        if (source) {
          // Build simple chain
          const chain: string[] = [];
          if (source.variable !== tv) {
            chain.push(source.variable, tv);
          } else {
            chain.push(tv);
          }
          paths.push({ source, sink, chain });
        }
      }
    }
  }

  return { sources, sinks, paths, taintedVars };
}

/**
 * Format taint analysis as a prompt-injectable block.
 * Returns null if no meaningful taint data was found.
 */
export function formatTaintAnalysis(result: TaintAnalysisResult): string | null {
  if (result.sources.length === 0 && result.sinks.length === 0) return null;

  const lines: string[] = [
    `[Taint Analysis — ${result.sources.length} sources, ${result.sinks.length} sinks, ${result.paths.length} potential paths]`,
    '',
  ];

  if (result.paths.length > 0) {
    lines.push('⚠ POTENTIAL TAINT PATHS (user input → dangerous sink):');
    for (const path of result.paths.slice(0, 20)) {
      lines.push(`  L${path.source.line} ${path.source.expression}`);
      lines.push(`    → [${path.chain.join(' → ')}]`);
      lines.push(`    → L${path.sink.line} ${path.sink.sink}: ${path.sink.expression}`);
      lines.push('');
    }
    if (result.paths.length > 20) {
      lines.push(`  ... and ${result.paths.length - 20} more paths`);
    }
  }

  if (result.sinks.length > 0 && result.paths.length === 0) {
    lines.push('Dangerous sinks found (no traced taint path — verify manually):');
    for (const sink of result.sinks.slice(0, 15)) {
      lines.push(`  L${sink.line} ${sink.sink}: ${sink.expression}`);
    }
  }

  return lines.join('\n');
}
