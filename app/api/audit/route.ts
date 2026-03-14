import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { getAgent } from '@/lib/agents';
import { checkRateLimit } from '@/lib/rateLimit';
import { AgentType } from '@/lib/types';

const client = new Anthropic();

export const runtime = 'nodejs';

// VULN-006: Strict allowlist — must match AgentType union in lib/types.ts exactly.
const VALID_AGENT_TYPES: ReadonlySet<string> = new Set([
  'code-quality',
  'security',
  'seo-performance',
  'accessibility',
  'sql',
  'api-design',
  'devops',
  'performance',
  'privacy',
  'test-quality',
  'architecture',
]);

// VULN-008: Server-side size ceilings.
const MAX_CONTENT_LENGTH = 120_000; // ~120 KB; accounts for JSON overhead
const MAX_INPUT_CHARS = 30_000;
const MAX_SYSTEM_PROMPT_CHARS = 10_000;

// VULN-016: Structured JSON logging to console (no external logger needed).
function log(level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, event, ...data };
  // eslint-disable-next-line no-console
  (level === 'info' ? console.log : level === 'warn' ? console.warn : console.error)(
    JSON.stringify(entry),
  );
}

function makeStream(systemPrompt: string, safeInput: string, logMeta: Record<string, unknown>) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: 'user', content: safeInput }],
        });
        for await (const chunk of anthropicStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        log('info', 'audit_complete', logMeta);
      } catch (err) {
        log('error', 'anthropic_stream_error', {
          ...logMeta,
          error: err instanceof Error ? err.message : String(err),
        });
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}

const STREAM_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-cache',
};

export async function POST(req: NextRequest) {
  // VULN-001 / VULN-011: Rate limiting (in-memory sliding window, 10 req/min/IP).
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';

  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
    log('warn', 'rate_limit_exceeded', { ip });
    return new Response('Too many requests. Please wait a moment.', {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  // VULN-008: Content-Length pre-check (advisory but catches large payloads early).
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredLength) && declaredLength > MAX_CONTENT_LENGTH) {
      log('warn', 'content_length_too_large', { ip, declaredLength });
      return new Response('Request body too large', { status: 413 });
    }
  }

  // Parse body.
  let body: { agentType?: unknown; input?: unknown; systemPrompt?: unknown };
  try {
    body = await req.json();
  } catch {
    log('warn', 'invalid_json', { ip });
    return new Response('Invalid JSON', { status: 400 });
  }

  const { agentType, input, systemPrompt } = body;

  // --- Custom agent branch ---
  if (agentType === 'custom') {
    if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
      log('warn', 'custom_missing_system_prompt', { ip });
      return new Response('Missing system prompt', { status: 400 });
    }
    if (systemPrompt.length > MAX_SYSTEM_PROMPT_CHARS) {
      log('warn', 'custom_system_prompt_too_long', { ip, length: systemPrompt.length });
      return new Response(`System prompt too long (max ${MAX_SYSTEM_PROMPT_CHARS.toLocaleString()} characters)`, { status: 400 });
    }
    if (typeof input !== 'string' || !input.trim()) {
      log('warn', 'missing_input', { ip });
      return new Response('Missing input', { status: 400 });
    }
    if (input.length > MAX_INPUT_CHARS) {
      log('warn', 'input_too_long', { ip, length: input.length });
      return new Response(`Input too long (max ${MAX_INPUT_CHARS.toLocaleString()} characters)`, { status: 400 });
    }
    const safeInput = `<user_content>\n${input}\n</user_content>`;
    log('info', 'custom_audit_start', { ip, promptLength: systemPrompt.length, inputLength: input.length, remaining });
    return new Response(makeStream(systemPrompt.trim(), safeInput, { ip, agentType: 'custom' }), { headers: STREAM_HEADERS });
  }

  // --- Built-in agent branch ---
  // VULN-006: Strict allowlist check before getAgent.
  if (typeof agentType !== 'string' || !VALID_AGENT_TYPES.has(agentType)) {
    log('warn', 'invalid_agent_type', { ip, agentType });
    return new Response('Invalid agent type', { status: 400 });
  }

  if (typeof input !== 'string' || !input.trim()) {
    log('warn', 'missing_input', { ip });
    return new Response('Missing input', { status: 400 });
  }

  // VULN-008: Server-side character length check.
  if (input.length > MAX_INPUT_CHARS) {
    log('warn', 'input_too_long', { ip, length: input.length });
    return new Response(`Input too long (max ${MAX_INPUT_CHARS.toLocaleString()} characters)`, { status: 400 });
  }

  const agent = getAgent(agentType as AgentType);
  if (!agent) {
    log('error', 'agent_not_found_after_allowlist', { ip, agentType });
    return new Response('Unknown agent type', { status: 400 });
  }

  // VULN-005: XML delimiters separate user content from instructions.
  // VULN-014: Stream integrity relies on TLS + HSTS (configured in next.config.ts).
  const safeInput = `<user_content>\n${input}\n</user_content>`;
  log('info', 'audit_start', { ip, agentType, inputLength: input.length, remaining });
  return new Response(makeStream(agent.systemPrompt, safeInput, { ip, agentType }), { headers: STREAM_HEADERS });
}
