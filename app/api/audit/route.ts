import { NextRequest } from 'next/server';
import { getAgent } from '@/lib/agents';
import { checkRateLimit } from '@/lib/rateLimit';
import { anthropicProvider } from '@/lib/ai/anthropicProvider';
import { auditRequestSchema } from '@/lib/schemas/auditRequest';

// ARCH-022: Fail fast at module init if the API key is missing rather than
// surfacing a cryptic SDK error on the first real user request.
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error(
    'ANTHROPIC_API_KEY environment variable is not set. ' +
    'Add it to .env.local (dev) or the deployment platform secret store (prod).'
  );
}

export const runtime = 'nodejs';

// VULN-008: Server-side size ceiling on raw content-length (advisory; actual
// field lengths are enforced by the Zod schema in lib/schemas/auditRequest.ts).
const MAX_CONTENT_LENGTH = 120_000; // ~120 KB; accounts for JSON overhead

// ARCH-016: Hard server-side timeout on the Anthropic stream.
// Prevents a hung upstream connection from holding the worker indefinitely.
const STREAM_TIMEOUT_MS = 120_000; // 2 minutes

// ARCH-020: Structured JSON logging with request ID for correlation.
function log(
  level: 'info' | 'warn' | 'error',
  event: string,
  data?: Record<string, unknown>,
) {
  const entry = { ts: new Date().toISOString(), level, event, ...data };
  // eslint-disable-next-line no-console
  (level === 'info' ? console.log : level === 'warn' ? console.warn : console.error)(
    JSON.stringify(entry),
  );
}

// ARCH-020: Short alphanumeric request ID for log correlation.
function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeStream(
  systemPrompt: string,
  safeInput: string,
  logMeta: Record<string, unknown>,
): ReadableStream {
  // ARCH-016: Hard server-side timeout via AbortSignal — tears down the
  // upstream connection if Claude hasn't finished within STREAM_TIMEOUT_MS.
  const timeoutSignal = AbortSignal.timeout(STREAM_TIMEOUT_MS);

  // ARCH-007: Delegate to the AIProvider — the route no longer knows which
  // SDK or model is in use.
  const upstream = anthropicProvider.streamAudit(systemPrompt, safeInput, {
    signal: timeoutSignal,
  });

  // Wrap to add logging around completion / errors.
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        log('info', 'audit_complete', logMeta);
      } catch (err) {
        const isTimeout = err instanceof Error && err.name === 'TimeoutError';
        log('error', isTimeout ? 'stream_timeout' : 'anthropic_stream_error', {
          ...logMeta,
          error: err instanceof Error ? err.message : String(err),
        });
        // Send a sentinel so the client knows the stream ended abnormally.
        try {
          controller.enqueue(
            encoder.encode('\n\n[Audit interrupted — please try again.]'),
          );
        } catch { /* controller may already be closed */ }
        controller.error(err);
      } finally {
        reader.releaseLock();
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
  // ARCH-020: Attach a request ID to every log entry for this request.
  const requestId = newRequestId();

  // VULN-001 / VULN-011: Rate limiting (in-memory sliding window, 10 req/min/IP).
  // ARCH-001 NOTE: This limiter is process-scoped. In multi-instance or serverless
  // deployments each replica has its own counter — replace with Redis/Upstash for
  // true distributed rate limiting before exposing to untrusted traffic.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';

  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
    log('warn', 'rate_limit_exceeded', { requestId, ip });
    return new Response('Too many requests. Please wait a moment.', {
      status: 429,
      headers: { 'Retry-After': '60', 'X-Request-Id': requestId },
    });
  }

  // VULN-008: Content-Length pre-check (advisory but catches large payloads early).
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredLength) && declaredLength > MAX_CONTENT_LENGTH) {
      log('warn', 'content_length_too_large', { requestId, ip, declaredLength });
      return new Response('Request body too large', {
        status: 413,
        headers: { 'X-Request-Id': requestId },
      });
    }
  }

  // Parse body.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    log('warn', 'invalid_json', { requestId, ip });
    return new Response('Invalid JSON', {
      status: 400,
      headers: { 'X-Request-Id': requestId },
    });
  }

  // ARCH-013: Validate with shared Zod schema — single source of truth for
  // field constraints (lengths, allowed values) used by both server and client.
  const parsed = auditRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request';
    log('warn', 'schema_validation_failed', {
      requestId,
      ip,
      issues: parsed.error.issues,
    });
    return new Response(message, {
      status: 400,
      headers: { 'X-Request-Id': requestId },
    });
  }

  const data = parsed.data;

  if (data.agentType === 'custom') {
    // VULN-005: XML delimiters separate user content from instructions.
    const safeInput = `<user_content>\n${data.input}\n</user_content>`;
    log('info', 'custom_audit_start', {
      requestId,
      ip,
      promptLength: data.systemPrompt.length,
      inputLength: data.input.length,
      remaining,
    });
    return new Response(
      makeStream(data.systemPrompt.trim(), safeInput, { requestId, ip, agentType: 'custom' }),
      { headers: { ...STREAM_HEADERS, 'X-Request-Id': requestId } },
    );
  }

  // Built-in agent — agentType is already validated by the schema enum.
  const agent = getAgent(data.agentType);
  if (!agent) {
    log('error', 'agent_not_found_after_allowlist', { requestId, ip, agentType: data.agentType });
    return new Response('Unknown agent type', {
      status: 400,
      headers: { 'X-Request-Id': requestId },
    });
  }

  // VULN-005: XML delimiters separate user content from instructions.
  // VULN-014: Stream integrity relies on TLS + HSTS (configured in next.config.ts).
  const safeInput = `<user_content>\n${data.input}\n</user_content>`;
  log('info', 'audit_start', {
    requestId,
    ip,
    agentType: data.agentType,
    inputLength: data.input.length,
    remaining,
  });
  return new Response(
    makeStream(agent.systemPrompt, safeInput, { requestId, ip, agentType: data.agentType }),
    { headers: { ...STREAM_HEADERS, 'X-Request-Id': requestId } },
  );
}
