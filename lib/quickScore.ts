// Lightweight single-call audit used by the pre-deploy webhook and cron runner.
// Runs one focused Claude pass instead of the full multi-agent pipeline.
// Suitable for CI gates and scheduled checks; not a replacement for the full audit.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SCORING_SYSTEM = `You are a senior security engineer performing a rapid code quality gate check.
Analyze the submitted code and return ONLY valid JSON — no markdown, no prose.

Scoring rules:
- Start at 100
- Critical security vulnerability (CVSS 7+, exploitable): -15 each
- High severity deficiency (data loss, auth bypass, injection): -8 each
- Medium severity deficiency (missing validation, unsafe default): -4 each
- Low severity issue (minor risk, best-practice gap): -1 each
- Floor: 5

Return exactly this JSON shape:
{
  "score": <integer 0-100>,
  "critical": [<one-line issue description>, ...],
  "high": [<one-line issue description>, ...],
  "medium": [<one-line issue description>, ...],
  "summary": "<2-sentence overall assessment>"
}`;

export interface QuickScoreResult {
  score: number;
  critical: string[];
  high: string[];
  medium: string[];
  summary: string;
}

export async function quickScore(code: string): Promise<QuickScoreResult> {
  const truncated = code.length > 60_000 ? code.slice(0, 60_000) + '\n\n[...truncated]' : code;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    temperature: 0,
    system: SCORING_SYSTEM,
    messages: [{ role: 'user', content: `Analyze this code:\n\n${truncated}` }],
  });

  const text = msg.content.find((b) => b.type === 'text')?.text ?? '{}';

  try {
    const json = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
    return {
      score: Math.max(0, Math.min(100, Number(json.score) || 50)),
      critical: Array.isArray(json.critical) ? json.critical.slice(0, 10) : [],
      high: Array.isArray(json.high) ? json.high.slice(0, 10) : [],
      medium: Array.isArray(json.medium) ? json.medium.slice(0, 10) : [],
      summary: typeof json.summary === 'string' ? json.summary : '',
    };
  } catch {
    return { score: 50, critical: [], high: [], medium: [], summary: 'Score parsing failed.' };
  }
}
