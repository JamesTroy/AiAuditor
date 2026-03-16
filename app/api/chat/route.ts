import { NextRequest } from 'next/server';
import { auditLimiter } from '@/lib/rateLimit';
import { anthropicProvider } from '@/lib/ai/anthropicProvider';
import { STREAM_RESPONSE_HEADERS } from '@/lib/config/apiHeaders';

export const runtime = 'nodejs';

const CHAT_SYSTEM_PROMPT = `You are a senior code auditor answering follow-up questions about an audit you just performed.

You have access to the original code that was audited and the audit results. Answer questions concisely and precisely:
- Reference specific findings by their IDs when applicable
- Provide code examples for fixes when asked
- Explain the reasoning behind severity ratings
- Suggest concrete next steps

Keep answers focused and under 400 words unless the user asks for detailed code.`;

const MAX_INPUT_CHARS = 80_000;
const MAX_MESSAGES = 20;
const STREAM_TIMEOUT_MS = 60_000;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';

  const rl = await auditLimiter.check(ip);
  if (!rl.allowed) {
    return new Response('Too many requests.', { status: 429, headers: rl.headers });
  }

  let body: { messages?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const context = typeof body.context === 'string' ? body.context : '';

  if (messages.length === 0 || messages.length > MAX_MESSAGES) {
    return new Response('Invalid message count', { status: 400 });
  }

  // Validate message format
  for (const msg of messages) {
    if (
      typeof msg !== 'object' ||
      !msg ||
      (msg.role !== 'user' && msg.role !== 'assistant') ||
      typeof msg.content !== 'string' ||
      msg.content.length === 0
    ) {
      return new Response('Invalid message format', { status: 400 });
    }
  }

  // Build system prompt with audit context
  const contextTruncated = context.slice(0, MAX_INPUT_CHARS);
  const systemPrompt = contextTruncated
    ? `${CHAT_SYSTEM_PROMPT}\n\n<audit_context>\n${contextTruncated}\n</audit_context>`
    : CHAT_SYSTEM_PROMPT;

  const chatMessages: ChatMessage[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content.slice(0, 10_000),
  }));

  const stream = anthropicProvider.streamChat(
    systemPrompt,
    chatMessages,
    { signal: AbortSignal.timeout(STREAM_TIMEOUT_MS) },
  );

  return new Response(stream, {
    headers: STREAM_RESPONSE_HEADERS,
  });
}
