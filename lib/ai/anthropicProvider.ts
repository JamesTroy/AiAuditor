import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider } from './provider';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;
const TEMPERATURE = 0;

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
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });
  }
}

// Singleton — reuses the same Anthropic client across requests.
export const anthropicProvider = new AnthropicProvider();
