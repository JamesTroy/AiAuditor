import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await db.execute(sql`SELECT 1 as ok`);
    const tables = await db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    return Response.json({
      db: 'connected',
      tables: tables.map((r: Record<string, unknown>) => r.tablename),
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    return Response.json(
      {
        db: 'error',
        message: e.message,
        code: 'code' in e ? (e as Record<string, unknown>).code : undefined,
        dbHost: (process.env.DATABASE_URL ?? '').replace(/\/\/.*:.*@/, '//***:***@'),
      },
      { status: 500 }
    );
  }
}
