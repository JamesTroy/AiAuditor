// Parse structured data from audit markdown results.
// Extracts score, severity counts, confidence, classification,
// and individual findings from Claude output.
//
// STRUCT-001: When structured findings are embedded in the result
// (via <!-- STRUCTURED_FINDINGS_START --> delimiter), they are used
// directly instead of regex parsing. This provides mechanically
// validated findings with richer fields.

import { extractScore } from '@/lib/extractScore';
import type { ValidatedFinding } from '@/lib/validateFindings';

export type Confidence = 'certain' | 'likely' | 'possible';
export type Classification = 'vulnerability' | 'deficiency' | 'suggestion';

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  title: string;
  location?: string;
  confidence?: Confidence;
  classification?: Classification;
  // STRUCT-001: Rich fields from structured tool output (when available)
  code_snippet?: string;
  cwe?: string;
  attack_vector?: string;
  exploit_scenario?: string;
  dataflow_path?: string[];
  sanitization_checked?: string;
  assumption?: string;
  remediation?: string;
  /** True when code_snippet was mechanically verified against source code. */
  validated?: boolean;
}

export interface AuditMetrics {
  score: number | null;
  findings: Finding[];
  filteredFindings: Finding[];      // after confidence/evidence filtering
  suggestionCount: number;          // [SUGGESTION] findings separated out
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  totalFindings: number;
  filteredTotal: number;
}

// Match: **[SEVERITY]** [CONFIDENCE] [CLASSIFICATION] Title
// Also handles legacy format without confidence/classification tags
const SEVERITY_RE = /\*?\*?\[?(CRITICAL|HIGH|MEDIUM|LOW|INFORMATIONAL)\]?\*?\*?\s*[-—]?\s*(.+)/i;
const CONFIDENCE_RE = /\[?(CERTAIN|LIKELY|POSSIBLE)\]?/i;
const CLASSIFICATION_RE = /\[?(VULNERABILITY|DEFICIENCY|SUGGESTION|NOT APPLICABLE)\]?/i;
const FINDING_ID_RE = /\b([A-Z]+-\d+)\b/;

function extractConfidence(text: string): { confidence?: Confidence; rest: string } {
  const match = text.match(CONFIDENCE_RE);
  if (!match) return { rest: text };
  const confidence = match[1].toLowerCase() as Confidence;
  const rest = text.replace(match[0], '').trim();
  return { confidence, rest };
}

function extractClassification(text: string): { classification?: Classification; rest: string } {
  const match = text.match(CLASSIFICATION_RE);
  if (!match) return { rest: text };
  const raw = match[1].toLowerCase();
  if (raw === 'not applicable') return { rest: text.replace(match[0], '').trim() };
  const classification = raw as Classification;
  const rest = text.replace(match[0], '').trim();
  return { classification, rest };
}


export interface ParseOptions {
  /**
   * When true, [LIKELY] findings are also excluded from filteredFindings —
   * used for agents whose dismissal analytics show a high [LIKELY] FP rate.
   */
  downgradeHighFpLikely?: boolean;
}

// STRUCT-001: Extract embedded structured findings from result text.
// Returns null if no structured findings block is present (pre-STRUCT audits).
const STRUCT_START = '<!-- STRUCTURED_FINDINGS_START -->';
const STRUCT_END = '<!-- STRUCTURED_FINDINGS_END -->';

function extractStructuredFindings(text: string): ValidatedFinding[] | null {
  const startIdx = text.indexOf(STRUCT_START);
  if (startIdx === -1) return null;
  const jsonStart = startIdx + STRUCT_START.length;
  const endIdx = text.indexOf(STRUCT_END, jsonStart);
  if (endIdx === -1) return null;
  try {
    const json = text.slice(jsonStart, endIdx).trim();
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return parsed as ValidatedFinding[];
  } catch {
    return null;
  }
}

/** Strip the structured findings block from markdown before display. */
export function stripStructuredBlock(text: string): string {
  const startIdx = text.indexOf(STRUCT_START);
  if (startIdx === -1) return text;
  const endIdx = text.indexOf(STRUCT_END);
  if (endIdx === -1) return text;
  return text.slice(0, startIdx).trimEnd() + text.slice(endIdx + STRUCT_END.length);
}

/** Convert a ValidatedFinding to the Finding interface. */
function toFinding(vf: ValidatedFinding): Finding {
  return {
    id: vf.id,
    severity: vf.severity,
    title: vf.title,
    location: vf.location,
    confidence: vf.confidence,
    classification: vf.classification,
    code_snippet: vf.code_snippet,
    cwe: vf.cwe,
    attack_vector: vf.attack_vector,
    exploit_scenario: vf.exploit_scenario,
    dataflow_path: vf.dataflow_path,
    sanitization_checked: vf.sanitization_checked,
    assumption: vf.assumption,
    remediation: vf.remediation,
    validated: vf.validated,
  };
}

