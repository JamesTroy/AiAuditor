// CLOUD-015: Reusable RBAC middleware for admin route handlers.
// Verifies the authenticated user holds the 'admin' role.
// Returns a 403 Response if unauthorized, or null to proceed.

import { auth } from '@/lib/auth';

export async function requireAdminRole(req: Request): Promise<Response | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user || session.user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null; // authorized — proceed
}
