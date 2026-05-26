// FP-CRITIC-001: Adversarial review pass for [CERTAIN] findings.
//
// validateFindings.ts catches hallucinated quotes (snippet not in source).
// What it CAN'T catch is "snippet is real but the interpretation is wrong" —
// the dominant remaining FP class. This module runs a second LLM call after
// the main audit completes, presents each [CERTAIN] finding with the source
// code, and asks the critic to construct the strongest argument that the
// finding is a false positive. If the argument is convincing, the finding
// is demoted to [LIKELY], [POSSIBLE], or dropped entirely.
//
// Fail-open guarantee: any error in this module — timeout, network failure,
// malformed response, missing API key — MUST result in the original findings
// being returned unchanged. The critic can only IMPROVE the result, never
// break it.
//
// Cost: ~30% extra tokens per audit on average, but only when [CERTAIN]
// findings exist. Audits with zero [CERTAIN] findings skip the call entirely.

import Anthropic from '@anthropic-ai/sdk';
import { anthropicCircuitBreaker } from './circuitBreaker';
import { ANTHROPIC_MODEL } from '@/lib/config/constants';
import type { ValidatedFinding } from '@/lib/validateFindings';

// Max wall-clock time for the critic call. The main audit can take 30-90s;
// the critic should NEVER add more than this much latency. If it hits the
// timeout, we fail-open and use the original findings.
const CRITIC_TIMEOUT_MS = 45_000;

// Max source code we send to the critic. Beyond this we truncate — the critic
// is reasoning about specific findings, not the whole codebase.
const CRITIC_MAX_SOURCE_CHARS = 200_000;

// Max tokens for the critic's structured output. Verdicts are short, so this
// is generous; primarily a cost ceiling if Claude tries to over-explain.
const CRITIC_MAX_OUTPUT_TOKENS = 4000;

type Verdict = 'keep' | 'demote_likely' | 'demote_possible' | 'drop';

interface CriticVerdict {
  finding_id: string;
  verdict: Verdict;
  reasoning: string;
}

export interface CritiqueResult {
  /** Findings after applying critic verdicts. Same shape as input. */
  findings: ValidatedFinding[];
  /** Stats for logging. */
  stats: {
    critiqued: number;
    kept: number;
    demotedLikely: number;
    demotedPossible: number;
    dropped: number;
    skipped: boolean;
    failedOpen: boolean;
    error?: string;
  };
}

const CRITIQUE_TOOL: Anthropic.Messages.Tool = {
  name: 'report_critique_verdicts',
  description:
    'Report verdicts for every [CERTAIN] finding. For each finding ID, output ' +
    'a verdict: keep / demote_likely / demote_possible / drop. Apply the ' +
    'verdict only when your skeptical re-read produced a convincing argument.',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdicts: {
        type: 'array',
        description: 'One entry per finding in the input. Do not skip any.',
        items: {
          type: 'object',
          properties: {
            finding_id: { type: 'string', description: 'Must match an input finding id exactly.' },
            verdict: {
              type: 'string',
              enum: ['keep', 'demote_likely', 'demote_possible', 'drop'],
            },
            reasoning: {
              type: 'string',
              description:
                'One-sentence reason for the verdict. For demotions/drops, name ' +
                'the specific assumption, framework default, or alternate ' +
                'interpretation that weakens the finding.',
            },
          },
          required: ['finding_id', 'verdict', 'reasoning'],
        },
      },
    },
    required: ['verdicts'],
  },
};

const CRITIC_SYSTEM_PROMPT = `You are a skeptical senior auditor reviewing findings from another auditor's report. Your one job is to identify FALSE POSITIVES — findings tagged [CERTAIN] that, on careful re-reading of the source, are actually wrong.

For each finding, perform an adversarial re-read:
  1. Locate the code referenced by the finding.
  2. Read the SURROUNDING code and any imports — does the broader context change the interpretation?
  3. Construct the strongest argument that this finding is a FALSE POSITIVE:
     - Is the code actually safe because of a framework default the auditor missed?
     - Is the code protected by a wrapper, middleware, or caller-side validation visible elsewhere in the submission?
     - Is the auditor's interpretation of the code's behaviour incorrect?
     - Is there a runtime guard (env check, feature flag, assertion) that prevents the harm?
  4. Decide:
     - keep: the finding survives skeptical review — there is no convincing FP argument.
     - demote_likely: the finding is real but depends on an assumption you can state. Use this when the assumption is reasonable but not provable from the submission.
     - demote_possible: the finding is plausible but the FP argument is also plausible. Use this when you can't decide which is more likely.
     - drop: the finding is clearly wrong — you can name a specific reason it does not apply.

CALIBRATION:
  - Default to keep. Demote only when you can articulate a SPECIFIC reason in the reasoning field.
  - "I'm not sure" is not a valid reason to demote — it's a valid reason to keep.
  - Generic skepticism is not a valid reason to demote.
  - A finding without code_snippet has already been validated as architectural — apply the same standards, but be aware the validation is weaker.

OUTPUT:
  Call the report_critique_verdicts tool exactly once with one verdict per input finding. Do not write any other text.`;