export function parseAuditResult(markdown: string, options: ParseOptions = {}): AuditMetrics {
  // STRUCT-001: Try structured findings first — mechanically validated,
  // richer fields, no regex ambiguity. Falls back to regex for old audits.
  const structuredFindings = extractStructuredFindings(markdown);

  // Strip the structured block before score extraction (it's not markdown).
  const cleanMarkdown = stripStructuredBlock(markdown);

  if (structuredFindings && structuredFindings.length > 0) {
    return parseFromStructured(structuredFindings, cleanMarkdown, options);
  }

  // Legacy regex-based parsing for pre-STRUCT audits.
  return parseFromMarkdown(cleanMarkdown, options);
}

/** Parse metrics from validated structured findings. */
function parseFromStructured(
  structuredFindings: ValidatedFinding[],
  markdown: string,
  options: ParseOptions,
): AuditMetrics {
  const findings: Finding[] = structuredFindings.map(toFinding);
  const score = extractScore(markdown);

  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  for (const f of findings) {
    severityCounts[f.severity]++;
  }

  const filteredFindings = findings.filter((f) => {
    if (f.confidence === 'possible') return false;
    if (f.classification === 'suggestion') return false;
    if (options.downgradeHighFpLikely && f.confidence === 'likely') return false;
    return true;
  });

  const suggestionCount = findings.filter((f) => f.classification === 'suggestion').length;

  return {
    score,
    findings,
    filteredFindings,
    suggestionCount,
    severityCounts,
    totalFindings: findings.length,
    filteredTotal: filteredFindings.length,
  };
}

/** Legacy regex-based parsing for pre-STRUCT audit results. */
function parseFromMarkdown(markdown: string, options: ParseOptions): AuditMetrics {
  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  };

  const findings: Finding[] = [];

  const score = extractScore(markdown);

  // Extract findings by severity, confidence, and classification
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;
    const severityMatch = line.match(SEVERITY_RE);
    if (severityMatch) {
      const severity = severityMatch[1].toLowerCase() as Finding['severity'];
      let titleText = severityMatch[2].replace(/\*\*/g, '').trim();

      // Extract confidence and classification tags from the title
      const { confidence, rest: afterConfidence } = extractConfidence(titleText);
      const { classification, rest: afterClassification } = extractClassification(afterConfidence);
      titleText = afterClassification;

      const idMatch = titleText.match(FINDING_ID_RE);

      severityCounts[severity]++;
      findings.push({
        id: idMatch ? idMatch[1] : `${severity.toUpperCase()}-${severityCounts[severity]}`,
        severity,
        title: titleText.replace(FINDING_ID_RE, '').replace(/^\s*[-—]\s*/, '').trim(),
        confidence,
        classification,
      });
    }
  }

  // Fallback: count severity keywords in headers/bold text if no structured findings found
  if (findings.length === 0) {
    const findingContext = /(?:severity|finding|issue|vulnerability|risk)\s*[:]\s*(?:critical|high|medium|low)/gi;
    const contextMatches = [...markdown.matchAll(findingContext)];
    for (const m of contextMatches) {
      const sev = m[0].match(/critical|high|medium|low/i)?.[0]?.toLowerCase() as Finding['severity'] | undefined;
      if (sev && sev in severityCounts) severityCounts[sev]++;
    }

    const tablePattern = /\|\s*(Critical|High|Medium|Low|Informational)\s*\|\s*(\d+)\s*\|/gi;
    for (const m of markdown.matchAll(tablePattern)) {
      const sev = m[1].toLowerCase() as Finding['severity'];
      const count = parseInt(m[2], 10);
      if (sev in severityCounts && !isNaN(count)) {
        severityCounts[sev] = count;
      }
    }
  }

  // Post-processing: filter out low-confidence and suggestion-only findings
  const filteredFindings = findings.filter((f) => {
    // Filter out [POSSIBLE] confidence findings — too speculative
    if (f.confidence === 'possible') return false;
    // Filter out [SUGGESTION] classification — not a defect
    if (f.classification === 'suggestion') return false;
    // For agents with a high [LIKELY] dismissal rate, treat [LIKELY] as [POSSIBLE]
    if (options.downgradeHighFpLikely && f.confidence === 'likely') return false;
    return true;
  });

  const suggestionCount = findings.filter((f) => f.classification === 'suggestion').length;

  const totalFindings = findings.length > 0
    ? findings.length
    : Object.values(severityCounts).reduce((sum, n) => sum + n, 0);

  return {
    score,
    findings,
    filteredFindings,
    suggestionCount,
    severityCounts,
    totalFindings,
    filteredTotal: filteredFindings.length,
  };
}
