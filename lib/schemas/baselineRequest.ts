// Request schemas for /api/baselines + /api/baselines/diff.
//
// We accept findings in the same shape produced by REPORT_FINDINGS_TOOL
// (lib/ai/findingSchema.ts) but only require the fields needed for hashing.
// Extra fields are accepted (and stored for display) but not type-validated
// to keep the surface forgiving for callers passing through the full
// StructuredFinding from the audit pipeline.

import { z } from 'zod';

export const baselineFindingSchema = z.object({
  id:             z.string().optional(),
  severity:       z.enum(['critical', 'high', 'medium', 'low', 'informational']),
  confidence:     z.enum(['certain', 'likely', 'possible']).optional(),
  classification: z.enum(['vulnerability', 'deficiency', 'suggestion']),
  title:          z.string().min(1).max(500),
  location:       z.string().max(500).optional(),
  code_snippet:   z.string().max(5_000).optional(),
  cwe:            z.string().max(50).optional(),
  remediation:    z.string().max(5_000).optional(),
}).passthrough();

// 200 findings is well above the realistic per-audit max (~50) while still
// bounding worst-case payload size.
export const MAX_FINDINGS = 200;
export const MAX_SCOPE_KEY_LEN = 200;

export const saveBaselineRequestSchema = z.object({
  scopeKey: z.string().min(1).max(MAX_SCOPE_KEY_LEN),
  findings: z.array(baselineFindingSchema).max(MAX_FINDINGS),
});

export const diffBaselineRequestSchema = z.object({
  scopeKey: z.string().min(1).max(MAX_SCOPE_KEY_LEN),
  findings: z.array(baselineFindingSchema).max(MAX_FINDINGS),
});

export type SaveBaselineRequest = z.infer<typeof saveBaselineRequestSchema>;
export type DiffBaselineRequest = z.infer<typeof diffBaselineRequestSchema>;
