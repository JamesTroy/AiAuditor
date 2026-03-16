// VULN-006 / VULN-010: Centralised safe ReactMarkdown rendering.
//
// Security measures applied here:
// - disallowedElements: explicitly block script, iframe, object, embed, form
//   even though react-markdown v9 disables raw HTML by default (defense-in-depth).
// - Links: only allow http/https hrefs; always open in new tab with noopener.
//   Blocks javascript: and data: URIs that could be injected via LLM output.
// - Images: disabled entirely — audit results don't need images, and this
//   eliminates the model-output image-src exfiltration vector.
'use client';

import React, { lazy, Suspense } from 'react';
import type { Components } from 'react-markdown';

// PERF-022: Lazy-load react-markdown (~45KB gzipped). During streaming the UI
// uses a <pre> tag, so this module is only needed after audit completion.
const ReactMarkdown = lazy(() => import('react-markdown'));

const DISALLOWED_ELEMENTS = ['script', 'iframe', 'object', 'embed', 'form'];

// PERF-005: Cache slugified headings to avoid redundant regex work on re-renders.
const MAX_SLUG_CACHE = 500;
const slugCache = new Map<string, string>();

/** Convert heading text to a URL-friendly slug. */
function slugify(text: string): string {
  const cached = slugCache.get(text);
  if (cached) return cached;
  const slug = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  if (slugCache.size >= MAX_SLUG_CACHE) {
    slugCache.delete(slugCache.keys().next().value!);
  }
  slugCache.set(text, slug);
  return slug;
}

/** Extract plain text from react-markdown children. */
function childrenToText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(childrenToText).join('');
  return '';
}

const components: Components = {
  h1: ({ children }) => <h1 id={slugify(childrenToText(children))}>{children}</h1>,
  h2: ({ children }) => <h2 id={slugify(childrenToText(children))} className="scroll-mt-20">{children}</h2>,
  h3: ({ children }) => <h3 id={slugify(childrenToText(children))}>{children}</h3>,
  h4: ({ children }) => <h4 id={slugify(childrenToText(children))}>{children}</h4>,
  a({ href, children, ...props }) {
    // VULN-006: Strict URL validation — only allow http/https via URL parser.
    // Blocks javascript:, data:, vbscript:, and malformed URLs.
    let safeHref: string | undefined;
    if (href) {
      try {
        const parsed = new URL(href);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          safeHref = href;
        }
      } catch { /* invalid URL — leave safeHref undefined */ }
    }
    return (
      <a {...props} href={safeHref} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  img() {
    // Block all images from model output.
    return null;
  },
};

interface Props {
  children: string;
  className?: string;
}

/** Drop-in replacement for ReactMarkdown with all security settings applied. */
export default function SafeMarkdown({ children, className }: Props) {
  return (
    <Suspense fallback={<pre className="whitespace-pre-wrap font-mono text-sm">{children}</pre>}>
      <ReactMarkdown
        disallowedElements={DISALLOWED_ELEMENTS}
        unwrapDisallowed
        components={components}
        className={className}
      >
        {children}
      </ReactMarkdown>
    </Suspense>
  );
}

// Named export kept for any legacy imports of the components map directly.
export const markdownComponents = components;
