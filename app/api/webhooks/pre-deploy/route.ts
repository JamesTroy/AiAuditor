import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { webhookConfigs } from '@/lib/auth-schema';
import { eq } from 'drizzle-orm';
import { fetchRepoCode, parseGitHubUrl } from '@/lib/githubQuickFetch';
import { quickScore } from '@/lib/quickScore';
import { z } from 'zod';

export const runtime = 'nodejs';
// Railway functions can take up to 5 min; give the full audit 3 min.
export const maxDuration = 180;

const bodySchema = z.union([
  z.object({
    owner: z.string().min(1),
    repo:  z.string().min(1),
    branch: z.string().default('HEAD'),
    githubToken: z.string().optional(),
  }),
  z.object({
    repoUrl: z.string().url(),
    branch: z.string().default('HEAD'),
    githubToken: z.string().optional(),
  }),
  z.object({
    code: z.string().min(1).max(300_000),
  }),
]);

function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export async function POST(req: NextRequest) {
  const rawKey = extractBearerToken(req);
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing Authorization: Bearer <api_key>' }, { status: 401 });
  }

  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const config = await db.query.webhookConfigs.findFirst({
    where: eq(webhookConfigs.apiKeyHash, keyHash),
  });

  if (!config || !config.enabled) {
    return NextResponse.json({ error: 'Invalid or disabled API key' }, { status: 401 });
  }

  // Record last used timestamp (fire-and-forget — don't await to avoid blocking response).
  db.update(webhookConfigs)
    .set({ lastUsedAt: new Date() })
    .where(eq(webhookConfigs.id, config.id))
    .catch(() => { /* ignore */ });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide owner+repo, repoUrl, or code', details: parsed.error.flatten() }, { status: 422 });
  }

  let code: string;
  try {
    if ('code' in parsed.data) {
      code = parsed.data.code;
    } else {
      let owner: string, repo: string;
      if ('repoUrl' in parsed.data) {
        const parsed2 = parseGitHubUrl(parsed.data.repoUrl);
        if (!parsed2) return NextResponse.json({ error: 'Could not parse GitHub URL' }, { status: 422 });
        owner = parsed2.owner;
        repo = parsed2.repo;
      } else {
        owner = parsed.data.owner;
        repo = parsed.data.repo;
      }
      const fetched = await fetchRepoCode(owner, repo, parsed.data.branch, parsed.data.githubToken);
      code = fetched.text;
      if (!code.trim()) return NextResponse.json({ error: 'No source files found in repo' }, { status: 422 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to fetch code: ${msg}` }, { status: 502 });
  }

  let result;
  try {
    result = await quickScore(code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Audit failed: ${msg}` }, { status: 500 });
  }

  const passed = result.score >= config.threshold;

  return NextResponse.json(
    {
      passed,
      score: result.score,
      threshold: config.threshold,
      critical: result.critical,
      high: result.high,
      medium: result.medium,
      summary: result.summary,
    },
    { status: passed ? 200 : 422 },
  );
}
