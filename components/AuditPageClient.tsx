'use client';

import { useState } from 'react';
import AuditInterface from '@/components/AuditInterface';
import HistoryPanel from '@/components/HistoryPanel';
import { AgentConfig } from '@/lib/types';

export default function AuditPageClient({ agent }: { agent: AgentConfig }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <>
      <AuditInterface agent={agent} onAuditSaved={() => setRefreshTrigger((n) => n + 1)} />
      <HistoryPanel agentId={agent.id} refreshTrigger={refreshTrigger} />
    </>
  );
}
