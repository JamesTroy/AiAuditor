'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { relativeTime } from '@/lib/ui';

interface Session {
  id: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export default function ActiveSessions({ currentSessionToken }: { currentSessionToken?: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    try {
      const { data } = await authClient.listSessions();
      if (data) {
        setSessions(data as Session[]);
      }
    } catch {
      // Silently fail — session list is optional
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(sessionToken: string) {
    setRevoking(sessionToken);
    try {
      await authClient.revokeSession({ token: sessionToken });
      setSessions((prev) => prev.filter((s) => s.token !== sessionToken));
    } catch {
      // Silently fail
    } finally {
      setRevoking(null);
    }
  }

  function parseUserAgent(ua?: string | null): string {
    if (!ua) return 'Unknown device';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown browser';
  }

  return (
    <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1">Active sessions</h2>
      <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
        Manage devices where you are currently signed in.
      </p>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-24 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
                <div className="h-3 w-40 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
              </div>
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
          <svg className="w-5 h-5 text-gray-400 dark:text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
          <p className="text-sm text-gray-500 dark:text-zinc-500">No active sessions found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const isCurrent = s.token === currentSessionToken;
            return (
              <div
                key={s.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {parseUserAgent(s.userAgent)}
                    {isCurrent && (
                      <span className="ml-2 text-xs font-medium text-green-600 dark:text-green-400">
                        (this device)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                    {s.ipAddress ?? 'Unknown IP'} &middot; Last active{' '}
                    {relativeTime(new Date(s.updatedAt))}
                  </p>
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => handleRevoke(s.token)}
                    disabled={revoking === s.token}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:text-red-800 disabled:dark:text-red-600 disabled:cursor-not-allowed font-medium rounded-lg px-2.5 py-1.5 min-h-[44px] inline-flex items-center transition-colors shrink-0"
                  >
                    {revoking === s.token ? 'Revoking...' : 'Revoke'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
