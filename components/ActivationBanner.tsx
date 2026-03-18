'use client';

import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { useState, useEffect } from 'react';

export default function ActivationBanner() {
  const { data: session } = useSession();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!session) { setDismissed(true); return; }
    // Show banner only if user hasn't dismissed it this session
    const key = 'claudit-activation-dismissed';
    setDismissed(sessionStorage.getItem(key) === '1');
  }, [session]);

  if (!session || dismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem('claudit-activation-dismissed', '1');
    setDismissed(true);
  }

  return (
    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm py-2.5 px-4 flex items-center justify-center gap-2 relative">
      <span>Try it on your own site — enter any public URL, get a severity-rated report in under 60 seconds.</span>
      <Link href="/audit" className="underline font-semibold hover:text-violet-200 transition-colors whitespace-nowrap">
        Run your first audit →
      </Link>
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-1"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
