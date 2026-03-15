'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

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
        <p className="text-sm text-gray-400 dark:text-zinc-500 animate-pulse">Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-zinc-500">No active sessions found.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const isCurrent = s.token === currentSessionToken;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg"
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
                    {new Date(s.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => handleRevoke(s.token)}
                    disabled={revoking === s.token}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-500 disabled:opacity-50 font-medium"
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
