'use client';

import { memo } from 'react';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { AgentConfig } from '@/lib/types';
import {
  Hexagon, Lock, TrendingUp, Accessibility, Database, Plug, Container,
  Zap, KeyRound, TestTube2, Building2, Palette, Puzzle, Ruler,
  Theater, Sparkles, BookOpen, Search, ShieldCheck, Rocket,
  Brain, Cloud, Radio, Archive, ShieldAlert, AlertTriangle,
  Diamond, Atom, Globe, TrafficCone, ClipboardList, RefreshCw,
  Wrench, Regex, Package, Cable, Globe2, BarChart3,
  FileText, Moon, Mail, Settings, FileCode, Shuffle, Bookmark,
  Star, StarOff, type LucideIcon,
} from 'lucide-react';

const BUILT_IN_ICONS: Record<string, LucideIcon> = {
  'code-quality': Hexagon,
  'security': Lock,
  'seo-performance': TrendingUp,
  'accessibility': Accessibility,
  'sql': Database,
  'api-design': Plug,
  'devops': Container,
  'performance': Zap,
  'privacy': KeyRound,
  'test-quality': TestTube2,
  'architecture': Building2,
  'ux-review': Palette,
  'design-system': Puzzle,
  'responsive-design': Ruler,
  'color-typography': Theater,
  'motion-interaction': Sparkles,
  'documentation': BookOpen,
  'dependency-security': Search,
  'auth-review': ShieldCheck,
  'frontend-performance': Rocket,
  'caching': Zap,
  'memory-profiler': Brain,
  'cloud-infra': Cloud,
  'observability': Radio,
  'database-infra': Archive,
  'data-security': ShieldAlert,
  'error-handling': AlertTriangle,
  'typescript-strictness': Diamond,
  'react-patterns': Atom,
  'i18n': Globe,
  'rate-limiting': TrafficCone,
  'logging': ClipboardList,
  'database-migrations': RefreshCw,
  'concurrency': Zap,
  'ci-cd': Wrench,
  'regex-review': Regex,
  'monorepo': Package,
  'graphql': Diamond,
  'websocket': Cable,
  'container-security': Container,
  'cors-headers': Globe2,
  'seo-technical': Search,
  'bundle-size': BarChart3,
  'forms-validation': FileText,
  'dark-mode': Moon,
  'email-templates': Mail,
  'env-config': Settings,
  'openapi': FileCode,
  'state-machines': Shuffle,
  'pagination': Bookmark,
};

interface Props {
  agent: AgentConfig;
  href?: string;
  index?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
}

// PERF-022: React.memo prevents re-render when parent state changes but this card's props haven't.
export default memo(function AgentCard({ agent, href, index = 0, onEdit, onDelete, onToggleFavorite, isFavorite }: Props) {
  const IconComponent = BUILT_IN_ICONS[agent.id] ?? null;
  const isCustom = !(agent.id in BUILT_IN_ICONS);

  // Robust text-color extraction — don't rely on positional splitting
  const accentTextClass = agent.accentClass.split(' ').find((c) => c.startsWith('text-')) ?? '';

  const cardHref = href ?? `/audit/${agent.id}`;

  return (
    <m.div
      className={`group relative overflow-hidden border border-gray-200 dark:border-zinc-800 rounded-xl p-6 bg-white/95 dark:bg-zinc-900/80 ${agent.accentClass}`}
      initial={false}
      whileHover={{
        scale: 1.03,
        borderColor: 'rgba(139, 92, 246, 0.3)',
        boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.4)',
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Full-coverage link — sits behind content but covers the entire card */}
      <Link
        href={cardHref}
        className="absolute inset-0 z-0 focus-ring rounded-xl"
        aria-label={`${agent.name} — ${agent.description}`}
        tabIndex={0}
      />

      {/* Card content — pointer-events-none so clicks fall through to the link */}
      <div className="relative z-10 pointer-events-none">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800/80 flex items-center justify-center">
            {IconComponent ? (
              <IconComponent className="w-5 h-5 text-gray-700 dark:text-zinc-300" aria-hidden="true" />
            ) : (
              <span className="text-xl text-gray-700 dark:text-zinc-300" aria-hidden="true">&#10022;</span>
            )}
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
          {agent.name}
        </h3>
        <p className="text-gray-600 dark:text-zinc-400 text-sm leading-relaxed">{agent.description}</p>
        <div className={`mt-4 text-xs font-medium uppercase tracking-widest ${accentTextClass} flex items-center gap-1`}>
          Start audit <span className="inline-block transition-transform group-hover:translate-x-1">&rarr;</span>
        </div>
      </div>

      {/* Action buttons — positioned above the link with pointer-events restored */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 touch-show transition-opacity pointer-events-auto">
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className={`text-sm px-1.5 py-1 min-h-[44px] min-w-[44px] rounded transition-colors hover:bg-gray-200 dark:hover:bg-zinc-700 focus-ring ${isFavorite ? 'text-yellow-400' : 'text-gray-400 dark:text-zinc-600 hover:text-yellow-400'}`}
            aria-label={isFavorite ? `Unpin ${agent.name}` : `Pin ${agent.name}`}
            aria-pressed={isFavorite ?? false}
          >
            {isFavorite ? <Star className="w-5 h-5 fill-current" /> : <StarOff className="w-5 h-5" />}
          </button>
        )}
        {isCustom && onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 min-h-[44px] rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors focus-ring"
            aria-label={`Edit ${agent.name}`}
          >
            Edit
          </button>
        )}
        {isCustom && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-xs text-gray-500 dark:text-zinc-500 hover:text-red-400 px-2 py-1 min-h-[44px] rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors focus-ring"
            aria-label={`Delete ${agent.name}`}
          >
            Delete
          </button>
        )}
      </div>
    </m.div>
  );
});
