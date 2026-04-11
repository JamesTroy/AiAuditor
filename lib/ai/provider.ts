// ARCH-007: AIProvider interface decouples the HTTP route from the Anthropic SDK.
// Swap the concrete implementation here to change AI providers without touching
// any route handler, and inject MockAIProvider in tests.

import type { StructuredAuditResult } from '@/lib/ai/findingSchema';

/** Mutable container populated during streaming; read after the stream closes. */
export interface ToolCapture {
  /** Raw JSON string accumulated from input_json_delta chunks. */
  toolJson: string;
  /** Parsed tool result — available after the stream ends. null if no tool call. */
  parsed: StructuredAuditResult | null;
}

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
   * Stream an audit with structured tool-use output.
   * Returns the text stream (for real-time display) plus a ToolCapture
   * object that is populated with the parsed tool call result after
   * the stream closes. Read toolCapture.parsed after consuming the stream.
   */
  streamAuditStructured(
    systemPrompt: string,
    userInput: string,
    options?: { signal?: AbortSignal },
  ): { stream: ReadableStream<Uint8Array>; toolCapture: ToolCapture };

  /**
   * Stream a multi-turn chat response given a system prompt and message history.
   */
  streamChat(
    systemPrompt: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
    options?: { signal?: AbortSignal },
  ): ReadableStream<Uint8Array>;
}
