import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { scheduledAudits } from '@/lib/auth-schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  repoUrl: z.string().url().regex(/github\.com/, 'Must be a GitHub repo URL'),
  githubToken: z.string().max(200).optional(),
  branch: z.string().min(1).max(200).default('main'),
  schedule: z.enum(['daily', 'weekly']).default('daily'),
  threshold: z.number().int().min(0).max(100).default(70),
});

export async function GET() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select()
    .from(scheduledAudits)
    .where(eq(scheduledAudits.userId, s.user.id))
    .orderBy(desc(scheduledAudits.createdAt));

  return NextResponse.json({ scheduledAudits: rows });
}

export async function POST(req: NextRequest) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { name, repoUrl, githubToken, branch, schedule, threshold } = parsed.data;

  const [row] = await db.insert(scheduledAudits).values({
    id: crypto.randomUUID(),
    userId: s.user.id,
    name,
    repoUrl,
    githubToken: githubToken || null,
    branch,
    schedule,
    threshold,
  }).returning();

  return NextResponse.json({ scheduledAudit: row }, { status: 201 });
}
