import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { agents, getAgent } from '@/lib/agents';
import AuditPageClient from '@/components/AuditPageClient';
import SystemPromptViewer from '@/components/SystemPromptViewer';
import PrepPromptBox from '@/components/PrepPromptBox';
import { BreadcrumbJsonLd } from '@/components/JsonLd';

// VULN-002: Constrains [agent] to only the 4 valid IDs at build time.
// Requests for any other segment hit notFound() below without running server logic.
export function generateStaticParams() {
  return agents.map((a) => ({ agent: a.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { agent: agentId } = await params;
  const agent = getAgent(agentId);
  if (!agent) return {};
  return {
    title: `${agent.name} Audit`,
    description: agent.description.slice(0, 155),
    alternates: { canonical: `/audit/${agent.id}` },
    openGraph: {
      title: `${agent.name} Audit — Claudit`,
      description: agent.description.slice(0, 155),
      url: `/audit/${agent.id}`,
    },
  };
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

  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.consulting';

  // Related agents: same category, excluding self
  const relatedAgents = agents
    .filter((a) => a.category === agent.category && a.id !== agent.id)
    .slice(0, 5);

  return (
    <div id="main-content" tabIndex={-1} className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <BreadcrumbJsonLd
        items={[
          { name: 'Agents', url: BASE_URL },
          { name: agent.category, url: `${BASE_URL}/#${agent.category.toLowerCase().replace(/\s+/g, '-')}` },
          { name: agent.name },
        ]}
      />
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

          <h2 className="text-lg font-semibold mt-6 mb-2">How to use this audit</h2>
          <p className="text-gray-500 dark:text-zinc-500 text-sm">
            This agent uses a specialized system prompt to analyze your code via the Anthropic API. Paste your code below, and results will stream in real-time. You can export the report as Markdown or JSON.
          </p>
          {agent.prepPrompt && <PrepPromptBox prompt={agent.prepPrompt} />}
          <SystemPromptViewer prompt={agent.systemPrompt} />
        </div>

        <AuditPageClient agent={agent} />

        {/* Related agents */}
        {relatedAgents.length > 0 && (
          <section className="mt-12 border-t border-gray-200 dark:border-zinc-800 pt-8">
            <h2 className="text-lg font-semibold mb-4">Related {agent.category} agents</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {relatedAgents.map((related) => (
                <Link
                  key={related.id}
                  href={`/audit/${related.id}`}
                  className="block bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 hover:border-violet-500/30 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">{related.name}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 line-clamp-2">{related.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
