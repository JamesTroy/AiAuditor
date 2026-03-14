'use client';

import { useRef } from 'react';
import AuditInterface from '@/components/AuditInterface';
import HistoryPanel from '@/components/HistoryPanel';
import { AgentConfig } from '@/lib/types';

export default function AuditPageClient({ agent }: { agent: AgentConfig }) {
  // ARCH-003: Use a ref instead of a counter so HistoryPanel is refreshed via
  // a direct function call rather than an implicit dependency on a changing number.
  const historyReloadRef = useRef<(() => void) | null>(null);

  return (
    <>
      <AuditInterface agent={agent} onAuditSaved={() => historyReloadRef.current?.()} />
      <HistoryPanel agentId={agent.id} reloadRef={historyReloadRef} />
    </>
  );
}
