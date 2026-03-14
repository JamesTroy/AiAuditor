import Link from 'next/link';
import { notFound } from 'next/navigation';
import { agents, getAgent } from '@/lib/agents';
import AuditPageClient from '@/components/AuditPageClient';
import SystemPromptViewer from '@/components/SystemPromptViewer';
import PrepPromptBox from '@/components/PrepPromptBox';

// VULN-002: Constrains [agent] to only the 4 valid IDs at build time.
// Requests for any other segment hit notFound() below without running server logic.
export function generateStaticParams() {
  return agents.map((a) => ({ agent: a.id }));
}

// ARCH-019: ISR — revalidate every hour so custom-agent edits are reflected
// without a full redeploy. Static pages remain fast but stay reasonably fresh.
export const revalidate = 3600;

interface Props {
  params: Promise<{ agent: string }>;
}

export default async function AgentPage({ params }: Props) {
  const { agent: agentId } = await params;
  const agent = getAgent(agentId);
  if (!agent) notFound();

  return (
    <div id="main-content" tabIndex={-1} className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="text-xs text-gray-400 dark:text-zinc-600 mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-gray-600 dark:hover:text-zinc-400 transition-colors">Agents</Link>
          <span>/</span>
          <span className={agent.accentClass.split(' ').find((c) => c.startsWith('text-')) ?? ''}>{agent.category}</span>
          <span>/</span>
          <span className="text-gray-600 dark:text-zinc-400">{agent.name}</span>
        </nav>

        <div className="mb-8">
          <div className={`text-xs font-mono uppercase tracking-widest mb-3 ${agent.accentClass.split(' ').find((c) => c.startsWith('text-')) ?? ''}`}>
            Audit Agent · Claude Sonnet 4.6
          </div>
          <h1 className="text-3xl font-bold mb-2">{agent.name}</h1>
          <p className="text-gray-600 dark:text-zinc-400">{agent.description}</p>
          <p className="text-gray-500 dark:text-zinc-500 text-xs mt-2">
            This agent uses a specialized system prompt to analyze your code via the Anthropic API. Results stream in real-time and can be exported as Markdown or JSON.
          </p>
          {agent.prepPrompt && <PrepPromptBox prompt={agent.prepPrompt} />}
          <SystemPromptViewer prompt={agent.systemPrompt} />
        </div>

        <AuditPageClient agent={agent} />
      </div>
    </div>
  );
}
