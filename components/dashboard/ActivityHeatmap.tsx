'use client';

import { motion } from 'motion/react';
import { fadeOnly, transitions } from '@/lib/motion/variants';

interface DayBucket {
  /** ISO date string for the day (YYYY-MM-DD). */
  date: string;
  /** Number of audits run on that day. */
  count: number;
}

interface Props {
  /** 90 days of audit counts ending today. Days with zero audits should still be present (count: 0). */
  days: DayBucket[];
}

// GitHub-style activity heatmap.
// - 13 columns x 7 rows (most recent 91 days, rounded to weeks)
// - Each cell is a small rounded square coloured by audit count
// - Tooltip on hover via title attribute (accessible without JS interactions)
// - Motion: subtle fade-in of the whole grid; no per-cell stagger because
//   91 cells would feel busy. The cells animate via CSS hover instead.

const WEEKS_SHOWN = 13;
const DAYS_PER_WEEK = 7;
const TOTAL_CELLS = WEEKS_SHOWN * DAYS_PER_WEEK; // 91

function intensityClass(count: number, max: number): string {
  // Empty cells: deeper baseline so they read as a cell rather than blank space.
  if (count === 0) return 'bg-gray-200 dark:bg-zinc-800';
  if (max === 0) return 'bg-gray-200 dark:bg-zinc-800';
  const pct = count / max;
  if (pct < 0.25) return 'bg-violet-200 dark:bg-violet-900/40';
  if (pct < 0.5) return 'bg-violet-300 dark:bg-violet-800/60';
  if (pct < 0.75) return 'bg-violet-400 dark:bg-violet-700';
  return 'bg-violet-500 dark:bg-violet-500';
}

function formatDateLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ActivityHeatmap({ days }: Props) {
  // Map days array to a quick lookup, then build the 91-cell grid ending today.
  const countByDate = new Map<string, number>(days.map((d) => [d.date, d.count]));
  const max = days.reduce((m, d) => Math.max(m, d.count), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells: { date: string; count: number }[] = [];
  for (let i = TOTAL_CELLS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: iso, count: countByDate.get(iso) ?? 0 });
  }

  const totalAudits = cells.reduce((s, c) => s + c.count, 0);
  const activeDays = cells.filter((c) => c.count > 0).length;

  return (
    <motion.div
      variants={fadeOnly}
      initial="hidden"
      animate="visible"
      className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4"
    >
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <p className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
          Activity — last 90 days
        </p>
        <p className="text-[11px] text-gray-500 dark:text-zinc-500 tabular-nums">
          <span className="font-medium text-gray-700 dark:text-zinc-300">{totalAudits}</span> audits ·{' '}
          <span className="font-medium text-gray-700 dark:text-zinc-300">{activeDays}</span> active days
        </p>
      </div>

      {/* Flex columns of fixed-size cells. Plain CSS grid tracks didn't render
          reliably for empty motion children — flex with explicit w/h does. */}
      <div
        className="flex gap-[3px]"
        role="img"
        aria-label={`Activity heatmap. ${totalAudits} audits across ${activeDays} days in the last 90 days.`}
      >
        {Array.from({ length: WEEKS_SHOWN }, (_, col) => (
          <div key={col} className="flex flex-col gap-[3px]">
            {Array.from({ length: DAYS_PER_WEEK }, (_, row) => {
              const cell = cells[col * DAYS_PER_WEEK + row];
              if (!cell) return null;
              return (
                <motion.div
                  key={cell.date}
                  className={`w-3 h-3 rounded-[2px] ${intensityClass(cell.count, max)} cursor-default`}
                  title={cell.count === 0
                    ? `${formatDateLabel(cell.date)} — no audits`
                    : `${formatDateLabel(cell.date)} — ${cell.count} audit${cell.count === 1 ? '' : 's'}`}
                  whileHover={{ scale: 1.4, transition: transitions.springGentle }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-2.5 text-[11px] text-gray-400 dark:text-zinc-500">
        <span>Less</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-gray-200 dark:bg-zinc-800" />
        <div className="w-2.5 h-2.5 rounded-sm bg-violet-200 dark:bg-violet-900/40" />
        <div className="w-2.5 h-2.5 rounded-sm bg-violet-300 dark:bg-violet-800/60" />
        <div className="w-2.5 h-2.5 rounded-sm bg-violet-400 dark:bg-violet-700" />
        <div className="w-2.5 h-2.5 rounded-sm bg-violet-500 dark:bg-violet-500" />
        <span>More</span>
      </div>
    </motion.div>
  );
}
