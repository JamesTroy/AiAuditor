// Parse structured data from audit markdown results.
// Extracts score, severity counts, confidence, classification,
// and individual findings from Claude output.

import { extractScore } from '@/lib/extractScore';

export type Confidence = 'certain' | 'likely' | 'possible';
export type Classification = 'vulnerability' | 'deficiency' | 'suggestion';

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  title: string;
  location?: string;
  confidence?: Confidence;
  classification?: Classification;
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

/** Check whether the next few lines after a finding contain a Location/Evidence line. */
function hasEvidence(lines: string[], startIdx: number): boolean {
  // Look ahead up to 6 lines for Location or Evidence markers
  const lookAhead = Math.min(startIdx + 7, lines.length);
  for (let i = startIdx + 1; i < lookAhead; i++) {
    const line = lines[i].trim().toLowerCase();
    if (line.startsWith('- location:') || line.startsWith('- evidence:') ||
        line.startsWith('location:') || line.startsWith('evidence:') ||
        line.startsWith('- **location') || line.startsWith('- **evidence')) {
      return true;
    }
    // Stop looking if we hit another finding or section header
    if (line.startsWith('- **[') || line.startsWith('## ')) break;
  }
  return false;
}

export function parseAuditResult(markdown: string): AuditMetrics {
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
