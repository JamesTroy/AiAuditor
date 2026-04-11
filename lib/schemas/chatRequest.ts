// ARCH-REVIEW-005: Zod schema for chat endpoint — consistent with audit validation pattern.
import { z } from 'zod';

const MAX_INPUT_CHARS = 80_000;
const MAX_MESSAGE_CHARS = 10_000;
const MAX_MESSAGES = 20;

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, 'Message content cannot be empty').max(MAX_MESSAGE_CHARS, `Message too long (max ${MAX_MESSAGE_CHARS.toLocaleString()} chars)`),
});

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, 'At least one message is required')
    .max(MAX_MESSAGES, `Too many messages (max ${MAX_MESSAGES})`),
  context: z
    .string()
    .max(MAX_INPUT_CHARS, `Context too long (max ${MAX_INPUT_CHARS.toLocaleString()} chars)`)
    .optional()
    .default(''),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
