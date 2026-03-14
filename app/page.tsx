import Link from 'next/link';
import { agents } from '@/lib/agents';
import AgentCard from '@/components/AgentCard';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 tracking-tight">AI Audit</h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Instant AI-powered audits for code quality, security, SEO, and accessibility.
            Powered by Claude.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {agents.map((agent) => (
            <Link key={agent.id} href={`/audit/${agent.id}`} className="block">
              <AgentCard agent={agent} />
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
