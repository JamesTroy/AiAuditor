import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, ToolCapture } from './provider';
import { anthropicCircuitBreaker } from './circuitBreaker';
import {
  ANTHROPIC_MODEL,
  ANTHROPIC_MAX_TOKENS,
  ANTHROPIC_MAX_RETRIES,
  ANTHROPIC_RETRY_BASE_MS,
} from '@/lib/config/constants';
import { REPORT_FINDINGS_TOOL } from '@/lib/ai/findingSchema';
import type { StructuredAuditResult } from '@/lib/ai/findingSchema';

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
  // STRUCT-001: When tools and toolCapture are provided, accumulates tool_use
  // input_json_delta chunks into toolCapture.toolJson and parses the result
  // after the stream ends. Text deltas are always streamed to the controller.
  private _stream(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: {
      signal?: AbortSignal;
      trackTruncation?: boolean;
      tools?: Anthropic.Messages.Tool[];
      toolCapture?: ToolCapture;
    },
  ): ReadableStream<Uint8Array> {
    const client = this.client;
    const trackTruncation = options?.trackTruncation ?? false;
    const tools = options?.tools;
    const toolCapture = options?.toolCapture;

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const requestParams: any = {
              model: ANTHROPIC_MODEL,
              max_tokens: ANTHROPIC_MAX_TOKENS,
              temperature: 0,
              system: [
                {
                  type: 'text' as const,
                  text: systemPrompt,
                  cache_control: { type: 'ephemeral' as const },
                },
              ],
              messages,
            };

            // STRUCT-001: Include tools when provided for structured output.
            if (tools && tools.length > 0) {
              requestParams.tools = tools;
              // tool_choice: 'auto' lets Claude write text AND call the tool.
            }

            const stream = client.messages.stream(
              requestParams,
              options?.signal ? { signal: options.signal } : undefined,
            );

            let stopReason: string | null = null;
            let inToolUse = false;

            for await (const chunk of stream) {
              // Track whether we're inside a tool_use content block.
              if (chunk.type === 'content_block_start') {
                const block = (chunk as { content_block?: { type: string } }).content_block;
                inToolUse = block?.type === 'tool_use';
              }
              if (chunk.type === 'content_block_stop') {
                inToolUse = false;
              }

              if (chunk.type === 'content_block_delta') {
                const delta = chunk.delta as { type: string; text?: string; partial_json?: string };
                if (delta.type === 'text_delta' && delta.text) {
                  // Stream text content to the client.
                  controller.enqueue(encoder.encode(delta.text));
                } else if (delta.type === 'input_json_delta' && delta.partial_json && toolCapture) {
                  // STRUCT-001: Accumulate tool call JSON — NOT streamed to client.
                  toolCapture.toolJson += delta.partial_json;
                }
              }

              // FP-009: Track stop_reason to detect max_tokens truncation.
              if (chunk.type === 'message_delta' && 'delta' in chunk) {
                const delta = chunk.delta as { stop_reason?: string };
                if (delta.stop_reason) stopReason = delta.stop_reason;
              }
            }

            // FP-009: Warn user if output was truncated due to max_tokens.
            // stop_reason === 'tool_use' is a normal completion when tools are present.
            if (trackTruncation && stopReason === 'max_tokens') {
              controller.enqueue(encoder.encode(
                '\n\n---\n\n> **Note:** This report was truncated because it exceeded the maximum output length. ' +
                'Some findings or the overall score section may be missing. Consider running a more targeted audit ' +
                'on specific sections of your code for complete results.',
              ));
            }

            // STRUCT-001: Parse accumulated tool JSON after stream ends.
            if (toolCapture && toolCapture.toolJson.length > 0) {
              try {
                toolCapture.parsed = JSON.parse(toolCapture.toolJson) as StructuredAuditResult;
              } catch {
                // Malformed tool JSON — degrade gracefully to regex parsing.
                // eslint-disable-next-line no-console
                console.warn(JSON.stringify({
                  ts: new Date().toISOString(),
                  level: 'warn',
                  event: 'tool_json_parse_failed',
                  jsonLength: toolCapture.toolJson.length,
                  preview: toolCapture.toolJson.slice(0, 200),
                }));
                toolCapture.parsed = null;
              }
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

            if (attempt < ANTHROPIC_MAX_RETRIES && isRetryable(err)) {
              const delay = ANTHROPIC_RETRY_BASE_MS * 2 ** (attempt - 1);
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

  // STRUCT-001: Stream audit with structured tool-use output.
  // Returns the text stream (for real-time display) plus a ToolCapture
  // object populated after the stream closes.
  streamAuditStructured(
    systemPrompt: string,
    userInput: string,
    options?: { signal?: AbortSignal },
  ): { stream: ReadableStream<Uint8Array>; toolCapture: ToolCapture } {
    const toolCapture: ToolCapture = { toolJson: '', parsed: null };
    const stream = this._stream(
      systemPrompt,
      [{ role: 'user', content: userInput }],
      {
        ...options,
        trackTruncation: true,
        tools: [REPORT_FINDINGS_TOOL],
        toolCapture,
      },
    );
    return { stream, toolCapture };
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
