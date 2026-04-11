import { describe, it, expect } from 'vitest';
import { parseAuditResult } from '@/lib/parseAuditResult';

describe('parseAuditResult', () => {
  it('extracts severity, confidence, and classification from structured findings', () => {
    const markdown = `## Findings
- **[CRITICAL]** [CERTAIN] [VULNERABILITY] SQL injection in login form
  - Location: auth.ts:42
  - Evidence: \`db.query(userInput)\`
- **[HIGH]** [LIKELY] [DEFICIENCY] Missing rate limiting on API endpoint
  - Location: api/route.ts:10
- **[MEDIUM]** [POSSIBLE] [SUGGESTION] Consider adding input validation
  - Location: form.ts:5

## Overall Score
| Dimension | Score |
|---|---|
| **Overall** | 45/100 |`;

    const result = parseAuditResult(markdown);

    expect(result.findings).toHaveLength(3);
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].confidence).toBe('certain');
    expect(result.findings[0].classification).toBe('vulnerability');
    expect(result.findings[0].title).toContain('SQL injection');

    expect(result.findings[1].confidence).toBe('likely');
    expect(result.findings[1].classification).toBe('deficiency');

    expect(result.findings[2].confidence).toBe('possible');
    expect(result.findings[2].classification).toBe('suggestion');
  });

  it('filters out [POSSIBLE] and [SUGGESTION] findings in filteredFindings', () => {
    const markdown = `## Findings
- **[CRITICAL]** [CERTAIN] [VULNERABILITY] Real bug
- **[LOW]** [POSSIBLE] [DEFICIENCY] Maybe an issue
- **[LOW]** [LIKELY] [SUGGESTION] Nice to have

## Overall Score: 70/100`;

    const result = parseAuditResult(markdown);

    expect(result.findings).toHaveLength(3);
    expect(result.filteredFindings).toHaveLength(1);
    expect(result.filteredFindings[0].title).toContain('Real bug');
    expect(result.filteredTotal).toBe(1);
    expect(result.suggestionCount).toBe(1);
  });

  it('handles legacy format without confidence/classification tags', () => {
    const markdown = `## Findings
- **[HIGH]** — Missing error handling in API route
  - Location: route.ts:15
- **[MEDIUM]** — Unused variable detected
  - Location: utils.ts:3

## Overall Score: 75/100`;

    const result = parseAuditResult(markdown);

    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].severity).toBe('high');
    expect(result.findings[0].confidence).toBeUndefined();
    expect(result.findings[0].classification).toBeUndefined();
    // Legacy findings pass through to filtered (no tags = not filtered)
    expect(result.filteredFindings).toHaveLength(2);
  });

  it('counts severities correctly', () => {
    const markdown = `
- **[CRITICAL]** [CERTAIN] [VULNERABILITY] Issue 1
- **[CRITICAL]** [CERTAIN] [VULNERABILITY] Issue 2
- **[HIGH]** [LIKELY] [DEFICIENCY] Issue 3
- **[MEDIUM]** [LIKELY] [DEFICIENCY] Issue 4
- **[LOW]** [CERTAIN] [DEFICIENCY] Issue 5
- **[INFORMATIONAL]** [CERTAIN] [SUGGESTION] Issue 6`;

    const result = parseAuditResult(markdown);

    expect(result.severityCounts.critical).toBe(2);
    expect(result.severityCounts.high).toBe(1);
    expect(result.severityCounts.medium).toBe(1);
    expect(result.severityCounts.low).toBe(1);
    expect(result.severityCounts.informational).toBe(1);
    expect(result.totalFindings).toBe(6);
  });

  it('returns zero findings for clean report', () => {
    const markdown = `## Summary
No issues found. The code is clean.

## Overall Score: 95/100`;

    const result = parseAuditResult(markdown);

    expect(result.findings).toHaveLength(0);
    expect(result.filteredFindings).toHaveLength(0);
    expect(result.totalFindings).toBe(0);
    expect(result.score).toBe(95);
  });

  it('extracts score from table format', () => {
    const markdown = `| **Composite** | 7.5/10 |`;
    const result = parseAuditResult(markdown);
    expect(result.score).toBe(75);
  });

  it('ignores severity tags inside code blocks', () => {
    const markdown = `## Findings
- **[HIGH]** [CERTAIN] [VULNERABILITY] Real SQL injection bug

\`\`\`python
# [CRITICAL] This is example code
password = input()
\`\`\`

- **[MEDIUM]** [LIKELY] [DEFICIENCY] Missing validation`;

    const result = parseAuditResult(markdown);

    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].severity).toBe('high');
    expect(result.findings[1].severity).toBe('medium');
    expect(result.severityCounts.critical).toBe(0);
  });

  it('handles [NOT APPLICABLE] classification by dropping it', () => {
    const markdown = `- **[LOW]** [CERTAIN] [NOT APPLICABLE] SSR content missing on SPA`;
    const result = parseAuditResult(markdown);

    expect(result.findings).toHaveLength(1);
    // NOT APPLICABLE has no classification set
    expect(result.findings[0].classification).toBeUndefined();
  });

  it('downgradeHighFpLikely: true filters out [LIKELY] findings from filteredFindings', () => {
    const markdown = `## Findings
- **[CRITICAL]** [CERTAIN] [VULNERABILITY] Remote code execution via deserialization
- **[HIGH]** [LIKELY] [DEFICIENCY] Missing authentication check on admin endpoint

## Overall Score: 40/100`;

    const result = parseAuditResult(markdown, { downgradeHighFpLikely: true });

    // Raw findings list is unaffected — both findings are still present
    expect(result.findings).toHaveLength(2);
    expect(result.findings[1].confidence).toBe('likely');

    // Only the [CERTAIN] finding survives the filter
    expect(result.filteredFindings).toHaveLength(1);
    expect(result.filteredFindings[0].title).toContain('Remote code execution');
    expect(result.filteredTotal).toBe(1);
  });

  it('downgradeHighFpLikely: false (default) keeps [LIKELY] findings in filteredFindings', () => {
    const markdown = `## Findings
- **[CRITICAL]** [CERTAIN] [VULNERABILITY] Remote code execution via deserialization
- **[HIGH]** [LIKELY] [DEFICIENCY] Missing authentication check on admin endpoint

## Overall Score: 40/100`;

    // Explicitly false
    const resultFalse = parseAuditResult(markdown, { downgradeHighFpLikely: false });
    expect(resultFalse.filteredFindings).toHaveLength(2);

    // Default (no option)
    const resultDefault = parseAuditResult(markdown);
    expect(resultDefault.filteredFindings).toHaveLength(2);
  });

  it('downgradeHighFpLikely: true does not affect [CERTAIN] findings', () => {
    const markdown = `## Findings
- **[CRITICAL]** [CERTAIN] [VULNERABILITY] Arbitrary file write via path traversal
- **[HIGH]** [CERTAIN] [VULNERABILITY] SQL injection in search parameter
- **[MEDIUM]** [CERTAIN] [DEFICIENCY] Sensitive data logged in plaintext`;

    const result = parseAuditResult(markdown, { downgradeHighFpLikely: true });

    expect(result.findings).toHaveLength(3);
    expect(result.filteredFindings).toHaveLength(3);
    expect(result.filteredTotal).toBe(3);
  });
});
