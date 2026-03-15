// VULN-006 / VULN-010: Centralised safe ReactMarkdown rendering.
//
// Security measures applied here:
// - disallowedElements: explicitly block script, iframe, object, embed, form
//   even though react-markdown v9 disables raw HTML by default (defense-in-depth).
// - Links: only allow http/https hrefs; always open in new tab with noopener.
//   Blocks javascript: and data: URIs that could be injected via LLM output.
// - Images: disabled entirely — audit results don't need images, and this
//   eliminates the model-output image-src exfiltration vector.
import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

const DISALLOWED_ELEMENTS = ['script', 'iframe', 'object', 'embed', 'form'];

/** Convert heading text to a URL-friendly slug. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
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
    const safeHref = href && /^https?:\/\//i.test(href) ? href : undefined;
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
    <ReactMarkdown
      disallowedElements={DISALLOWED_ELEMENTS}
      unwrapDisallowed
      components={components}
      className={className}
    >
      {children}
    </ReactMarkdown>
  );
}

// Named export kept for any legacy imports of the components map directly.
export const markdownComponents = components;
