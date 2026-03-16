import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider } from './provider';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 16384;

// ARCH-018: Retry parameters for transient Anthropic API server errors.
// RL-014: Do NOT retry on 429 — retrying a rate limit worsens cost and delays.
// Only retry on genuine server errors (500, 502, 503, 529).
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1_000;

const RETRYABLE_STATUS = new Set([500, 502, 503, 529]);

// PERF-012: Hoist TextEncoder to module scope — it's stateless and reusable.
const encoder = new TextEncoder();

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) return RETRYABLE_STATUS.has(err.status);
  return false;
}

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  streamAudit(
    systemPrompt: string,
    userInput: string,
    options?: { signal?: AbortSignal },
  ): ReadableStream<Uint8Array> {
    const client = this.client;

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        let attempt = 0;

        while (true) {
          attempt++;
          try {
            // CACHE-014: Use cache_control on system prompt so Anthropic caches the
            // processed prompt for 5 minutes. Saves ~90% of input token cost on
            // repeated requests to the same agent.
            const stream = client.messages.stream(
              {
                model: MODEL,
                max_tokens: MAX_TOKENS,
                temperature: 0,
                system: [
                  {
                    type: 'text' as const,
                    text: systemPrompt,
                    cache_control: { type: 'ephemeral' as const },
                  },
                ],
                messages: [{ role: 'user', content: userInput }],
              },
              options?.signal ? { signal: options.signal } : undefined,
            );

            for await (const chunk of stream) {
              if (
                chunk.type === 'content_block_delta' &&
                chunk.delta.type === 'text_delta'
              ) {
                controller.enqueue(encoder.encode(chunk.delta.text));
              }
            }

            // Stream completed successfully.
            break;
          } catch (err) {
            // Do not retry if the AbortSignal fired — caller timed out.
            if (options?.signal?.aborted) {
              controller.error(err);
              return;
            }

            if (attempt < MAX_RETRIES && isRetryable(err)) {
              const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
              await sleep(delay);
              continue;
            }

            controller.error(err);
            return;
          }
        }

        controller.close();
      },
    });
  }

  streamChat(
    systemPrompt: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
    options?: { signal?: AbortSignal },
  ): ReadableStream<Uint8Array> {
    const client = this.client;

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        let attempt = 0;

        while (true) {
          attempt++;
          try {
            // CACHE-014: Prompt caching for chat system prompt.
            // Chat uses standard mode (no extended thinking) for faster responses.
            const stream = client.messages.stream(
              {
                model: MODEL,
                max_tokens: MAX_TOKENS,
                temperature: 0,
                system: [
                  {
                    type: 'text' as const,
                    text: systemPrompt,
                    cache_control: { type: 'ephemeral' as const },
                  },
                ],
                messages: messages.map((m) => ({ role: m.role, content: m.content })),
              },
              options?.signal ? { signal: options.signal } : undefined,
            );

            for await (const chunk of stream) {
              if (
                chunk.type === 'content_block_delta' &&
                chunk.delta.type === 'text_delta'
              ) {
                controller.enqueue(encoder.encode(chunk.delta.text));
              }
            }

            break;
          } catch (err) {
            if (options?.signal?.aborted) {
              controller.error(err);
              return;
            }

            if (attempt < MAX_RETRIES && isRetryable(err)) {
              const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
              await sleep(delay);
              continue;
            }

            controller.error(err);
            return;
          }
        }

        controller.close();
      },
    });
  }
}

// Singleton — reuses the same Anthropic client across requests.
export const anthropicProvider = new AnthropicProvider();
