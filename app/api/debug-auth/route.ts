import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { user as userTable } from '@/lib/auth-schema';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

// Temporary diagnostic endpoint — DELETE after debugging.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.HEALTH_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    const users = await db.select({ id: userTable.id, email: userTable.email, emailVerified: userTable.emailVerified, createdAt: userTable.createdAt }).from(userTable).limit(10);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(userTable);
    return new Response(JSON.stringify({ userCount: count, users }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
