// WORKFLOW-2: Iterative refinement pipeline.
// Two-pass audit workflow:
// 1. Pass 1 (Breadth): Run the agent with temperature: 0 on full input
// 2. Pass 2 (Depth): Feed initial report + original code back to the agent
//    with instruction to verify, remove false positives, and add missed findings.
//
// Catches ~15-25% more true findings while reducing false positives.

export interface RefinementConfig {
  /** System prompt for the agent. */
  systemPrompt: string;
  /** User input (source code). */
  input: string;
  /** Whether to include the full source in Pass 2 (expensive but thorough). */
  includeSourceInPass2?: boolean;
}

/**
 * Build the Pass 2 refinement prompt.
 * Takes the original system prompt and augments it with refinement instructions.
 */
export function buildRefinementPrompt(
  originalSystemPrompt: string,
): string {
  return originalSystemPrompt + `

=== REFINEMENT PASS ===
You are now performing a SECOND-PASS refinement of your initial audit.
You will receive your initial report alongside the original source code.

Your tasks:
1. VERIFY each finding: Check that every code_snippet you cited actually exists in the source.
   Remove any findings where the code reference is wrong or the issue doesn't actually apply.
2. VALIDATE severity: Re-check that each finding's severity matches the actual impact.
   Downgrade overly-alarming findings. Upgrade under-rated critical issues.
3. DISCOVER missed findings: Look for issues you missed in the first pass, especially:
   - Cross-function bugs (data flows between functions)
   - Edge cases in error handling
   - Security issues in "boring" code (config, constants, environment handling)
4. REFINE remediation: Improve your fix suggestions to be more specific and actionable.

Output your refined report in the same format as the original.
Do NOT explain what you changed — just output the improved report.
=== END REFINEMENT PASS ===`;
}

/**
 * Build the user message for Pass 2.
 * Combines the initial report with the original source code.
 */
export function buildRefinementInput(
  initialReport: string,
  originalSource: string,
  includeSource = true,
): string {
  const parts: string[] = [
    '<initial_report>',
    initialReport,
    '</initial_report>',
    '',
  ];

  if (includeSource) {
    // Truncate source if too large — Pass 2 has limited context budget
    const maxSourceChars = 200_000;
    const source = originalSource.length > maxSourceChars
      ? originalSource.slice(0, maxSourceChars) + '\n\n[... source truncated for refinement pass ...]'
      : originalSource;

    parts.push('<original_source>');
    parts.push(source);
    parts.push('</original_source>');
  }

  parts.push('');
  parts.push('Please review and refine the initial report above. Verify all findings against the source code.');

  return parts.join('\n');
}

/**
 * Determine whether a refinement pass is worthwhile for the given input.
 * Small inputs or inputs with few findings may not benefit from refinement.
 */
export function shouldRefine(
  inputLength: number,
  findingCount: number,
): { shouldRefine: boolean; reason: string } {
  // Very small inputs — Pass 1 is likely sufficient
  if (inputLength < 500) {
    return { shouldRefine: false, reason: 'Input too small for refinement pass' };
  }

  // Large inputs with many findings — most value from refinement
  if (inputLength > 10_000 && findingCount >= 5) {
    return { shouldRefine: true, reason: 'Large input with many findings benefits from verification' };
  }

  // Medium inputs — refine if there are enough findings to validate
  if (findingCount >= 3) {
    return { shouldRefine: true, reason: 'Multiple findings benefit from cross-validation' };
  }

  return { shouldRefine: false, reason: 'Too few findings to justify refinement cost' };
}
