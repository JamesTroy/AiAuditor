'use client';

// ARCH-002: Encapsulates the streaming audit session so AuditInterface stays
// focused on rendering. All server communication and result accumulation lives here.
//
// PERF-001/002: Stream chunks are accumulated in an array (O(n) vs O(n²) string concat)
// and React state updates are throttled via requestAnimationFrame (~60fps) to avoid
// triggering a full markdown re-parse on every chunk.

import { useState, useRef, useCallback, useEffect } from 'react';
import { AgentConfig } from '@/lib/types';
import { saveAudit } from '@/lib/history';

export interface AuditSessionState {
  result: string;
  loading: boolean;
  error: string;
  runAudit: (input: string) => Promise<void>;
  handleStop: () => void;
}

export function useAuditSession(
  agent: AgentConfig,
  onAuditSaved?: () => void,
): AuditSessionState {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const chunksRef = useRef<string[]>([]);
  const rafRef = useRef<number | null>(null);

  // PERF-016: Cancel pending RAF on unmount to avoid stale setResult calls.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const runAudit = useCallback(async (input: string) => {
    if (!input.trim() || loading) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    chunksRef.current = [];
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    setLoading(true);
    setResult('');
    setError('');

    // ARCH-014: Use the kind discriminator instead of an ID allowlist lookup.
    const requestBody = agent.kind === 'builtin'
      ? JSON.stringify({ agentType: agent.id, input })
      : JSON.stringify({ agentType: 'custom', systemPrompt: agent.systemPrompt, input });

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        setError(text || `Error ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        chunksRef.current.push(chunk);

        // PERF-001: Throttle React state updates to animation frame rate (~60fps).
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            setResult(chunksRef.current.join(''));
            rafRef.current = null;
          });
        }
      }

      // Flush final result immediately on stream end.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const fullResult = chunksRef.current.join('');
      setResult(fullResult);

      saveAudit({
        agentId: agent.id,
        agentName: agent.name,
        inputSnippet: input.slice(0, 100) + (input.length > 100 ? '…' : ''),
        result: fullResult,
        timestamp: Date.now(),
      });
      onAuditSaved?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, agent, onAuditSaved]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Flush whatever we have so far.
    if (chunksRef.current.length > 0) {
      setResult(chunksRef.current.join(''));
    }
    setLoading(false);
  }, []);

  return { result, loading, error, runAudit, handleStop };
}
