'use client';

// ARCH-002: Encapsulates the streaming audit session so AuditInterface stays
// focused on rendering. All server communication and result accumulation lives here.

import { useState, useRef, useCallback } from 'react';
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

  const runAudit = useCallback(async (input: string) => {
    if (!input.trim() || loading) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

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
      let fullResult = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullResult += chunk;
        setResult(fullResult);
      }

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
    setLoading(false);
  }, []);

  return { result, loading, error, runAudit, handleStop };
}
