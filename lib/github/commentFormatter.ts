// Markdown templates for the GitHub PR review:
//   - walkthrough comment (the review body — one per review)
//   - inline finding comments (one per [CERTAIN]/[LIKELY] finding with a
//     locatable line)
//   - check-run output (PASS/FAIL banner in the PR's Checks tab)

import type { StructuredFinding } from '@/lib/ai/findingSchema';
import type { ReviewComment } from '@/lib/github/api';
import type { LocatedSnippet } from '@/lib/github/snippetLocator';

const SEVERITY_BADGE: Record<StructuredFinding['severity'], string> = {
  critical:      '🔴 **Critical**',
  high:          '🟠 **High**',
  medium:        '🟡 **Medium**',
  low:           '🔵 **Low**',
  informational: '⚪ Info',
};

const CONFIDENCE_BADGE: Record<StructuredFinding['confidence'], string> = {
  certain:  '✓ Certain',
  likely:   '~ Likely',
  possible: '? Possible',
};

const CLASSIFICATION_BADGE: Record<StructuredFinding['classification'], string> = {
  vulnerability: 'Vulnerability',
  deficiency:    'Deficiency',
  suggestion:    'Suggestion',
};

const SEVERITY_RANK: Record<StructuredFinding['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

/**
 * Counts by severity. Used in walkthrough header + check-run summary.
 */
export function summariseFindings(findings: StructuredFinding[]) {
  const c = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  for (const f of findings) c[f.severity]++;
  return {
    ...c,
    total: findings.length,
    blockerCount: c.critical + c.high,
  };
}

/**
 * Render an inline review comment body for a single finding. Kept compact —
 * GitHub will collapse anything too long, and noise in inline comments is
 * what kills bot-review adoption.
 */
export function formatInlineComment(
  finding: StructuredFinding,
  located: LocatedSnippet,
): ReviewComment {
  const parts: string[] = [];
  parts.push(`**${finding.title}**`);
  parts.push(
    `${SEVERITY_BADGE[finding.severity]} · ${CONFIDENCE_BADGE[finding.confidence]} · ${CLASSIFICATION_BADGE[finding.classification]}`,
  );
  if (finding.cwe) parts.push(`CWE: ${finding.cwe}`);
  if (finding.exploit_scenario) parts.push(`\n_Exploit:_ ${finding.exploit_scenario}`);
  if (finding.remediation) parts.push(`\n**Fix:** ${finding.remediation}`);
  if (finding.assumption) parts.push(`\n_Assumption:_ ${finding.assumption}`);
  parts.push('\n<sub>— Claudit</sub>');
  return {
    path: located.path,
    line: located.line,
    side: 'RIGHT',
    body: parts.join('\n'),
  };
}

/**
 * Render the walkthrough comment — the top-level review body summarising the
 * audit. Always rendered (even when zero findings) so PR authors get a clear
 * "we ran, nothing flagged" signal instead of silence.
 */
export function formatWalkthrough(opts: {
  score: number;
  threshold: number;
  passed: boolean;
  findings: StructuredFinding[];
  /** Findings shown inline (located). The walkthrough lists the rest. */
  inlineFindingIds: Set<string>;
  agentIds: string[];
  durationMs: number;
}): string {
  const s = summariseFindings(opts.findings);
  const sevSummary = (['critical', 'high', 'medium', 'low'] as const)
    .filter((k) => s[k] > 0)
    .map((k) => `${s[k]} ${k}`)
    .join(' · ') || 'no issues';

  const lines: string[] = [];
  lines.push(`## Claudit review — score ${opts.score}/100  ${opts.passed ? '✅' : '❌'}`);
  lines.push('');
  lines.push(
    `${opts.findings.length === 0 ? 'No findings.' : sevSummary}` +
      ` · threshold ${opts.threshold}` +
      ` · ${opts.agentIds.length} agent${opts.agentIds.length === 1 ? '' : 's'}` +
      ` · ${(opts.durationMs / 1000).toFixed(1)}s`,
  );
  lines.push('');

  if (opts.findings.length === 0) {
    lines.push('Nothing flagged on this change. ✓');
    lines.push('');
    lines.push(`<sub>Agents run: ${opts.agentIds.join(', ')}</sub>`);
    return lines.join('\n');
  }

  // Highest-priority bucket up top — what the PR author should look at first.
  const blockers = opts.findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );
  if (blockers.length > 0) {
    lines.push('### Top risks');
    for (const f of blockers.slice(0, 5)) {
      const where = f.location ? ` _(${f.location})_` : '';
      lines.push(`- ${SEVERITY_BADGE[f.severity]} **${f.title}**${where}`);
    }
    lines.push('');
  }

  // Anything not shown inline gets listed here so it's not silently lost.
  const orphaned = opts.findings
    .filter((f) => !opts.inlineFindingIds.has(f.id))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  if (orphaned.length > 0) {
    lines.push('<details><summary>Other findings (not anchored to a specific line)</summary>');
    lines.push('');
    for (const f of orphaned) {
      const where = f.location ? ` _(${f.location})_` : '';
      lines.push(
        `- ${SEVERITY_BADGE[f.severity]} · ${CONFIDENCE_BADGE[f.confidence]} · ${f.title}${where}`,
      );
      if (f.remediation) lines.push(`  - **Fix:** ${f.remediation}`);
    }
    lines.push('');
    lines.push('</details>');
  }

  lines.push('');
  lines.push(
    `<sub>Inline comments shown for high-confidence findings only ([CERTAIN] + [LIKELY]). ` +
      `Agents run: ${opts.agentIds.join(', ')}.</sub>`,
  );
  return lines.join('\n');
}

/**
 * Render the check-run output (the PASS/FAIL banner shown in the PR's
 * Checks tab and surfaced to required-status-checks gating).
 */
export function formatCheckRunOutput(opts: {
  score: number;
  threshold: number;
  passed: boolean;
  findings: StructuredFinding[];
}): { title: string; summary: string } {
  const s = summariseFindings(opts.findings);
  const title = opts.passed
    ? `Score ${opts.score}/100 — passed (threshold ${opts.threshold})`
    : `Score ${opts.score}/100 — below threshold ${opts.threshold}`;
  const summary = opts.findings.length === 0
    ? 'No findings.'
    : `${s.critical} critical · ${s.high} high · ${s.medium} medium · ${s.low} low`;
  return { title, summary };
}
