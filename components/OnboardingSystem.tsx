'use client';

import { useState, useEffect, useRef, useCallback, createContext, useContext, type ReactNode } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = 'welcome' | 'tour' | 'done';

interface OnboardingContextValue {
  phase: Phase;
  stepIdx: number;
  tourIdx: number;
  nextStep: () => void;
  prevStep: () => void;
  nextTour: () => void;
  skipTour: () => void;
  startTour: () => void;
  finish: () => void;
  restart: () => void;
  isActive: boolean;
}

// ── Context ──────────────────────────────────────────────────────────────────

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'claudit_onboarding_complete';

const WELCOME_STEPS = [
  {
    icon: '🔍',
    title: 'Welcome to Claudit',
    body: 'Your AI code auditor. Paste any code and get severity-rated findings across security, performance, accessibility, and more — with the exact fix for each issue.',
    cta: 'Get started',
  },
  {
    icon: '📋',
    title: 'Paste code, pick auditors',
    body: 'Paste a file, a module, or a whole feature — any language. Claudit auto-selects the right auditors for your code, or you can pick specific ones like Security, React Patterns, or SQL.',
    cta: 'Next',
  },
  {
    icon: '⚡',
    title: 'Findings rated by severity',
    body: 'Every finding is tagged Critical, High, Medium, or Low with a confidence level — certain means confirmed in your code, likely means probable but verify first. Dismiss anything that doesn\'t apply.',
    cta: 'Next',
  },
  {
    icon: '✅',
    title: 'Fix it, then re-run',
    body: 'Each finding includes the exact code snippet, what\'s wrong, and how to fix it. After fixing, re-run the audit to confirm the issue is resolved and watch your score climb.',
    cta: 'Show me around →',
  },
];

const TOUR_STEPS = [
  {
    targetId: 'code-input',
    title: 'Paste your code here',
    body: 'Any language, any size. A single function, a full file, or an entire module — Claudit handles it all.',
    position: 'bottom' as const,
  },
  {
    targetId: 'agent-picker',
    title: 'Choose your auditors',
    body: '190 specialized auditors across security, performance, accessibility, code quality, SEO, and more. Claudit auto-selects based on your code, or pick manually.',
    position: 'bottom' as const,
  },
  {
    targetId: 'run-audit-btn',
    title: 'Run the audit',
    body: 'Results stream in real time — you\'ll see findings appear as each auditor finishes. Most audits complete in under 60 seconds.',
    position: 'bottom' as const,
  },
  {
    targetId: 'findings-triage',
    title: 'Review and triage findings',
    body: 'Findings are ranked by severity. Dismiss false positives, and your estimated score adjusts instantly. Each finding links to the exact code.',
    position: 'top' as const,
  },
  {
    targetId: 'dashboard-history',
    title: 'Track your audit history',
    body: 'Every audit is saved to your dashboard. Re-run after fixing issues to measure progress and build a quality baseline over time.',
    position: 'top' as const,
  },
];

