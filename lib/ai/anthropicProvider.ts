import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider } from './provider';
import { anthropicCircuitBreaker } from './circuitBreaker';

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

// PERF-036: Sleep with periodic heartbeat to keep the downstream connection alive
// during retry backoff. Sends SSE-compatible comments that clients will ignore.
async function sleepWithHeartbeat(ms: number, controller: ReadableStreamDefaultController<Uint8Array>) {
  const HEARTBEAT_INTERVAL = 1_000;
  const heartbeat = encoder.encode(': retry-heartbeat\n');
  let elapsed = 0;
  while (elapsed < ms) {
    const wait = Math.min(HEARTBEAT_INTERVAL, ms - elapsed);
    await sleep(wait);
    elapsed += wait;
    try { controller.enqueue(heartbeat); } catch { break; }
  }
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  // PERF-011: Shared streaming core — eliminates duplication between streamAudit and streamChat.
  private _stream(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: { signal?: AbortSignal; trackTruncation?: boolean },
  ): ReadableStream<Uint8Array> {
    const client = this.client;
    const trackTruncation = options?.trackTruncation ?? false;

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        // CLOUD-030: Check circuit breaker before making API call.
        // FP-008: Enqueue a visible error before erroring the stream so
        // clients see an explanation instead of a silent stream end.
        if (!anthropicCircuitBreaker.allowRequest()) {
          controller.enqueue(encoder.encode('\n\n[Service temporarily unavailable. Please try again in a few minutes.]'));
          controller.error(new Error('Circuit breaker open: Anthropic API unavailable. Try again later.'));
          return;
        }

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
                messages,
              },
              options?.signal ? { signal: options.signal } : undefined,
            );

            let stopReason: string | null = null;
            for await (const chunk of stream) {
              if (
                chunk.type === 'content_block_delta' &&
                chunk.delta.type === 'text_delta'
              ) {
                controller.enqueue(encoder.encode(chunk.delta.text));
              }
              // FP-009: Track stop_reason to detect max_tokens truncation.
              if (trackTruncation && chunk.type === 'message_delta' && 'delta' in chunk) {
                const delta = chunk.delta as { stop_reason?: string };
                if (delta.stop_reason) stopReason = delta.stop_reason;
              }
            }

            // FP-009: Warn user if output was truncated due to max_tokens.
            if (trackTruncation && stopReason === 'max_tokens') {
              controller.enqueue(encoder.encode(
                '\n\n---\n\n> **Note:** This report was truncated because it exceeded the maximum output length. ' +
                'Some findings or the overall score section may be missing. Consider running a more targeted audit ' +
                'on specific sections of your code for complete results.',
              ));
            }

            // Stream completed successfully.
            anthropicCircuitBreaker.onSuccess();
            break;
          } catch (err) {
            // Do not retry if the AbortSignal fired — caller timed out.
            if (options?.signal?.aborted) {
              // Timeouts are not API failures — don't count against circuit breaker.
              controller.error(err);
              return;
            }

            anthropicCircuitBreaker.onFailure();

            if (attempt < MAX_RETRIES && isRetryable(err)) {
              const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
              await sleepWithHeartbeat(delay, controller);
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

  streamAudit(
    systemPrompt: string,
    userInput: string,
    options?: { signal?: AbortSignal },
  ): ReadableStream<Uint8Array> {
    return this._stream(systemPrompt, [{ role: 'user', content: userInput }], {
      ...options,
      trackTruncation: true,
    });
  }

  streamChat(
    systemPrompt: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
    options?: { signal?: AbortSignal },
  ): ReadableStream<Uint8Array> {
    return this._stream(
      systemPrompt,
      messages.map((m) => ({ role: m.role, content: m.content })),
      options,
    );
  }
}

// Singleton — reuses the same Anthropic client across requests.
export const anthropicProvider = new AnthropicProvider();
