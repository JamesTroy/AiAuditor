import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { getAgent } from '@/lib/agents';
import { AuditRequestBody } from '@/lib/types';

const client = new Anthropic();

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: AuditRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { agentType, input } = body;

  if (!agentType || !input?.trim()) {
    return new Response('Missing agentType or input', { status: 400 });
  }

  if (input.length > 30000) {
    return new Response('Input too long (max 30,000 characters)', { status: 400 });
  }

  const agent = getAgent(agentType);
  if (!agent) {
    return new Response('Unknown agent type', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          temperature: 0,
          system: agent.systemPrompt,
          messages: [{ role: 'user', content: input }],
        });

        for await (const chunk of anthropicStream) {
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

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  });
}
