import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { webhookConfigs } from '@/lib/auth-schema';
import { eq, desc } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  threshold: z.number().int().min(0).max(100).default(70),
});

export async function GET() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select({
      id: webhookConfigs.id,
      name: webhookConfigs.name,
      apiKeyPreview: webhookConfigs.apiKeyPreview,
      threshold: webhookConfigs.threshold,
      enabled: webhookConfigs.enabled,
      lastUsedAt: webhookConfigs.lastUsedAt,
      createdAt: webhookConfigs.createdAt,
    })
    .from(webhookConfigs)
    .where(eq(webhookConfigs.userId, s.user.id))
    .orderBy(desc(webhookConfigs.createdAt));

  return NextResponse.json({ webhookConfigs: rows });
}

export async function POST(req: NextRequest) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const rawKey = `ck_${randomBytes(24).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPreview = `${rawKey.slice(0, 10)}...${rawKey.slice(-4)}`;

  await db.insert(webhookConfigs).values({
    id: crypto.randomUUID(),
    userId: s.user.id,
    name: parsed.data.name,
    apiKeyHash: keyHash,
    apiKeyPreview: keyPreview,
    threshold: parsed.data.threshold,
  });

  // Return the raw key once — it cannot be recovered after this response.
  return NextResponse.json({ apiKey: rawKey, preview: keyPreview }, { status: 201 });
}
