import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { webhookConfigs } from '@/lib/auth-schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  threshold: z.number().int().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const [row] = await db
    .update(webhookConfigs)
    .set(parsed.data)
    .where(and(eq(webhookConfigs.id, id), eq(webhookConfigs.userId, s.user.id)))
    .returning({ id: webhookConfigs.id, name: webhookConfigs.name, threshold: webhookConfigs.threshold, enabled: webhookConfigs.enabled });

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ webhookConfig: row });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const [row] = await db
    .delete(webhookConfigs)
    .where(and(eq(webhookConfigs.id, id), eq(webhookConfigs.userId, s.user.id)))
    .returning({ id: webhookConfigs.id });

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
