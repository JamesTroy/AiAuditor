'use client';

import { motion } from 'motion/react';
import { fadeUp, staggerContainerSlow } from '@/lib/motion/variants';

// Client wrapper around the auth layout's content area. Animates:
//   1. The logo + title block (slides in first)
//   2. The form card (slides in second, slightly delayed)
// Used by every auth page (login, signup, forgot-password, reset-password,
// two-factor, verify-email, verify-email-pending) via the shared
// app/(auth)/layout.tsx. The individual pages don't need their own entry
// animation classes anymore — animating once at the layout boundary keeps
// every auth screen feeling consistent.

interface Props {
  title: React.ReactNode;
  children: React.ReactNode;
}

export default function AuthAnimatedShell({ title, children }: Props) {
  return (
    <motion.div
      variants={staggerContainerSlow}
      initial="hidden"
      animate="visible"
      className="w-full max-w-md"
    >
      <motion.div variants={fadeUp} className="text-center mb-8 flex flex-col items-center">
        {title}
      </motion.div>
      <motion.div variants={fadeUp}>
        {children}
      </motion.div>
    </motion.div>
  );
}
