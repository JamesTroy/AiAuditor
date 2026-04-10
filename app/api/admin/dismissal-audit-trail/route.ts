import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { findingDismissals, user as userTable, audit as auditTable } from '@/lib/auth-schema';
import { eq, desc } from 'drizzle-orm';
import { API_RESPONSE_HEADERS } from '@/lib/config/apiHeaders';
import { requireAdminRole } from '@/lib/middleware/requireAdmin';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * GET /api/admin/dismissal-audit-trail
 *
 * Returns a paginated list of all finding dismiss/restore actions across all audits.
 * Joins user name/email and agent name for readability in the admin dashboard.
 *
 * Query params:
 *   limit  — number of records to return (default 100, max 500)
 *   offset — records to skip for pagination (default 0)
 *
 * Protected: requires admin role.
 */
export async function GET(req: NextRequest) {
  const forbidden = await requireAdminRole(req);
  if (forbidden) return forbidden;

  const { searchParams } = req.nextUrl;
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  const rows = await db
    .select({
      id:         findingDismissals.id,
      auditId:    findingDismissals.auditId,
      findingId:  findingDismissals.findingId,
      userId:     findingDismissals.userId,
      userName:   userTable.name,
      userEmail:  userTable.email,
      action:     findingDismissals.action,
      severity:   findingDismissals.severity,
      confidence: findingDismissals.confidence,
      reason:     findingDismissals.reason,
      createdAt:  findingDismissals.createdAt,
      agentName:  auditTable.agentName,
    })
    .from(findingDismissals)
    .leftJoin(userTable, eq(findingDismissals.userId, userTable.id))
    .leftJoin(auditTable, eq(findingDismissals.auditId, auditTable.id))
    .orderBy(desc(findingDismissals.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(
    { trail: rows, count: rows.length, limit, offset },
    { headers: API_RESPONSE_HEADERS },
  );
}