function buildUserMessage(sourceCode: string, findings: ValidatedFinding[]): string {
  const truncatedSource =
    sourceCode.length > CRITIC_MAX_SOURCE_CHARS
      ? sourceCode.slice(0, CRITIC_MAX_SOURCE_CHARS) +
        `\n\n[... source truncated at ${CRITIC_MAX_SOURCE_CHARS} chars for critic review ...]`
      : sourceCode;

  const findingsBlock = findings
    .map((f) => {
      const parts = [
        `id: ${f.id}`,
        `severity: ${f.severity}`,
        `classification: ${f.classification}`,
        `title: ${f.title}`,
        f.location ? `location: ${f.location}` : null,
        f.code_snippet ? `code_snippet:\n${f.code_snippet}` : '(no code_snippet — architectural finding)',
        f.cwe ? `cwe: ${f.cwe}` : null,
        f.exploit_scenario ? `exploit_scenario: ${f.exploit_scenario}` : null,
        f.dataflow_path?.length ? `dataflow: ${f.dataflow_path.join(' -> ')}` : null,
        `remediation: ${f.remediation}`,
      ].filter(Boolean);
      return parts.join('\n');
    })
    .join('\n\n---\n\n');

  return (
    `<source_code>\n${truncatedSource}\n</source_code>\n\n` +
    `<findings>\n${findingsBlock}\n</findings>\n\n` +
    `Output one verdict per finding via the report_critique_verdicts tool.`
  );
}

function applyVerdict(finding: ValidatedFinding, verdict: Verdict): ValidatedFinding | null {
  switch (verdict) {
    case 'keep':
      return finding;
    case 'demote_likely':
      return { ...finding, confidence: 'likely' as const };
    case 'demote_possible':
      return { ...finding, confidence: 'possible' as const };
    case 'drop':
      return null;
  }
}

/**
 * Run the adversarial critic over a list of validated findings.
 * Only [CERTAIN] findings are critiqued; [LIKELY] and [POSSIBLE] pass through
 * unchanged (they are already low-confidence by definition).
 *
 * @param sourceCode - The original submitted code (before XML escaping).
 * @param findings - Validated findings from validateFindings().
 * @param options.signal - Optional AbortSignal to cancel the critic call.
 * @returns Critiqued findings + stats. Fails open: errors return originals.
 */
export async function critiqueFindings(
  sourceCode: string,
  findings: ValidatedFinding[],
  options?: { signal?: AbortSignal },
): Promise<CritiqueResult> {
  const stats: CritiqueResult['stats'] = {
    critiqued: 0,
    kept: 0,
    demotedLikely: 0,
    demotedPossible: 0,
    dropped: 0,
    skipped: false,
    failedOpen: false,
  };

  const certain = findings.filter((f) => f.confidence === 'certain');
  if (certain.length === 0) {
    stats.skipped = true;
    return { findings, stats };
  }

  // Circuit breaker — if Anthropic has been failing, skip rather than block.
  if (!(await anthropicCircuitBreaker.allowRequest())) {
    stats.failedOpen = true;
    stats.error = 'circuit_open';
    return { findings, stats };
  }

  stats.critiqued = certain.length;

  // Build a Set of [CERTAIN] IDs we expect verdicts for — used to ignore
  // verdicts for findings that don't exist (model hallucination of IDs).
  const certainIdSet = new Set(certain.map((f) => f.id));

  try {
    const client = new Anthropic();

    // AbortSignal that cancels on either the caller's signal OR our timeout.
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), CRITIC_TIMEOUT_MS);
    const combinedSignal = options?.signal
      ? AbortSignal.any([options.signal, timeoutController.signal])
      : timeoutController.signal;

    let response: Anthropic.Messages.Message;
    try {
      response = await client.messages.create(
        {
          model: ANTHROPIC_MODEL,
          max_tokens: CRITIC_MAX_OUTPUT_TOKENS,
          system: CRITIC_SYSTEM_PROMPT,
          tools: [CRITIQUE_TOOL],
          tool_choice: { type: 'tool', name: 'report_critique_verdicts' },
          messages: [{ role: 'user', content: buildUserMessage(sourceCode, certain) }],
        },
        { signal: combinedSignal },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    await anthropicCircuitBreaker.onSuccess();

    // Extract the tool_use block.
    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUse) {
      stats.failedOpen = true;
      stats.error = 'no_tool_use_block';
      return { findings, stats };
    }

    const input = toolUse.input as { verdicts?: CriticVerdict[] };
    if (!input.verdicts || !Array.isArray(input.verdicts)) {
      stats.failedOpen = true;
      stats.error = 'malformed_verdicts';
      return { findings, stats };
    }

    // Build a map of finding_id -> verdict, ignoring entries for unknown IDs
    // and entries with invalid verdict values.
    const validVerdicts = new Set<Verdict>(['keep', 'demote_likely', 'demote_possible', 'drop']);
    const verdictMap = new Map<string, Verdict>();
    for (const v of input.verdicts) {
      if (!v.finding_id || !validVerdicts.has(v.verdict)) continue;
      if (!certainIdSet.has(v.finding_id)) continue;
      verdictMap.set(v.finding_id, v.verdict);
    }

    // Apply verdicts. Any [CERTAIN] finding without a verdict is kept as-is.
    const result: ValidatedFinding[] = [];
    for (const f of findings) {
      if (f.confidence !== 'certain') {
        result.push(f);
        continue;
      }
      const verdict = verdictMap.get(f.id) ?? 'keep';
      const applied = applyVerdict(f, verdict);
      if (applied === null) {
        stats.dropped++;
      } else {
        if (verdict === 'keep') stats.kept++;
        else if (verdict === 'demote_likely') stats.demotedLikely++;
        else if (verdict === 'demote_possible') stats.demotedPossible++;
        result.push(applied);
      }
    }

    return { findings: result, stats };
  } catch (err) {
    await anthropicCircuitBreaker.onFailure();
    stats.failedOpen = true;
    stats.error = err instanceof Error ? err.message : String(err);
    return { findings, stats };
  }
}
