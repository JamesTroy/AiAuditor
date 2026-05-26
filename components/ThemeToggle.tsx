'use client';

import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from './ThemeProvider';
import { transitions, tapScale } from '@/lib/motion/variants';

// Theme toggle with a sun↔moon icon swap that rotates the outgoing icon
// out and rotates the incoming one in. Subtle but satisfying — and it's the
// micro-interaction every visitor touches first when they want to test
// "does this site actually feel alive."
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <motion.button
      onClick={toggle}
      whileTap={tapScale}
      className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors focus-ring relative overflow-hidden"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1, transition: transitions.springGentle }}
          exit={{ opacity: 0, rotate: 90, scale: 0.7, transition: transitions.snappy }}
          className="flex items-center justify-center"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
