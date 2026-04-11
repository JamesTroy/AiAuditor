import { describe, it, expect } from 'vitest';
import { validateFindings, validationStats } from '@/lib/validateFindings';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

function makeFinding(overrides: Partial<StructuredFinding> = {}): StructuredFinding {
  return {
    id: 'VULN-001',
    severity: 'high',
    confidence: 'certain',
    classification: 'vulnerability',
    title: 'SQL injection via string concatenation',
    remediation: 'Use parameterized queries',
    ...overrides,
  };
}

const SOURCE_CODE = `
import express from 'express';
const app = express();

app.get('/users', async (req, res) => {
  const id = req.query.id;
  const query = "SELECT * FROM users WHERE id = '" + id + "'";
  const result = await db.query(query);
  res.json(result);
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.findUser(username);
  if (user && user.password === password) {
    res.json({ token: generateToken(user) });
  }
});
`;

describe('validateFindings', () => {
  // ------------------------------------------------------------------
  // Snippet validation — exact match
  // ------------------------------------------------------------------

  it('accepts a finding whose code_snippet exists verbatim in the source', () => {
    const finding = makeFinding({
      code_snippet: `const query = "SELECT * FROM users WHERE id = '" + id + "'"`,
    });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].validated).toBe(true);
  });

  it('drops a finding whose code_snippet does not exist in the source', () => {
    const finding = makeFinding({
      code_snippet: 'db.execute("DELETE FROM users WHERE admin = true")',
    });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(0);
  });

  it('accepts a finding with whitespace-normalized snippet match', () => {
    // The source has specific indentation; the snippet has collapsed whitespace
    const finding = makeFinding({
      code_snippet: "const id = req.query.id;\n  const query = \"SELECT * FROM users WHERE id = '\" + id + \"'\";",
    });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].validated).toBe(true);
  });

  it('accepts a finding whose individual lines all appear in source (≥80% match)', () => {
    const finding = makeFinding({
      code_snippet: [
        'const id = req.query.id;',
        "const query = \"SELECT * FROM users WHERE id = '\" + id + \"'\";",
        'const result = await db.query(query);',
      ].join('\n'),
    });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].validated).toBe(true);
  });

  it('drops a finding where fewer than 80% of lines match', () => {
    const finding = makeFinding({
      code_snippet: [
        'const id = req.query.id;', // matches
        'const foo = bar.baz();', // does NOT match
        'const qux = quux.corge();', // does NOT match
        'something_else_entirely();', // does NOT match
        'yet_another_fake_line();', // does NOT match
      ].join('\n'),
    });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // No code_snippet — accepted but unvalidated
  // ------------------------------------------------------------------

  it('accepts a finding without code_snippet but marks it unvalidated', () => {
    const finding = makeFinding({ code_snippet: undefined });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].validated).toBe(false);
    expect(result[0].validation_note).toContain('No code_snippet');
  });

  it('accepts a finding with empty code_snippet as unvalidated', () => {
    const finding = makeFinding({ code_snippet: '   ' });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].validated).toBe(false);
  });

  // ------------------------------------------------------------------
  // Enum validation
  // ------------------------------------------------------------------

  it('drops findings with invalid severity', () => {
    const finding = makeFinding({ severity: 'extreme' as StructuredFinding['severity'] });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(0);
  });

  it('drops findings with invalid confidence', () => {
    const finding = makeFinding({ confidence: 'maybe' as StructuredFinding['confidence'] });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(0);
  });

  it('drops findings with invalid classification', () => {
    const finding = makeFinding({ classification: 'opinion' as StructuredFinding['classification'] });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // Required field validation
  // ------------------------------------------------------------------

  it('drops findings with empty id', () => {
    const finding = makeFinding({ id: '' });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(0);
  });

  it('drops findings with empty title', () => {
    const finding = makeFinding({ title: '' });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(0);
  });

  it('drops findings with empty remediation', () => {
    const finding = makeFinding({ remediation: '' });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // [LIKELY] assumption requirement
  // ------------------------------------------------------------------

  it('demotes [LIKELY] findings without assumption to [POSSIBLE]', () => {
    const finding = makeFinding({
      confidence: 'likely',
      assumption: undefined,
    });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe('possible');
  });

  it('keeps [LIKELY] findings with assumption intact', () => {
    const finding = makeFinding({
      confidence: 'likely',
      assumption: 'No rate limiting middleware wraps this route',
    });
    const result = validateFindings([finding], SOURCE_CODE);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe('likely');
  });

  // ------------------------------------------------------------------
  // Multiple findings — mixed validation
  // ------------------------------------------------------------------

  it('processes multiple findings independently: keeps valid, drops invalid', () => {
    const findings: StructuredFinding[] = [
      makeFinding({
        id: 'VULN-001',
        code_snippet: 'const id = req.query.id;',
      }),
      makeFinding({
        id: 'VULN-002',
        code_snippet: 'THIS CODE DOES NOT EXIST IN SOURCE',
      }),
      makeFinding({
        id: 'VULN-003',
        code_snippet: undefined,
      }),
    ];
    const result = validateFindings(findings, SOURCE_CODE);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('VULN-001');
    expect(result[0].validated).toBe(true);
    expect(result[1].id).toBe('VULN-003');
    expect(result[1].validated).toBe(false);
  });
});

describe('validationStats', () => {
  it('returns correct stats for mixed validation results', () => {
    const original: StructuredFinding[] = [
      makeFinding({ id: 'A', code_snippet: 'const id = req.query.id;' }),
      makeFinding({ id: 'B', code_snippet: 'HALLUCINATED CODE' }),
      makeFinding({ id: 'C', code_snippet: undefined }),
    ];
    const validated = validateFindings(original, SOURCE_CODE);
    const stats = validationStats(original, validated);
    expect(stats).toEqual({
      total: 3,
      accepted: 1,   // snippet matched
      dropped: 1,     // hallucinated snippet
      unvalidated: 1, // no snippet
    });
  });

  it('returns all zeros for empty input', () => {
    const stats = validationStats([], []);
    expect(stats).toEqual({ total: 0, accepted: 0, dropped: 0, unvalidated: 0 });
  });
});
