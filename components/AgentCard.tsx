import { memo } from 'react';
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
  'ux-review': '🎨',
  'design-system': '🧩',
  'responsive-design': '📐',
  'color-typography': '🎭',
  'motion-interaction': '✨',
  'documentation': '📖',
  'dependency-security': '🔍',
  'auth-review': '🛡️',
  'frontend-performance': '🚀',
  'caching': '⚡',
  'memory-profiler': '🧠',
  'cloud-infra': '☁️',
  'observability': '📡',
  'database-infra': '🗃️',
};

const BUILT_IN_ICON_LABELS: Record<string, string> = {
  'code-quality': 'hexagon',
  'security': 'lock',
  'seo-performance': 'chart',
  'accessibility': 'accessibility symbol',
  'sql': 'database',
  'api-design': 'plug',
  'devops': 'whale',
  'performance': 'lightning bolt',
  'privacy': 'lock with key',
  'test-quality': 'test tube',
  'architecture': 'construction',
  'ux-review': 'palette',
  'design-system': 'puzzle piece',
  'responsive-design': 'ruler',
  'color-typography': 'masks',
  'motion-interaction': 'sparkles',
  'documentation': 'open book',
  'dependency-security': 'magnifying glass',
  'auth-review': 'shield',
  'frontend-performance': 'rocket',
  'caching': 'lightning bolt',
  'memory-profiler': 'brain',
  'cloud-infra': 'cloud',
  'observability': 'satellite dish',
  'database-infra': 'card index dividers',
};

const DEFAULT_CUSTOM_ICON = '✦';

interface Props {
  agent: AgentConfig;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
}

// PERF-022: React.memo prevents re-render when parent state changes but this card's props haven't.
export default memo(function AgentCard({ agent, onEdit, onDelete, onToggleFavorite, isFavorite }: Props) {
  const icon = BUILT_IN_ICONS[agent.id] ?? DEFAULT_CUSTOM_ICON;
  const iconLabel = BUILT_IN_ICON_LABELS[agent.id] ?? 'custom agent';
  const isCustom = !(agent.id in BUILT_IN_ICONS);

  // Robust text-color extraction — don't rely on positional splitting
  const accentTextClass = agent.accentClass.split(' ').find((c) => c.startsWith('text-')) ?? '';

  return (
    <article
      className={`group relative overflow-hidden border border-gray-200 dark:border-zinc-800 rounded-xl p-6 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-200 cursor-pointer motion-safe:hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 dark:hover:shadow-black/40 hover:border-violet-500/30 dark:hover:border-violet-500/20 ${agent.accentClass}`}
    >
      {/* Gradient top-edge shine */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800/80 flex items-center justify-center">
          <span role="img" aria-label={iconLabel} className="text-xl">{icon}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(); }}
              className={`text-sm px-1.5 py-1 min-h-[32px] min-w-[32px] rounded transition-colors hover:bg-gray-200 dark:hover:bg-zinc-700 focus-ring ${isFavorite ? 'text-yellow-400' : 'text-gray-400 dark:text-zinc-600 hover:text-yellow-400'}`}
              aria-label={isFavorite ? `Unpin ${agent.name}` : `Pin ${agent.name}`}
              aria-pressed={isFavorite ?? false}
            >
              {isFavorite ? '⭐' : '☆'}
            </button>
          )}
          {isCustom && onEdit && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
              className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 min-h-[32px] rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors focus-ring"
              aria-label={`Edit ${agent.name}`}
            >
              Edit
            </button>
          )}
          {isCustom && onDelete && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
              className="text-xs text-gray-500 dark:text-zinc-500 hover:text-red-400 px-2 py-1 min-h-[32px] rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors focus-ring"
              aria-label={`Delete ${agent.name}`}
            >
              Delete
            </button>
          )}
        </div>
      </div>
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
        {agent.name}
      </h3>
      <p className="text-gray-600 dark:text-zinc-400 text-sm leading-relaxed">{agent.description}</p>
      <div className={`mt-4 text-xs font-medium uppercase tracking-widest ${accentTextClass} flex items-center gap-1`}>
        Start audit <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
      </div>
    </article>
  );
});
