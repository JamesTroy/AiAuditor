import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider } from './provider';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;
const TEMPERATURE = 0;

// ARCH-018: Retry parameters for transient Anthropic API errors (429, 529, 5xx).
// Exponential back-off: attempt 1 → 1 s, attempt 2 → 2 s, attempt 3 → 4 s.
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1_000;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);

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
    const encoder = new TextEncoder();
    const client = this.client;

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        let attempt = 0;

        while (true) {
          attempt++;
          try {
            const stream = client.messages.stream(
              {
                model: MODEL,
                max_tokens: MAX_TOKENS,
                temperature: TEMPERATURE,
                system: systemPrompt,
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
}

// Singleton — reuses the same Anthropic client across requests.
export const anthropicProvider = new AnthropicProvider();
