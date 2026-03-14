'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getCustomAgent, toAgentConfig } from '@/lib/customAgents';
import { AgentConfig } from '@/lib/types';
import AuditPageClient from '@/components/AuditPageClient';
import SystemPromptViewer from '@/components/SystemPromptViewer';

type State = 'loading' | AgentConfig | null;

export default function CustomAgentPage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<State>('loading');

  useEffect(() => {
    const found = getCustomAgent(id);
    setAgent(found ? toAgentConfig(found) : null);
  }, [id]);

  if (agent === 'loading') {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 flex items-center justify-center">
        <span className="text-gray-500 dark:text-zinc-500 animate-pulse text-sm">Loading...</span>
      </main>
    );
  }

  if (agent === null) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 text-sm mb-8 inline-flex items-center gap-1 transition-colors">
            ← All agents
          </Link>
          <div className="mt-16 text-center">
            <p className="text-gray-600 dark:text-gray-600 dark:text-zinc-400 text-lg mb-2">Agent not found.</p>
            <p className="text-gray-500 dark:text-zinc-600 text-sm">This custom agent may have been deleted or the URL is incorrect.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 text-sm mb-8 inline-flex items-center gap-1 transition-colors">
          ← All agents
        </Link>
        <div className="mb-8">
          <div className="text-xs font-mono uppercase tracking-widest mb-3 text-purple-400">
            Custom Audit Agent
          </div>
          <h1 className="text-3xl font-bold mb-2">{agent.name}</h1>
          {agent.description && <p className="text-gray-600 dark:text-zinc-400">{agent.description}</p>}
          <SystemPromptViewer prompt={agent.systemPrompt} />
        </div>
        <AuditPageClient agent={agent} />
      </div>
    </main>
  );
}
