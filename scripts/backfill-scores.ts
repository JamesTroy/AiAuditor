#!/usr/bin/env npx tsx
// PERF-004: One-time migration to backfill scores for audits that completed
// before score extraction was added on save. Run this BEFORE removing any
// dashboard-side backfill logic.
//
// Usage: npx tsx scripts/backfill-scores.ts
//
// Safe to run multiple times — only updates rows where score IS NULL.

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';

// Inline minimal schema to avoid path alias issues when running standalone.
const audit = pgTable('audit', {
  id: text('id').primaryKey(),
  result: text('result'),
  status: text('status').notNull(),
  score: integer('score'),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

// Score extraction logic (duplicated from lib/extractScore.ts to keep script standalone).
function normalizeScore(numStr: string, denomStr?: string): number | null {
  const num = parseFloat(numStr);
  const denom = denomStr ? parseInt(denomStr, 10) : null;
  if (denom === 10 && num <= 10) return Math.round(num * 10);
  if (denom === 100 && num <= 100) return Math.round(num);
  if (!denom && num >= 0 && num <= 100) return Math.round(num);
  return null;
}

function extractScore(text: string): number | null {
  const tableOverall = text.match(
    /\|\s*\*{0,2}(?:Overall|Composite|Total|Final|Net Risk Posture)(?:\s+Score)?\*{0,2}\s*\|\s*(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(\d+))?\s*\|/i,
  );
  if (tableOverall) return normalizeScore(tableOverall[1], tableOverall[2] ?? (parseFloat(tableOverall[1]) <= 10 ? '10' : undefined));

  const headingScore = text.match(/^#{1,4}\s+(?:Overall|Composite|Total|Final)\s+Score\s*[:：]\s*(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(\d+))?/im);
  if (headingScore) return normalizeScore(headingScore[1], headingScore[2]);

  const boldScore = text.match(/\*{1,2}(?:Overall|Composite|Total|Final)\s+Score\s*[:：]\s*(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(\d+))?\*{1,2}/i);
  if (boldScore) return normalizeScore(boldScore[1], boldScore[2]);

  const allSlash100 = [...text.matchAll(/(\d{1,3})\s*\/\s*100/g)];
  if (allSlash100.length > 0) {
    const last = allSlash100[allSlash100.length - 1];
    const val = parseInt(last[1], 10);
    if (val >= 0 && val <= 100) return val;
  }

  const allSlash10 = [...text.matchAll(/(\d{1,2}(?:\.\d+)?)\s*\/\s*10(?!\d)/g)];
  if (allSlash10.length > 0) {
    const last = allSlash10[allSlash10.length - 1];
    const val = parseFloat(last[1]);
    if (val >= 0 && val <= 10) return Math.round(val * 10);
  }

  const overallLine = text.match(/(?:overall|composite|total|final)\s*(?:score|rating)?\s*[:：]\s*(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(\d+))?/i);
  if (overallLine) return normalizeScore(overallLine[1], overallLine[2]);

  return null;
}

/** Cross-validate score against severity distribution (mirrors lib/extractScore.ts). */
function sanityCheckScore(score: number | null, markdown: string): number | null {
  if (score === null) return null;
  const severities = [...markdown.matchAll(/\*\*\[(CRITICAL|HIGH|MEDIUM|LOW|INFORMATIONAL)\]\*\*/gi)]
    .map((m) => m[1].toUpperCase());
  const criticals = severities.filter((s) => s === 'CRITICAL').length;
  const highs = severities.filter((s) => s === 'HIGH').length;
  if (criticals >= 3 && score > 60) return 60;
  if (criticals >= 1 && highs >= 3 && score > 70) return 70;
  const hasMajor = criticals > 0 || highs > 0 || severities.some((s) => s === 'MEDIUM');
  if (!hasMajor && severities.length > 0 && score < 60) return 60;
  return score;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = postgres(url, { max: 1, ssl: 'require' });
  const db = drizzle({ client });

  const rows = await db
    .select({ id: audit.id, result: audit.result })
    .from(audit)
    .where(and(eq(audit.status, 'completed'), isNull(audit.score), isNotNull(audit.result)));

  console.log(`Found ${rows.length} audits without scores`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const rawScore = extractScore(row.result ?? '');
    const score = sanityCheckScore(rawScore, row.result ?? '');
    if (score !== null) {
      await db.update(audit)
        .set({ score, updatedAt: new Date() })
        .where(eq(audit.id, row.id));
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`Done: ${updated} scores backfilled, ${skipped} could not extract score`);
  await client.end();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
