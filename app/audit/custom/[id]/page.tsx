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
      <div className="flex-1 flex items-center justify-center text-gray-900 dark:text-zinc-100">
        <span className="text-gray-500 dark:text-zinc-500 motion-safe:animate-pulse text-sm">Loading...</span>
      </div>
    );
  }

  if (agent === null) {
    return (
      <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mt-16 text-center">
            <p className="text-gray-600 dark:text-zinc-400 text-lg mb-2">Audit not found.</p>
            <p className="text-gray-500 dark:text-zinc-500 text-sm">This custom audit may have been deleted or the URL is incorrect.</p>
            <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 mt-4">
              Browse audits →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="text-xs text-gray-400 dark:text-zinc-500 mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-gray-600 dark:hover:text-zinc-400 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-purple-400">Custom</span>
          <span>/</span>
          <span className="text-gray-600 dark:text-zinc-400">{agent.name}</span>
        </nav>
        <div className="mb-8">
          <div className="text-xs font-mono uppercase tracking-widest mb-3 text-purple-400">
            Custom Audit
          </div>
          <h1 className="text-3xl font-bold mb-2">{agent.name}</h1>
          {agent.description && <p className="text-gray-600 dark:text-zinc-400">{agent.description}</p>}
          <p className="text-gray-500 dark:text-zinc-500 text-xs mt-2">
            Custom audits use your own prompt to analyze code. Results stream in real time and are stored in your browser.
          </p>
          <SystemPromptViewer prompt={agent.systemPrompt} />
        </div>
        <AuditPageClient agent={agent} />
      </div>
    </div>
  );
}
