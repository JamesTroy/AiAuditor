import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { API_RESPONSE_HEADERS } from '@/lib/config/apiHeaders';
import { requireAdminRole } from '@/lib/middleware/requireAdmin';

// CLOUD-006/017: Cleanup endpoint for expired sessions and old audit records.
// Protected by admin RBAC (CLOUD-015).
//
// Usage:
//   POST /api/admin/cleanup
//   Cookie: <admin session>
//
// Can also be called from a GitHub Actions cron workflow with REVALIDATION_SECRET.

export async function POST(req: NextRequest) {
  // Allow access via admin session OR revalidation secret (for cron jobs)
  const secret = process.env.REVALIDATION_SECRET;
  const authHeader = req.headers.get('authorization');
  const isSecretAuth = secret && authHeader === `Bearer ${secret}`;

  if (!isSecretAuth) {
    const forbidden = await requireAdminRole(req);
    if (forbidden) return forbidden;
  }

  const results: Record<string, number> = {};

  try {
    // CLOUD-017: Delete expired sessions
    const sessionsResult = await db.execute(
      sql`DELETE FROM session WHERE "expiresAt" < NOW()`,
    );
    results.expiredSessions = Number(sessionsResult.count ?? 0);

    // CLOUD-006: Delete audit records older than 90 days
    const auditsResult = await db.execute(
      sql`DELETE FROM audit WHERE "createdAt" < NOW() - INTERVAL '90 days'`,
    );
    results.oldAudits = Number(auditsResult.count ?? 0);

    // Clean up expired verification records
    const verificationsResult = await db.execute(
      sql`DELETE FROM verification WHERE "expiresAt" < NOW()`,
    );
    results.expiredVerifications = Number(verificationsResult.count ?? 0);

    return Response.json(
      { cleaned: results, timestamp: new Date().toISOString() },
      { headers: API_RESPONSE_HEADERS },
    );
  } catch (err) {
    console.error('[cleanup] failed:', err instanceof Error ? err.message : err);
    return new Response('Cleanup failed', { status: 500, headers: API_RESPONSE_HEADERS });
  }
}
