// Parse structured data from audit markdown results.
// Extracts score, severity counts, and individual findings
// without changing the Claude output format.

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  title: string;
  location?: string;
}

export interface AuditMetrics {
  score: number | null;
  findings: Finding[];
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  totalFindings: number;
}

const SEVERITY_PATTERN = /\*?\*?\[?(CRITICAL|HIGH|MEDIUM|LOW|INFORMATIONAL)\]?\*?\*?\s*[-—]\s*(.+)/gi;
const FINDING_ID_PATTERN = /\b([A-Z]+-\d+)\b/;

export function parseAuditResult(markdown: string): AuditMetrics {
  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  };

  const findings: Finding[] = [];

  // Extract score — check table rows first, then fall back to N/100 (last match)
  const tableOverall = markdown.match(
    /\|\s*\*{0,2}(?:Overall|Composite|Total)\*{0,2}\s*\|\s*(\d{1,3}(?:\.\d+)?)\s*\|/i,
  );
  let score: number | null = null;
  if (tableOverall) {
    const val = parseFloat(tableOverall[1]);
    if (val <= 10) score = Math.round(val * 10);
    else if (val >= 0 && val <= 100) score = Math.round(val);
  }
  if (score === null) {
    const allSlash100 = [...markdown.matchAll(/(\d{1,3})\s*\/\s*100/g)];
    if (allSlash100.length > 0) {
      const last = allSlash100[allSlash100.length - 1];
      const val = parseInt(last[1], 10);
      if (val >= 0 && val <= 100) score = val;
    }
  }
  if (score === null) {
    const overallLine = markdown.match(
      /overall\s*(?:score|rating)?\s*[:]\s*(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(\d+))?/i,
    );
    if (overallLine) {
      const num = parseFloat(overallLine[1]);
      const denom = overallLine[2] ? parseInt(overallLine[2], 10) : null;
      if (denom === 10 && num <= 10) score = Math.round(num * 10);
      else if (denom === 100 && num <= 100) score = Math.round(num);
      else if (!denom && num >= 0 && num <= 100) score = Math.round(num);
    }
  }

  // Extract findings by severity
  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = line.match(SEVERITY_PATTERN);
    if (!match) {
      // Try individual line match
      const severityMatch = line.match(/\*?\*?\[?(CRITICAL|HIGH|MEDIUM|LOW|INFORMATIONAL)\]?\*?\*?\s*[-—]\s*(.+)/i);
      if (severityMatch) {
        const severity = severityMatch[1].toLowerCase() as Finding['severity'];
        const title = severityMatch[2].replace(/\*\*/g, '').trim();
        const idMatch = title.match(FINDING_ID_PATTERN);

        severityCounts[severity]++;
        findings.push({
          id: idMatch ? idMatch[1] : `${severity.toUpperCase()}-${severityCounts[severity]}`,
          severity,
          title: title.replace(FINDING_ID_PATTERN, '').replace(/^\s*[-—]\s*/, '').trim(),
        });
      }
    }
  }

  // Fallback: count severity keywords in headers/bold text if no structured findings found
  if (findings.length === 0) {
    const criticalMatches = markdown.match(/\bcritical\b/gi);
    const highMatches = markdown.match(/\bhigh\b/gi);
    const mediumMatches = markdown.match(/\bmedium\b/gi);
    const lowMatches = markdown.match(/\blow\b/gi);

    // Only count if they appear in a finding-like context (near severity/vuln/finding)
    const findingContext = /(?:severity|finding|issue|vulnerability|risk)\s*[:]\s*(?:critical|high|medium|low)/gi;
    const contextMatches = [...markdown.matchAll(findingContext)];
    for (const m of contextMatches) {
      const sev = m[0].match(/critical|high|medium|low/i)?.[0]?.toLowerCase() as Finding['severity'] | undefined;
      if (sev && sev in severityCounts) severityCounts[sev]++;
    }

    // Also check table-style severity counts: "| Critical | 2 |"
    const tablePattern = /\|\s*(Critical|High|Medium|Low|Informational)\s*\|\s*(\d+)\s*\|/gi;
    for (const m of markdown.matchAll(tablePattern)) {
      const sev = m[1].toLowerCase() as Finding['severity'];
      const count = parseInt(m[2], 10);
      if (sev in severityCounts && !isNaN(count)) {
        severityCounts[sev] = count;
      }
    }
  }

  const totalFindings = findings.length > 0
    ? findings.length
    : Object.values(severityCounts).reduce((sum, n) => sum + n, 0);

  return {
    score,
    findings,
    severityCounts,
    totalFindings,
  };
}
