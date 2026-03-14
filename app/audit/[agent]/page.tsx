import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAgent } from '@/lib/agents';
import AuditPageClient from '@/components/AuditPageClient';

interface Props {
  params: Promise<{ agent: string }>;
}

export default async function AgentPage({ params }: Props) {
  const { agent: agentId } = await params;
  const agent = getAgent(agentId);
  if (!agent) notFound();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-300 text-sm mb-8 inline-flex items-center gap-1 transition-colors"
        >
          ← All agents
        </Link>

        <div className="mb-8">
          <div className={`text-xs font-mono uppercase tracking-widest mb-3 ${agent.accentClass.split(' ')[1]}`}>
            Audit Agent
          </div>
          <h1 className="text-3xl font-bold mb-2">{agent.name}</h1>
          <p className="text-zinc-400">{agent.description}</p>
        </div>

        <AuditPageClient agent={agent} />
      </div>
    </main>
  );
}
