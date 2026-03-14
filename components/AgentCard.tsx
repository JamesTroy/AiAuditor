import { AgentConfig } from '@/lib/types';

const icons: Record<string, string> = {
  'code-quality': '⬡',
  'security': '🔒',
  'seo-performance': '📈',
  'accessibility': '♿',
};

export default function AgentCard({ agent }: { agent: AgentConfig }) {
  return (
    <div
      className={`group border rounded-xl p-6 bg-zinc-900 transition-all cursor-pointer ${agent.accentClass}`}
    >
      <div className="text-3xl mb-3">{icons[agent.id]}</div>
      <h2 className="text-xl font-semibold mb-2 text-zinc-100 group-hover:text-white transition-colors">
        {agent.name}
      </h2>
      <p className="text-zinc-400 text-sm leading-relaxed">{agent.description}</p>
      <div className={`mt-4 text-xs font-medium uppercase tracking-widest ${agent.accentClass.split(' ')[1]}`}>
        Start audit →
      </div>
    </div>
  );
}
