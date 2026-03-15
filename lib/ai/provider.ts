// ARCH-007: AIProvider interface decouples the HTTP route from the Anthropic SDK.
// Swap the concrete implementation here to change AI providers without touching
// any route handler, and inject MockAIProvider in tests.

export interface AIProvider {
  /**
   * Stream an AI response given a system prompt and user input.
   * Returns a ReadableStream<Uint8Array> of UTF-8 encoded text chunks.
   * Callers are responsible for aborting via the signal if needed.
   */
  streamAudit(
    systemPrompt: string,
    userInput: string,
    options?: { signal?: AbortSignal },
  ): ReadableStream<Uint8Array>;

  /**
   * Stream a multi-turn chat response given a system prompt and message history.
   */
  streamChat(
    systemPrompt: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
    options?: { signal?: AbortSignal },
  ): ReadableStream<Uint8Array>;
}
