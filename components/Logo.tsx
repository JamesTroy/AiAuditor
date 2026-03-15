'use client';

import { useId } from 'react';

export default function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  const uid = useId();
  const g1 = `logo-g1-${uid}`;
  const g2 = `logo-g2-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={g1} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id={g2} x1="180" y1="160" x2="340" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      {/* C arc — lens / scanner rim */}
      <path
        d="M 390 148 A 176 176 0 1 0 390 364"
        stroke={`url(#${g1})`}
        strokeWidth="52"
        strokeLinecap="round"
        fill="none"
      />

      {/* Scan beam tips */}
      <line x1="390" y1="148" x2="440" y2="108" stroke="#8b5cf6" strokeWidth="28" strokeLinecap="round" opacity="0.5" />
      <line x1="390" y1="364" x2="440" y2="404" stroke="#6366f1" strokeWidth="28" strokeLinecap="round" opacity="0.5" />

      {/* Checkmark — the audit verdict */}
      <polyline
        points="190,264 238,312 330,208"
        stroke={`url(#${g2})`}
        strokeWidth="44"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
