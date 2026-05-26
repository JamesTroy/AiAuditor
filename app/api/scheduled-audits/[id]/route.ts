import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { scheduledAudits } from '@/lib/auth-schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  repoUrl: z.string().url().optional(),
  githubToken: z.string().max(200).nullable().optional(),
  branch: z.string().min(1).max(200).optional(),
  schedule: z.enum(['daily', 'weekly']).optional(),
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

  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

  const [row] = await db
    .update(scheduledAudits)
    .set(updates)
    .where(and(eq(scheduledAudits.id, id), eq(scheduledAudits.userId, s.user.id)))
    .returning();

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ scheduledAudit: row });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const [row] = await db
    .delete(scheduledAudits)
    .where(and(eq(scheduledAudits.id, id), eq(scheduledAudits.userId, s.user.id)))
    .returning({ id: scheduledAudits.id });

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
