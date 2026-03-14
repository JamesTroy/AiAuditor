// VULN-010: Safe ReactMarkdown component overrides.
// - Links: only allow http/https hrefs; always open in new tab with noopener.
//   Blocks javascript: and data: URIs that could be injected via LLM output.
// - Images: disabled entirely — audit results don't need images, and this
//   eliminates the model-output image-src exfiltration vector.
import React from 'react';
import type { Components } from 'react-markdown';

export const markdownComponents: Components = {
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
