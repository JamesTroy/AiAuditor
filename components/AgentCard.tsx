import { AgentConfig } from '@/lib/types';

const BUILT_IN_ICONS: Record<string, string> = {
  'code-quality': '⬡',
  'security': '🔒',
  'seo-performance': '📈',
  'accessibility': '♿',
  'sql': '🗄️',
  'api-design': '🔌',
  'devops': '🐳',
  'performance': '⚡',
  'privacy': '🔐',
  'test-quality': '🧪',
  'architecture': '🏗️',
};

const DEFAULT_CUSTOM_ICON = '✦';

interface Props {
  agent: AgentConfig;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
}

export default function AgentCard({ agent, onEdit, onDelete, onToggleFavorite, isFavorite }: Props) {
  const icon = BUILT_IN_ICONS[agent.id] ?? DEFAULT_CUSTOM_ICON;
  const isCustom = !(agent.id in BUILT_IN_ICONS);

  return (
    <div
      className={`group border rounded-xl p-6 bg-white dark:bg-zinc-900 transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 dark:hover:shadow-black/40 ${agent.accentClass}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-3xl">{icon}</div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(); }}
              className={`text-sm px-1.5 py-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-zinc-700 ${isFavorite ? 'text-yellow-400' : 'text-gray-400 dark:text-zinc-600 hover:text-yellow-400'}`}
              aria-label={isFavorite ? `Unpin ${agent.name}` : `Pin ${agent.name}`}
            >
              {isFavorite ? '⭐' : '☆'}
            </button>
          )}
          {isCustom && onEdit && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
              className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
              aria-label={`Edit ${agent.name}`}
            >
              Edit
            </button>
          )}
          {isCustom && onDelete && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
              className="text-xs text-gray-500 dark:text-zinc-500 hover:text-red-400 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
              aria-label={`Delete ${agent.name}`}
            >
              Delete
            </button>
          )}
        </div>
      </div>
      <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
        {agent.name}
      </h2>
      <p className="text-gray-600 dark:text-zinc-400 text-sm leading-relaxed">{agent.description}</p>
      <div className={`mt-4 text-xs font-medium uppercase tracking-widest ${agent.accentClass.split(' ')[1]}`}>
        Start audit →
      </div>
    </div>
  );
}
