'use client';

import AuditInterface from '@/components/AuditInterface';
import { AgentConfig } from '@/lib/types';

export default function AuditPageClient({ agent }: { agent: AgentConfig }) {
  return <AuditInterface agent={agent} />;
}