// ── Provider ─────────────────────────────────────────────────────────────────

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('done');
  const [stepIdx, setStepIdx] = useState(0);
  const [tourIdx, setTourIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setPhase('welcome');
    } catch {
      // localStorage unavailable (SSR, private browsing) — skip onboarding
    }
  }, []);

  const isActive = mounted && phase !== 'done';

  const nextStep = useCallback(() => {
    if (stepIdx < WELCOME_STEPS.length - 1) {
      setStepIdx((s) => s + 1);
    } else {
      setPhase('tour');
      setTourIdx(0);
    }
  }, [stepIdx]);

  const prevStep = useCallback(() => {
    if (stepIdx > 0) setStepIdx((s) => s - 1);
  }, [stepIdx]);

  const finish = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
    setPhase('done');
  }, []);

  const nextTour = useCallback(() => {
    if (tourIdx < TOUR_STEPS.length - 1) {
      setTourIdx((t) => t + 1);
    } else {
      finish();
    }
  }, [tourIdx, finish]);

  const skipTour = useCallback(() => { finish(); }, [finish]);

  const startTour = useCallback(() => {
    setPhase('tour');
    setTourIdx(0);
  }, []);

  const restart = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setStepIdx(0);
    setTourIdx(0);
    setPhase('welcome');
  }, []);

  return (
    <OnboardingContext.Provider
      value={{ phase, stepIdx, tourIdx, nextStep, prevStep, nextTour, skipTour, startTour, finish, restart, isActive }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

// ── Welcome Modal ────────────────────────────────────────────────────────────

export function WelcomeModal() {
  const { phase, stepIdx, nextStep, prevStep, skipTour } = useOnboarding();
  const modalRef = useRef<HTMLDivElement>(null);

  // Trap focus inside modal + handle Escape
  useEffect(() => {
    if (phase !== 'welcome') return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { skipTour(); return; }
      if (e.key !== 'Tab') return;

      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    // Focus the CTA button on mount
    requestAnimationFrame(() => {
      modalRef.current?.querySelector<HTMLElement>('[data-cta]')?.focus();
    });
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [phase, stepIdx, skipTour]);

  if (phase !== 'welcome') return null;

  const step = WELCOME_STEPS[stepIdx];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl w-[400px] max-w-[92vw] p-7"
      >
        {/* Progress dots */}
        <div className="flex gap-1.5 mb-6" role="progressbar" aria-valuenow={stepIdx + 1} aria-valuemax={WELCOME_STEPS.length} aria-label={`Step ${stepIdx + 1} of ${WELCOME_STEPS.length}`}>
          {WELCOME_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < stepIdx
                  ? 'bg-violet-500 w-4'
                  : i === stepIdx
                    ? 'bg-violet-500 w-6'
                    : 'bg-gray-200 dark:bg-zinc-700 w-4'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="text-3xl mb-4 select-none" aria-hidden="true">{step.icon}</div>

        {/* Content */}
        <h2 id="onboarding-title" className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2 leading-snug">
          {step.title}
        </h2>
        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-7">{step.body}</p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevStep}
            className={`text-sm text-gray-500 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 ${
              stepIdx === 0 ? 'invisible' : ''
            }`}
          >
            Back
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={skipTour}
              className="text-xs text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
            >
              Skip
            </button>
            <button
              data-cta
              onClick={nextStep}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors focus-ring"
            >
              {step.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Guided Tour ──────────────────────────────────────────────────────────────

export function GuidedTour() {
  const { phase, tourIdx, nextTour, skipTour } = useOnboarding();
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const tour = TOUR_STEPS[tourIdx];

  useEffect(() => {
    if (phase !== 'tour') return;

    function positionTip() {
      const target = document.getElementById(tour.targetId);
      if (!target) {
        // Target not on this page — skip to next step
        return;
      }

      const rect = target.getBoundingClientRect();
      const GAP = 12;
      const TIP_W = 280;
      const TIP_H = 180;

      let top = 0;
      let left = 0;

      if (tour.position === 'bottom') {
        top = rect.bottom + window.scrollY + GAP;
        left = Math.max(16, Math.min(rect.left + window.scrollX, window.innerWidth - TIP_W - 16));
      } else if (tour.position === 'top') {
        top = rect.top + window.scrollY - TIP_H - GAP;
        left = Math.max(16, Math.min(rect.left + window.scrollX, window.innerWidth - TIP_W - 16));
      } else if (tour.position === 'right') {
        top = rect.top + window.scrollY;
        left = rect.right + window.scrollX + GAP;
      } else if (tour.position === 'left') {
        top = rect.top + window.scrollY;
        left = Math.max(16, rect.left + window.scrollX - TIP_W - GAP);
      }

      setTipPos({ top, left });

      // Scroll target into view if needed
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Highlight the target
      target.setAttribute('data-tour-highlight', 'true');
      target.style.position = 'relative';
      target.style.zIndex = '51';
    }

    positionTip();

    // Debounced reposition on resize — prevents layout thrash during drag-resize.
    // Scroll uses rAF gating instead of debounce for smoother tracking.
    let resizeTimer: ReturnType<typeof setTimeout>;
    function debouncedResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(positionTip, 100);
    }

    let scrollRafId: number | null = null;
    function rafScroll() {
      if (scrollRafId !== null) return; // already queued
      scrollRafId = requestAnimationFrame(() => {
        positionTip();
        scrollRafId = null;
      });
    }

    window.addEventListener('resize', debouncedResize);
    window.addEventListener('scroll', rafScroll, { passive: true });

    return () => {
      clearTimeout(resizeTimer);
      if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('scroll', rafScroll);
      // Remove highlight from current target
      const target = document.getElementById(tour.targetId);
      if (target) {
        target.removeAttribute('data-tour-highlight');
        target.style.zIndex = '';
      }
    };
  }, [phase, tourIdx, tour]);

  // Handle Escape key
  useEffect(() => {
    if (phase !== 'tour') return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') skipTour();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [phase, skipTour]);

  // Focus the Next button when tooltip appears
  useEffect(() => {
    if (tipPos) {
      requestAnimationFrame(() => {
        tipRef.current?.querySelector<HTMLElement>('[data-tour-next]')?.focus();
      });
    }
  }, [tipPos]);

  if (phase !== 'tour') return null;

  const isLast = tourIdx === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Scrim */}
      <div className="fixed inset-0 z-40 bg-black/40" aria-hidden="true" />

      {/* Tooltip */}
      {tipPos && (
        <div
          ref={tipRef}
          role="dialog"
          aria-label={`Tour step ${tourIdx + 1} of ${TOUR_STEPS.length}: ${tour.title}`}
          className="absolute z-[100] w-[280px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xl p-4 motion-safe:animate-fade-up"
          style={{ top: tipPos.top, left: tipPos.left }}
        >
          <div className="text-xs font-medium text-violet-500 dark:text-violet-400 mb-1.5">
            {tourIdx + 1} of {TOUR_STEPS.length}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-1.5">{tour.title}</h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mb-4">{tour.body}</p>
          <div className="flex items-center justify-between">
            <button
              onClick={skipTour}
              className="text-xs text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
            >
              Skip tour
            </button>
            <button
              data-tour-next
              onClick={nextTour}
              className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors focus-ring"
            >
              {isLast ? 'Done ✓' : 'Next →'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Empty State (for dashboard) ──────────────────────────────────────────────

interface EmptyAuditStateProps {
  onRunAudit?: () => void;
}

export function EmptyAuditState({ onRunAudit }: EmptyAuditStateProps) {
  const { startTour } = useOnboarding();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-2xl mb-5 select-none" aria-hidden="true">
        📋
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">Run your first audit</h2>
      <p className="text-sm text-gray-500 dark:text-zinc-500 leading-relaxed max-w-xs mb-6">
        Paste any code and Claudit will analyze it across security, performance, accessibility, and more — with the exact fix for each issue.
      </p>
      <button
        onClick={onRunAudit}
        className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors focus-ring mb-8"
      >
        Paste code to get started
      </button>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {['Security', 'Performance', 'Accessibility', 'Code Quality', 'SEO', 'React Patterns'].map((cat) => (
          <span
            key={cat}
            className="text-xs text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full px-3 py-1"
          >
            {cat}
          </span>
        ))}
      </div>

      <button
        onClick={startTour}
        className="text-xs text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 underline underline-offset-4 transition-colors"
      >
        Take a quick tour
      </button>
    </div>
  );
}
