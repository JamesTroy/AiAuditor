// ARCH-REVIEW-005: Zod schema for synthesis endpoint — consistent with audit validation pattern.
import { z } from 'zod';

const MAX_RESULT_CHARS = 80_000;

export const synthesizeRequestSchema = z.object({
  results: z
    .string()
    .min(100, 'Audit results too short to synthesize')
    .max(MAX_RESULT_CHARS, `Results too long (max ${MAX_RESULT_CHARS.toLocaleString()} chars)`),
});

export type SynthesizeRequest = z.infer<typeof synthesizeRequestSchema>;
