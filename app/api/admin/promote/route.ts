// One-shot admin promotion. Gated by CRON_SECRET so only operators (with
// access to the Railway env vars) can flip roles.
//
//   POST /api/admin/promote
//   Authorization: Bearer $CRON_SECRET
//   Content-Type: application/json
//   { "email": "user@example.com", "role": "admin" }
//
// role defaults to "admin" if omitted. Pass "user" to demote.

import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user as userTable } from '@/lib/auth-schema';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { email?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role  = typeof body.role  === 'string' ? body.role.trim()  : 'admin';
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }
  if (role !== 'admin' && role !== 'user') {
    return NextResponse.json({ error: 'role must be "admin" or "user"' }, { status: 400 });
  }

  // Case-insensitive lookup — Better Auth typically stores email as-typed,
  // but matching on lower(email) is safer.
  const [updated] = await db
    .update(userTable)
    .set({ role })
    .where(sql`lower(${userTable.email}) = ${email}`)
    .returning({ id: userTable.id, email: userTable.email, role: userTable.role });

  if (!updated) {
    return NextResponse.json({ error: 'No user with that email', email }, { status: 404 });
  }

  // Audit trail — role mutations should always leave a log line so we can
  // reconstruct who-promoted-whom-when from Railway logs.
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'info',
    event: 'admin_role_changed',
    targetUserId: updated.id,
    targetEmail: updated.email,
    newRole: updated.role,
  }));

  return NextResponse.json({ ok: true, user: updated });
}

// Convenience GET to peek at a user's current role without changing it.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? '';
  if (!email) return NextResponse.json({ error: 'email query param required' }, { status: 400 });

  const [row] = await db
    .select({ id: userTable.id, email: userTable.email, role: userTable.role })
    .from(userTable)
    .where(eq(sql`lower(${userTable.email})`, email))
    .limit(1);
  if (!row) return NextResponse.json({ error: 'No user with that email', email }, { status: 404 });
  return NextResponse.json({ user: row });
}
