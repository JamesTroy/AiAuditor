// Plain-English executive summary of an audit, written for non-engineer
// stakeholders (PMs, security leads, execs).
//
// Differs from the agent walkthroughs in three ways:
//   - 5 bullets max, prose not lists-of-findings.
//   - No code snippets, no severity tags, no CWE numbers.
//   - Frames risks in business terms: "user data could leak", "shipping
//     could be delayed by N findings", not "SQL injection on line 42".
//
// One single Anthropic call. Cheap (sonnet, ~500 input tokens, ~400 output).

import Anthropic from '@anthropic-ai/sdk';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 700;
const TIMEOUT_MS = 30_000;

const SYSTEM = `You are summarising a code audit for a non-engineer stakeholder
(product manager, security lead, executive). Write a tight, prose summary in
plain English. NO code snippets, NO severity tags, NO CWE numbers, NO finding
IDs. Frame risks in business terms — what could happen, who is affected,
how urgent. Output exactly this JSON shape and nothing else:

{
  "headline": "<one sentence overall assessment>",
  "topRisks": [
    "<bullet 1, business-framed>",
    "<bullet 2>",
    "<bullet 3 (max 5 bullets total)>"
  ],
  "recommendedAction": "<one sentence: what should happen next, by whom>"
}

Rules:
- "headline" must answer: is this code ready to ship?
- Each bullet in "topRisks" should be ONE sentence, present tense, no jargon.
- "recommendedAction" should suggest a concrete next step (e.g., "Block the
  release until the two critical findings on auth are fixed", "Schedule a
  one-hour review with the backend lead before next sprint").
- If there are zero critical or high findings, "topRisks" can be empty and
  "headline" should say so directly.`;

export interface ExecutiveSummary {
  headline: string;
  topRisks: string[];
  recommendedAction: string;
}

export interface ExecutiveSummaryInput {
  findings: StructuredFinding[];
  score: number;
  agentNames?: string[];
  signal?: AbortSignal;
}

function compactFindings(findings: StructuredFinding[]): string {
  // Pass only the fields the model needs — keeps the prompt tight and prevents
  // any chance of code-snippet content leaking into the prose summary.
  // Order by severity descending so the model focuses on critical/high.
  const RANK: Record<StructuredFinding['severity'], number> = {
    critical: 0, high: 1, medium: 2, low: 3, informational: 4,
  };
  const sorted = [...findings].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return sorted
    .slice(0, 30)
    .map((f, i) => {
      const where = f.location ? ` (${f.location})` : '';
      return `${i + 1}. [${f.severity}] [${f.classification}] ${f.title}${where}`;
    })
    .join('\n');
}

export async function generateExecutiveSummary(
  input: ExecutiveSummaryInput,
): Promise<ExecutiveSummary> {
  // Short-circuit: zero findings → deterministic output, no model call.
  if (input.findings.length === 0) {
    return {
      headline: `Score ${input.score}/100. No findings of concern were raised.`,
      topRisks: [],
      recommendedAction: 'No action required from this audit. Continue normal review.',
    };
  }

  const userMessage =
    `Score: ${input.score}/100\n` +
    `Agents that ran: ${(input.agentNames ?? []).join(', ') || 'unspecified'}\n` +
    `Findings:\n${compactFindings(input.findings)}`;

  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    },
    { signal: input.signal ?? AbortSignal.timeout(TIMEOUT_MS) },
  );

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '');

  try {
    const parsed = JSON.parse(cleaned) as Partial<ExecutiveSummary>;
    return {
      headline:
        typeof parsed.headline === 'string'
          ? parsed.headline.slice(0, 500)
          : 'Audit completed.',
      topRisks: Array.isArray(parsed.topRisks)
        ? parsed.topRisks.filter((r): r is string => typeof r === 'string').slice(0, 5)
        : [],
      recommendedAction:
        typeof parsed.recommendedAction === 'string'
          ? parsed.recommendedAction.slice(0, 500)
          : '',
    };
  } catch {
    // Model returned non-JSON — degrade to a flat headline with the raw text.
    return {
      headline: text.slice(0, 300),
      topRisks: [],
      recommendedAction: '',
    };
  }
}
