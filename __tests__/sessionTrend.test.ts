import { describe, it, expect } from 'vitest';
import { groupAuditSessions, sessionTrendDelta, SESSION_BUCKET_MS } from '@/lib/sessionTrend';

function point(score: number, isoTime: string, sessionKey = 'A'): { score: number; createdAt: Date; sessionKey: string } {
  return { score, createdAt: new Date(isoTime), sessionKey };
}

describe('groupAuditSessions', () => {
  it('returns empty array for no rows', () => {
    expect(groupAuditSessions([])).toEqual([]);
    expect(sessionTrendDelta([])).toBeNull();
  });

  it('collapses agents from the same multi-agent session into a single point', () => {
    // Six "agents" finishing within ~30 seconds of one another — same input hash.
    const rows = [
      point(80, '2026-01-01T10:00:05Z'),
      point(90, '2026-01-01T10:00:12Z'),
      point(70, '2026-01-01T10:00:18Z'),
      point(85, '2026-01-01T10:00:25Z'),
      point(95, '2026-01-01T10:00:30Z'),
      point(60, '2026-01-01T10:00:33Z'),
    ];
    const sessions = groupAuditSessions(rows);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].agentCount).toBe(6);
    // avg(80,90,70,85,95,60) = 80
    expect(sessions[0].score).toBe(80);
    // Earliest timestamp survives.
    expect(sessions[0].createdAt.toISOString()).toBe('2026-01-01T10:00:05.000Z');
  });

  it('separates sessions with the same input but different time buckets', () => {
    const rows = [
      point(70, '2026-01-01T10:00:00Z'),
      point(80, '2026-01-01T10:00:30Z'),
      // Bucket boundary at +5 min. 10:06 is in a new bucket.
      point(90, '2026-01-01T10:06:00Z'),
      point(100, '2026-01-01T10:06:10Z'),
    ];
    const sessions = groupAuditSessions(rows);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].score).toBe(75); // avg(70,80) — oldest first
    expect(sessions[1].score).toBe(95); // avg(90,100)
  });

  it('separates audits with different input hashes in the same bucket', () => {
    const rows = [
      { score: 70, createdAt: new Date('2026-01-01T10:00:00Z'), sessionKey: 'A' },
      { score: 90, createdAt: new Date('2026-01-01T10:00:10Z'), sessionKey: 'B' },
    ];
    const sessions = groupAuditSessions(rows);
    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.score).sort()).toEqual([70, 90]);
  });

  it('keeps the most recent N sessions in chronological order', () => {
    // 12 distinct sessions, one minute apart but in different time buckets.
    const rows = Array.from({ length: 12 }, (_, i) => ({
      score: i * 5,
      createdAt: new Date(2026, 0, 1, 10, i * 6),
      sessionKey: `S${i}`,
    }));
    const sessions = groupAuditSessions(rows, 10);
    expect(sessions).toHaveLength(10);
    // Oldest two were dropped — surviving scores start at session index 2.
    expect(sessions[0].score).toBe(10);
    expect(sessions[sessions.length - 1].score).toBe(55);
  });

  it('is robust to unsorted input', () => {
    const rows = [
      point(95, '2026-01-01T10:06:10Z'),
      point(70, '2026-01-01T10:00:00Z'),
      point(90, '2026-01-01T10:06:00Z'),
      point(80, '2026-01-01T10:00:30Z'),
    ];
    const sessions = groupAuditSessions(rows);
    expect(sessions).toHaveLength(2);
    // Chronological order regardless of input order.
    expect(sessions[0].createdAt.getTime()).toBeLessThan(sessions[1].createdAt.getTime());
  });

  it('SESSION_BUCKET_MS is the documented 5 minutes', () => {
    expect(SESSION_BUCKET_MS).toBe(5 * 60_000);
  });
});

describe('sessionTrendDelta', () => {
  it('returns null with fewer than 2 sessions', () => {
    expect(sessionTrendDelta([])).toBeNull();
    expect(sessionTrendDelta([{ score: 80, createdAt: new Date(), agentCount: 1 }])).toBeNull();
  });

  it('returns last minus first (positive = improving)', () => {
    const sessions = groupAuditSessions([
      point(60, '2026-01-01T10:00:00Z'),
      point(85, '2026-01-01T10:30:00Z'),
    ]);
    expect(sessionTrendDelta(sessions)).toBe(25);
  });

  it('returns negative when scores regress', () => {
    const sessions = groupAuditSessions([
      point(90, '2026-01-01T10:00:00Z'),
      point(70, '2026-01-01T10:30:00Z'),
    ]);
    expect(sessionTrendDelta(sessions)).toBe(-20);
  });
});
