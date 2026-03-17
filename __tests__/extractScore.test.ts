import { describe, it, expect } from 'vitest';
import { extractScore, sanityCheckScore } from '@/lib/extractScore';

describe('extractScore', () => {
  it('extracts score from table row with /100', () => {
    expect(extractScore('| **Overall** | 72/100 |')).toBe(72);
  });

  it('extracts score from 1-10 scale and normalizes', () => {
    expect(extractScore('| **Composite** | 7.5/10 |')).toBe(75);
  });

  it('extracts score from heading format', () => {
    expect(extractScore('## Overall Score: 85/100')).toBe(85);
  });

  it('extracts score from bold format', () => {
    expect(extractScore('**Overall Score: 60/100**')).toBe(60);
  });

  it('returns null for no score found', () => {
    expect(extractScore('No score here')).toBeNull();
  });

  it('uses last N/100 match (score appears at end)', () => {
    const text = '45/100 for security\n72/100 for code quality\n65/100';
    expect(extractScore(text)).toBe(65);
  });
});

describe('sanityCheckScore', () => {
  it('caps score when many critical findings exist', () => {
    const markdown = `
- **[CRITICAL]** — Issue 1
- **[CRITICAL]** — Issue 2
- **[CRITICAL]** — Issue 3
## Overall Score: 85/100`;

    // 3+ criticals but score is 85 → should be capped to 60
    expect(sanityCheckScore(85, markdown)).toBe(60);
  });

  it('caps score for mixed critical + high findings', () => {
    const markdown = `
- **[CRITICAL]** — Issue 1
- **[HIGH]** — Issue 2
- **[HIGH]** — Issue 3
- **[HIGH]** — Issue 4
## Overall Score: 80/100`;

    // 1 critical + 3 high but score is 80 → should be capped to 70
    expect(sanityCheckScore(80, markdown)).toBe(70);
  });

  it('floors score when only low/informational findings', () => {
    const markdown = `
- **[LOW]** — Minor style issue
- **[INFORMATIONAL]** — Documentation note
## Overall Score: 30/100`;

    // Only low/info findings but score is 30 → should be floored to 60
    expect(sanityCheckScore(30, markdown)).toBe(60);
  });

  it('leaves reasonable score unchanged', () => {
    const markdown = `
- **[HIGH]** — One significant issue
- **[MEDIUM]** — Moderate concern
## Overall Score: 65/100`;

    expect(sanityCheckScore(65, markdown)).toBe(65);
  });

  it('returns null for null input', () => {
    expect(sanityCheckScore(null, 'anything')).toBeNull();
  });

  it('does not modify score when no findings exist', () => {
    expect(sanityCheckScore(90, 'No findings. Clean code.')).toBe(90);
  });
});
