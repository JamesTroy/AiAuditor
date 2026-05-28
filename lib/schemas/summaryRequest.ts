// Request schema for POST /api/audit/summary.

import { z } from 'zod';
import { baselineFindingSchema, MAX_FINDINGS } from '@/lib/schemas/baselineRequest';

export const summaryRequestSchema = z.object({
  findings: z.array(baselineFindingSchema).max(MAX_FINDINGS),
  score: z.number().int().min(0).max(100),
  agentNames: z.array(z.string().max(100)).max(20).optional(),
});

export type SummaryRequest = z.infer<typeof summaryRequestSchema>;
