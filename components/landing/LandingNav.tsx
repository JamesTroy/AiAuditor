'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { fadeUp, staggerContainer } from '@/lib/motion/variants';

export function LandingNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60">
      <motion.nav
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between"
      >
        <motion.div variants={fadeUp}>
          <Link href="/" className="flex items-center gap-2.5 no-underline group">
            <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center text-white text-sm select-none group-hover:bg-violet-500 transition-colors">
              C
            </div>
            <span className="text-lg font-semibold text-zinc-100 tracking-tight">Claudit</span>
          </Link>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          className="hidden md:flex items-center gap-8 text-sm text-zinc-400"
        >
          <motion.div variants={fadeUp}><Link href="#how-it-works" className="hover:text-zinc-100 transition-colors">How it works</Link></motion.div>
          <motion.div variants={fadeUp}><Link href="#features" className="hover:text-zinc-100 transition-colors">Features</Link></motion.div>
          <motion.div variants={fadeUp}><Link href="#pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link></motion.div>
          <motion.div variants={fadeUp}><Link href="/about" className="hover:text-zinc-100 transition-colors">About</Link></motion.div>
        </motion.div>

        <motion.div variants={fadeUp} className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Link href="/audit" className="px-4 py-2 text-sm text-zinc-300 hover:text-white transition-colors">New audit</Link>
              <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors">Dashboard &rarr;</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">Sign in</Link>
              <Link href="/signup" className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors">Start free &rarr;</Link>
            </>
          )}
        </motion.div>
      </motion.nav>
    </header>
  );
}
