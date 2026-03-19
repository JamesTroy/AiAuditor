import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { user as userTable } from '@/lib/auth-schema';
import { eq } from 'drizzle-orm';

const MAX_WORKSPACE_CONTEXT_CHARS = 2_000;

export async function GET() {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select({ workspaceContext: userTable.workspaceContext })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  return NextResponse.json({ workspaceContext: rows[0]?.workspaceContext ?? '' });
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ctx = (body as Record<string, unknown>).workspaceContext;
  if (typeof ctx !== 'string') {
    return NextResponse.json({ error: 'workspaceContext must be a string' }, { status: 400 });
  }
  if (ctx.length > MAX_WORKSPACE_CONTEXT_CHARS) {
    return NextResponse.json(
      { error: `workspaceContext too long (max ${MAX_WORKSPACE_CONTEXT_CHARS} characters)` },
      { status: 400 },
    );
  }

  await db
    .update(userTable)
    .set({ workspaceContext: ctx.trim() || null, updatedAt: new Date() })
    .where(eq(userTable.id, session.user.id));

  return NextResponse.json({ ok: true });
}
