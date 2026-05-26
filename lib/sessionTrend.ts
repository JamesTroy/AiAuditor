// Groups audit rows into "sessions" so the dashboard score trend reflects user
// actions instead of individual agent runs.
//
// Background: each agent in a multi-agent run writes its own row to the
// `audit` table. Without grouping, "last 10 audits" shows the variance across
// auditors within a single session rather than improvement over time.
//
// A session is "the same code submitted within a short time window." We key by
// the SQL-computed hash of the input (so we don't have to ship full input text
// to the dashboard query) and a coarse time bucket so re-runs against the same
// code at very different times still count as separate sessions.

/** Width of the time bucket — agents in one click finish well within 5 min. */
export const SESSION_BUCKET_MS = 5 * 60 * 1000;

export interface AuditPoint {
  score: number;
  /**
   * Date object or an ISO string. unstable_cache JSON-serialises its payload,
   * so a `Date` from drizzle round-trips as a string after caching — accept
   * both rather than forcing every caller to remember the conversion.
   */
  createdAt: Date | string;
  /** Stable hash of the audit input (md5 of the first ~4KB, computed in SQL). */
  sessionKey: string;
}

export interface SessionPoint {
  /** Average score across all agents in the session, rounded to nearest int. */
  score: number;
  /** Earliest createdAt in the group — when the user kicked the session off. */
  createdAt: Date;
  /** How many agents ran in this session. */
  agentCount: number;
}

/**
 * Group audit rows by session (sessionKey + time bucket), average their scores,
 * and return up to `limit` sessions ordered oldest → newest (the order
 * ScoreTrendChart expects).
 *
 * `rows` may be in any order; the function does not mutate the input.
 */
export function groupAuditSessions(rows: AuditPoint[], limit = 10): SessionPoint[] {
  if (rows.length === 0) return [];

  // Map<groupKey, { sum, count, earliest }>
  const groups = new Map<string, { sum: number; count: number; earliest: Date }>();

  for (const row of rows) {
    const when = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    const bucket = Math.floor(when.getTime() / SESSION_BUCKET_MS);
    const key = `${row.sessionKey}:${bucket}`;
    const existing = groups.get(key);
    if (existing) {
      existing.sum += row.score;
      existing.count += 1;
      if (when < existing.earliest) existing.earliest = when;
    } else {
      groups.set(key, { sum: row.score, count: 1, earliest: when });
    }
  }

  const sessions: SessionPoint[] = Array.from(groups.values()).map((g) => ({
    score: Math.round(g.sum / g.count),
    createdAt: g.earliest,
    agentCount: g.count,
  }));

  // Newest first → keep most recent N → then reverse to chronological order.
  sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return sessions.slice(0, limit).reverse();
}

/**
 * Trend delta in points between the first and last session in a chronological
 * list. Returns null if there are fewer than 2 sessions.
 */
export function sessionTrendDelta(sessions: SessionPoint[]): number | null {
  if (sessions.length < 2) return null;
  return sessions[sessions.length - 1].score - sessions[0].score;
}
