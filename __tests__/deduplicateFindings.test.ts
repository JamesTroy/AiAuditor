import { describe, it, expect } from 'vitest';
import { deduplicateFindings, AgentFindingSet } from '@/lib/deduplicateFindings';
import type { Finding } from '@/lib/parseAuditResult';

function makeSet(
  agentId: string,
  agentName: string,
  agentCategory: string,
  findings: Array<{
    title: string;
    severity?: Finding['severity'];
    confidence?: Finding['confidence'];
    classification?: Finding['classification'];
  }>,
): AgentFindingSet {
  return {
    agentId,
    agentName,
    agentCategory,
    findings: findings.map((f, i) => ({
      id: `${agentId}-${i}`,
      severity: f.severity ?? 'medium',
      title: f.title,
      confidence: f.confidence,
      classification: f.classification,
    })),
  };
}

describe('deduplicateFindings', () => {
  // ------------------------------------------------------------------
  // Basic behaviour
  // ------------------------------------------------------------------

  it('returns zero counts and empty groups for empty input', () => {
    const result = deduplicateFindings([]);
    expect(result).toEqual({ totalFindings: 0, uniqueCount: 0, duplicateGroups: [] });
  });

  it('returns zero counts and empty groups when all sets have no findings', () => {
    const setA = makeSet('agent-a', 'Agent A', 'Security & Privacy', []);
    const result = deduplicateFindings([setA]);
    expect(result).toEqual({ totalFindings: 0, uniqueCount: 0, duplicateGroups: [] });
  });

  it('single agent with multiple findings produces no duplicate groups', () => {
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'Missing error handling in API route', severity: 'high' },
      { title: 'Unused variable in utility module', severity: 'low' },
      { title: 'Hardcoded timeout value', severity: 'medium' },
    ]);
    const result = deduplicateFindings([setA]);
    expect(result.totalFindings).toBe(3);
    expect(result.uniqueCount).toBe(3);
    expect(result.duplicateGroups).toHaveLength(0);
  });

  it('two agents with completely unrelated titles produce no duplicate groups', () => {
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'Unused variable detected in utils', severity: 'low' },
    ]);
    const setB = makeSet('agent-b', 'Agent B', 'Performance', [
      { title: 'Synchronous file read blocking event loop', severity: 'high' },
      { title: 'Inefficient database query pagination', severity: 'medium' },
    ]);
    const result = deduplicateFindings([setA, setB]);
    expect(result.totalFindings).toBe(3);
    expect(result.uniqueCount).toBe(3);
    expect(result.duplicateGroups).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // Deduplication grouping
  // ------------------------------------------------------------------

  it('two agents with nearly identical titles form one duplicate group', () => {
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'SQL injection via string concatenation', severity: 'high' },
    ]);
    const setB = makeSet('agent-b', 'Agent B', 'Code Quality', [
      { title: 'SQL injection through string concatenation', severity: 'medium' },
    ]);
    const result = deduplicateFindings([setA, setB]);
    expect(result.totalFindings).toBe(2);
    expect(result.uniqueCount).toBe(1);
    expect(result.duplicateGroups).toHaveLength(1);
    expect(result.duplicateGroups[0].entries).toHaveLength(2);
  });

  it('group representative title comes from the highest-severity entry', () => {
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'SQL injection via string concatenation', severity: 'critical' },
    ]);
    const setB = makeSet('agent-b', 'Agent B', 'Code Quality', [
      { title: 'SQL injection through string concatenation', severity: 'low' },
    ]);
    const result = deduplicateFindings([setA, setB]);
    expect(result.duplicateGroups[0].title).toBe('SQL injection via string concatenation');
  });

  it('highestSeverity on the group reflects the most severe entry', () => {
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'SQL injection via string concatenation', severity: 'medium' },
    ]);
    const setB = makeSet('agent-b', 'Agent B', 'Code Quality', [
      { title: 'SQL injection through string concatenation', severity: 'critical' },
    ]);
    const result = deduplicateFindings([setA, setB]);
    expect(result.duplicateGroups[0].highestSeverity).toBe('critical');
  });

  // ------------------------------------------------------------------
  // Subset matching
  // ------------------------------------------------------------------

  it('groups when one title tokens are a full subset of the other (isSubset path)', () => {
    // "sql injection" tokens ⊂ "sql injection login form" tokens
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'SQL injection', severity: 'high' },
    ]);
    const setB = makeSet('agent-b', 'Agent B', 'Code Quality', [
      { title: 'SQL injection in login form', severity: 'medium' },
    ]);
    const result = deduplicateFindings([setA, setB]);
    expect(result.duplicateGroups).toHaveLength(1);
    expect(result.duplicateGroups[0].entries).toHaveLength(2);
  });

  // ------------------------------------------------------------------
  // Same-agent isolation
  // ------------------------------------------------------------------

  it('does not group findings from the same agent even with identical titles', () => {
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'Missing input validation on login form', severity: 'high' },
      { title: 'Missing input validation on login form', severity: 'high' },
    ]);
    const result = deduplicateFindings([setA]);
    expect(result.totalFindings).toBe(2);
    expect(result.uniqueCount).toBe(2);
    expect(result.duplicateGroups).toHaveLength(0);
  });

  it('does not group identical titles from the same agentId even across different sets', () => {
    // Same agentId appears in two AgentFindingSet objects — should still not group.
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'Hardcoded credentials in source code', severity: 'high' },
    ]);
    const setADuplicate = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'Hardcoded credentials in source code', severity: 'high' },
    ]);
    const result = deduplicateFindings([setA, setADuplicate]);
    expect(result.duplicateGroups).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // Per-category thresholds
  // ------------------------------------------------------------------

  describe('Security & Privacy threshold (0.55)', () => {
    it('does NOT group two security titles with moderate Jaccard overlap below 0.55', () => {
      // "XSS via innerHTML" vs "XSS via eval" — share only "xss" token after filtering;
      // Jaccard well below 0.55 and neither is a subset of the other.
      const setA = makeSet('agent-a', 'Agent A', 'Security & Privacy', [
        { title: 'XSS vulnerability via innerHTML rendering', severity: 'high' },
      ]);
      const setB = makeSet('agent-b', 'Agent B', 'Security & Privacy', [
        { title: 'XSS attack vector eval execution', severity: 'high' },
      ]);
      const result = deduplicateFindings([setA, setB]);
      expect(result.duplicateGroups).toHaveLength(0);
    });

    it('DOES group two security titles with high Jaccard similarity above 0.55', () => {
      // Very similar phrasing — most tokens overlap.
      const setA = makeSet('agent-a', 'Agent A', 'Security & Privacy', [
        { title: 'SQL injection vulnerability database query', severity: 'critical' },
      ]);
      const setB = makeSet('agent-b', 'Agent B', 'Security & Privacy', [
        { title: 'SQL injection vulnerability database query builder', severity: 'high' },
      ]);
      const result = deduplicateFindings([setA, setB]);
      expect(result.duplicateGroups).toHaveLength(1);
    });
  });

  describe('Design / SEO / Marketing / DX threshold (0.30)', () => {
    it('groups a Design pair with moderate overlap that would fail the default 0.40 threshold', () => {
      // Titles share {images, alt, text} = 3 tokens; union = 9; Jaccard = 3/9 ≈ 0.333.
      // 0.333 ≥ 0.30 (Design threshold) but < 0.40 (default threshold).
      const setA = makeSet('agent-a', 'Agent A', 'Design', [
        { title: 'images missing alt text page content', severity: 'medium' },
      ]);
      const setB = makeSet('agent-b', 'Agent B', 'Design', [
        { title: 'images lacking alt text html elements', severity: 'low' },
      ]);
      const result = deduplicateFindings([setA, setB]);
      expect(result.duplicateGroups).toHaveLength(1);
    });

    it('does NOT group the same 0.333-Jaccard pair when the category is Code Quality (default 0.40 threshold)', () => {
      const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
        { title: 'images missing alt text page content', severity: 'medium' },
      ]);
      const setB = makeSet('agent-b', 'Agent B', 'Code Quality', [
        { title: 'images lacking alt text html elements', severity: 'low' },
      ]);
      const result = deduplicateFindings([setA, setB]);
      expect(result.duplicateGroups).toHaveLength(0);
    });

    it('groups an SEO pair under the permissive 0.30 threshold', () => {
      const setA = makeSet('agent-a', 'Agent A', 'SEO', [
        { title: 'Missing meta description tag', severity: 'low' },
      ]);
      const setB = makeSet('agent-b', 'Agent B', 'SEO', [
        { title: 'Meta description absent pages', severity: 'low' },
      ]);
      const result = deduplicateFindings([setA, setB]);
      expect(result.duplicateGroups).toHaveLength(1);
    });

    it('groups a Marketing pair under the permissive 0.30 threshold', () => {
      // Shares {button, contrast} = 2 tokens; union = 6; Jaccard = 2/6 ≈ 0.333 ≥ 0.30.
      const setA = makeSet('agent-a', 'Agent A', 'Marketing', [
        { title: 'button contrast ratio accessibility', severity: 'medium' },
      ]);
      const setB = makeSet('agent-b', 'Agent B', 'Marketing', [
        { title: 'button contrast level compliance', severity: 'medium' },
      ]);
      const result = deduplicateFindings([setA, setB]);
      expect(result.duplicateGroups).toHaveLength(1);
    });

    it('groups a Developer Experience pair under the permissive 0.30 threshold', () => {
      const setA = makeSet('agent-a', 'Agent A', 'Developer Experience', [
        { title: 'Missing TypeScript strict configuration', severity: 'low' },
      ]);
      const setB = makeSet('agent-b', 'Agent B', 'Developer Experience', [
        { title: 'TypeScript strict mode disabled', severity: 'low' },
      ]);
      const result = deduplicateFindings([setA, setB]);
      expect(result.duplicateGroups).toHaveLength(1);
    });

    it('uses the default 0.40 threshold for cross-category pairs not involving security or permissive categories', () => {
      // Two Code Quality findings with just enough overlap to meet 0.40 but NOT 0.55.
      const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
        { title: 'Unhandled promise rejection', severity: 'high' },
      ]);
      const setB = makeSet('agent-b', 'Agent B', 'Performance', [
        { title: 'Unhandled promise rejection causes memory leak', severity: 'medium' },
      ]);
      // "unhandled" "promise" "rejection" are shared tokens; should group at 0.40.
      const result = deduplicateFindings([setA, setB]);
      expect(result.duplicateGroups).toHaveLength(1);
    });
  });

  // ------------------------------------------------------------------
  // Suggestion exclusion
  // ------------------------------------------------------------------

  it('excludes findings with classification "suggestion" from deduplication entirely', () => {
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'Consider adding input validation', severity: 'low', classification: 'suggestion' },
      { title: 'Missing error handling in API route', severity: 'high', classification: 'deficiency' },
    ]);
    const setB = makeSet('agent-b', 'Agent B', 'Code Quality', [
      { title: 'Consider adding input validation everywhere', severity: 'low', classification: 'suggestion' },
      { title: 'Unhandled errors in API routes', severity: 'medium', classification: 'deficiency' },
    ]);
    const result = deduplicateFindings([setA, setB]);
    // Only the two non-suggestion findings count toward totals.
    expect(result.totalFindings).toBe(2);
    // Suggestions must not appear inside any group.
    const allGroupTitles = result.duplicateGroups.flatMap((g) =>
      g.entries.map((e) => e.finding.classification),
    );
    expect(allGroupTitles).not.toContain('suggestion');
  });

  it('returns totalFindings of 0 and no groups when all findings are suggestions', () => {
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'Consider adding caching layer', severity: 'low', classification: 'suggestion' },
    ]);
    const setB = makeSet('agent-b', 'Agent B', 'Code Quality', [
      { title: 'Consider adding caching layer here', severity: 'low', classification: 'suggestion' },
    ]);
    const result = deduplicateFindings([setA, setB]);
    expect(result).toEqual({ totalFindings: 0, uniqueCount: 0, duplicateGroups: [] });
  });

  // ------------------------------------------------------------------
  // Severity ranking within groups
  // ------------------------------------------------------------------

  it('entries within a group are sorted by severity descending (critical first)', () => {
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'SQL injection via string concatenation', severity: 'low' },
    ]);
    const setB = makeSet('agent-b', 'Agent B', 'Code Quality', [
      { title: 'SQL injection through string concatenation', severity: 'critical' },
    ]);
    const setC = makeSet('agent-c', 'Agent C', 'Code Quality', [
      { title: 'SQL injection concatenation query', severity: 'high' },
    ]);
    const result = deduplicateFindings([setA, setB, setC]);
    expect(result.duplicateGroups).toHaveLength(1);
    const severities = result.duplicateGroups[0].entries.map((e) => e.finding.severity);
    expect(severities[0]).toBe('critical');
    expect(severities[severities.length - 1]).toBe('low');
  });

  // ------------------------------------------------------------------
  // totalFindings vs uniqueCount
  // ------------------------------------------------------------------

  it('three agents reporting the same issue → 1 group, uniqueCount=1, totalFindings=3', () => {
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'SQL injection via string concatenation', severity: 'high' },
    ]);
    const setB = makeSet('agent-b', 'Agent B', 'Code Quality', [
      { title: 'SQL injection through string concatenation', severity: 'critical' },
    ]);
    const setC = makeSet('agent-c', 'Agent C', 'Code Quality', [
      { title: 'SQL injection concatenation query', severity: 'medium' },
    ]);
    const result = deduplicateFindings([setA, setB, setC]);
    expect(result.totalFindings).toBe(3);
    expect(result.uniqueCount).toBe(1);
    expect(result.duplicateGroups).toHaveLength(1);
  });

  it('mix of duplicate groups and singletons counts uniqueCount correctly', () => {
    // 2 findings that group → 1 unique; 1 unrelated singleton → 1 unique; total unique = 2
    const setA = makeSet('agent-a', 'Agent A', 'Code Quality', [
      { title: 'SQL injection via string concatenation', severity: 'high' },
      { title: 'Completely unrelated accessibility finding', severity: 'low' },
    ]);
    const setB = makeSet('agent-b', 'Agent B', 'Code Quality', [
      { title: 'SQL injection through string concatenation', severity: 'medium' },
    ]);
    const result = deduplicateFindings([setA, setB]);
    expect(result.totalFindings).toBe(3);
    expect(result.uniqueCount).toBe(2);
    expect(result.duplicateGroups).toHaveLength(1);
  });
});
