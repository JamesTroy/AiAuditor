'use client';

// ARCH-002: Encapsulates the streaming audit session so AuditInterface stays
// focused on rendering. All server communication and result accumulation lives here.
//
// SM-003/009/012/014/017: Uses refs for run guards and abort, explicit status enum
// instead of a single boolean, and proper cleanup on unmount.

import { useState, useRef, useCallback, useEffect } from 'react';
import { AgentConfig } from '@/lib/types';
import { saveAudit } from '@/lib/history';

// SM-009: Explicit status enum distinguishes stopped from completed.
export type AuditStatus = 'idle' | 'loading' | 'stopped' | 'complete' | 'error';

export interface AuditSessionState {
  result: string;
  status: AuditStatus;
  loading: boolean; // derived convenience: status === 'loading'
  error: string;
  runAudit: (input: string) => Promise<void>;
  handleStop: () => void;
}

export function useAuditSession(
  agent: AgentConfig,
  onAuditSaved?: () => void,
): AuditSessionState {
  const [result, setResult] = useState('');
  const [status, setStatus] = useState<AuditStatus>('idle');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const chunksRef = useRef<string[]>([]);
  const rafRef = useRef<number | null>(null);
  // SM-012: Ref-based guard prevents stale closure over status in runAudit.
  const isRunningRef = useRef(false);
  // SM-014: Guard checked inside RAF callback to prevent post-stop writes.
  const isStoppedRef = useRef(false);

  // SM-017: Cancel RAF and abort fetch on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const runAudit = useCallback(async (input: string) => {
    // SM-012: Use ref guard instead of stale-closure boolean.
    if (!input.trim() || isRunningRef.current) return;

    // Abort any previous run.
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    chunksRef.current = [];
    isRunningRef.current = true;
    isStoppedRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    setStatus('loading');
    setResult('');
    setError('');

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
        setStatus('error');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // SM-003: Check abort after each read.
        if (abortRef.current?.signal.aborted) return;
        const chunk = decoder.decode(value, { stream: true });
        chunksRef.current.push(chunk);

        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            // SM-014: Skip write if stopped between schedule and execution.
            if (!isStoppedRef.current) {
              setResult(chunksRef.current.join(''));
            }
            rafRef.current = null;
          });
        }
      }

      // Flush final result.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (isStoppedRef.current) return;

      const fullResult = chunksRef.current.join('');
      setResult(fullResult);
      setStatus('complete');

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
        setStatus('error');
      }
    } finally {
      isRunningRef.current = false;
    }
  }, [agent, onAuditSaved]);

  const handleStop = useCallback(() => {
    isStoppedRef.current = true;
    isRunningRef.current = false;
    abortRef.current?.abort();
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (chunksRef.current.length > 0) {
      setResult(chunksRef.current.join(''));
    }
    setStatus('stopped');
  }, []);

  return { result, status, loading: status === 'loading', error, runAudit, handleStop };
}
