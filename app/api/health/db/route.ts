import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { authGeneralLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// RL-013: Rate-limit the DB health endpoint and restrict detailed info
// to requests bearing the HEALTH_SECRET token.
export async function GET(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';

  const rl = authGeneralLimiter.check(ip);
  if (!rl.allowed) {
    return new Response('Too many requests.', { status: 429, headers: rl.headers });
  }

  const healthSecret = process.env.HEALTH_SECRET;
  const authHeader = req.headers.get('authorization');
  const isAuthorized =
    healthSecret && authHeader === `Bearer ${healthSecret}`;

  try {
    await db.execute(sql`SELECT 1 as ok`);

    // Only return table details to authorized callers.
    if (isAuthorized) {
      const tables = await db.execute(
        sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      );
      return Response.json({
        db: 'connected',
        tables: tables.map((r: Record<string, unknown>) => r.tablename),
      });
    }

    return Response.json({ db: 'connected' });
  } catch {
    // RL-013: Do not leak error details, host, or error codes to public callers.
    if (isAuthorized) {
      return Response.json({ db: 'error' }, { status: 500 });
    }
    return Response.json({ db: 'error' }, { status: 500 });
  }
}
