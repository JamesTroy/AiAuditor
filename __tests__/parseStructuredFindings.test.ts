import { describe, it, expect } from 'vitest';
import { parseAuditResult, stripStructuredBlock } from '@/lib/parseAuditResult';

// Helper: wrap validated findings JSON in the delimiter format
function embedFindings(markdown: string, findings: unknown[]): string {
  return (
    markdown +
    '\n\n<!-- STRUCTURED_FINDINGS_START -->\n' +
    JSON.stringify(findings) +
    '\n<!-- STRUCTURED_FINDINGS_END -->'
  );
}

const SAMPLE_MARKDOWN = `
# Security Audit Report

## Findings

**[CRITICAL]** [CERTAIN] [VULNERABILITY] — SQL Injection in login endpoint

## Overall Score: 35/100
`;

const SAMPLE_STRUCTURED = [
  {
    id: 'VULN-001',
    severity: 'critical',
    confidence: 'certain',
    classification: 'vulnerability',
    title: 'SQL Injection in login endpoint',
    location: 'src/auth.ts:42',
    code_snippet: "db.query('SELECT * FROM users WHERE id = ' + id)",
    remediation: 'Use parameterized queries',
    validated: true,
  },
  {
    id: 'CQ-001',
    severity: 'medium',
    confidence: 'likely',
    classification: 'deficiency',
    title: 'Missing error handling in API route',
    assumption: 'No global error handler wraps this route',
    remediation: 'Add try-catch block',
    validated: false,
    validation_note: 'No code_snippet provided',
  },
  {
    id: 'SUG-001',
    severity: 'low',
    confidence: 'certain',
    classification: 'suggestion',
    title: 'Consider adding TypeScript strict mode',
    remediation: 'Enable strict in tsconfig.json',
    validated: false,
  },
];

describe('parseAuditResult with structured findings', () => {
  it('uses structured findings when embedded in result', () => {
    const result = embedFindings(SAMPLE_MARKDOWN, SAMPLE_STRUCTURED);
    const metrics = parseAuditResult(result);

    // Should have all 3 findings
    expect(metrics.findings).toHaveLength(3);
    expect(metrics.totalFindings).toBe(3);

    // First finding should have rich fields
    expect(metrics.findings[0].id).toBe('VULN-001');
    expect(metrics.findings[0].severity).toBe('critical');
    expect(metrics.findings[0].confidence).toBe('certain');
    expect(metrics.findings[0].classification).toBe('vulnerability');
    expect(metrics.findings[0].code_snippet).toBe("db.query('SELECT * FROM users WHERE id = ' + id)");
    expect(metrics.findings[0].validated).toBe(true);
    expect(metrics.findings[0].remediation).toBe('Use parameterized queries');
  });

  it('filters [POSSIBLE] and [SUGGESTION] from filteredFindings', () => {
    const result = embedFindings(SAMPLE_MARKDOWN, SAMPLE_STRUCTURED);
    const metrics = parseAuditResult(result);

    // Suggestions are filtered out of filteredFindings
    expect(metrics.filteredFindings).toHaveLength(2);
    expect(metrics.filteredFindings.map((f) => f.id)).toEqual(['VULN-001', 'CQ-001']);
    expect(metrics.suggestionCount).toBe(1);
  });

  it('filters [LIKELY] when downgradeHighFpLikely is true', () => {
    const result = embedFindings(SAMPLE_MARKDOWN, SAMPLE_STRUCTURED);
    const metrics = parseAuditResult(result, { downgradeHighFpLikely: true });

    // Only [CERTAIN] non-suggestion findings remain
    expect(metrics.filteredFindings).toHaveLength(1);
    expect(metrics.filteredFindings[0].id).toBe('VULN-001');
  });

  it('extracts score from markdown (not from structured block)', () => {
    const result = embedFindings(SAMPLE_MARKDOWN, SAMPLE_STRUCTURED);
    const metrics = parseAuditResult(result);
    expect(metrics.score).toBe(35);
  });

  it('counts severity correctly from structured findings', () => {
    const result = embedFindings(SAMPLE_MARKDOWN, SAMPLE_STRUCTURED);
    const metrics = parseAuditResult(result);
    expect(metrics.severityCounts).toEqual({
      critical: 1,
      high: 0,
      medium: 1,
      low: 1,
      informational: 0,
    });
  });

  it('falls back to regex parsing when no structured block present', () => {
    const metrics = parseAuditResult(SAMPLE_MARKDOWN);
    // Regex parser should find the CRITICAL finding
    expect(metrics.findings.length).toBeGreaterThanOrEqual(1);
    expect(metrics.findings[0].severity).toBe('critical');
    // No rich fields from regex parsing
    expect(metrics.findings[0].code_snippet).toBeUndefined();
    expect(metrics.findings[0].validated).toBeUndefined();
  });

  it('falls back to regex parsing when structured block has invalid JSON', () => {
    const result = SAMPLE_MARKDOWN +
      '\n\n<!-- STRUCTURED_FINDINGS_START -->\n{not valid json!!!\n<!-- STRUCTURED_FINDINGS_END -->';
    const metrics = parseAuditResult(result);
    // Should fall back to regex — still find the CRITICAL finding
    expect(metrics.findings.length).toBeGreaterThanOrEqual(1);
    expect(metrics.findings[0].severity).toBe('critical');
  });

  it('falls back to regex parsing when structured block has empty array', () => {
    const result = embedFindings(SAMPLE_MARKDOWN, []);
    const metrics = parseAuditResult(result);
    // Empty structured findings → falls back to regex
    expect(metrics.findings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('stripStructuredBlock', () => {
  it('removes the structured findings block from markdown', () => {
    const result = embedFindings(SAMPLE_MARKDOWN, SAMPLE_STRUCTURED);
    const stripped = stripStructuredBlock(result);
    expect(stripped).not.toContain('STRUCTURED_FINDINGS_START');
    expect(stripped).not.toContain('STRUCTURED_FINDINGS_END');
    expect(stripped).not.toContain('VULN-001');
    // Original markdown preserved
    expect(stripped).toContain('# Security Audit Report');
    expect(stripped).toContain('Overall Score: 35/100');
  });

  it('returns original text when no structured block present', () => {
    const stripped = stripStructuredBlock(SAMPLE_MARKDOWN);
    expect(stripped).toBe(SAMPLE_MARKDOWN);
  });

  it('handles text with only start delimiter (no end)', () => {
    const malformed = SAMPLE_MARKDOWN + '\n\n<!-- STRUCTURED_FINDINGS_START -->\n{broken';
    const stripped = stripStructuredBlock(malformed);
    // Should return original since no end delimiter
    expect(stripped).toBe(malformed);
  });
});
