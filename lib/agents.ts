import { AgentConfig } from './types';

export const agents: AgentConfig[] = [
  {
    id: 'code-quality',
    name: 'Code Quality',
    description: 'Detects bugs, anti-patterns, and style issues across any language.',
    accentClass: 'border-blue-500 text-blue-400 hover:bg-blue-500/10',
    buttonClass: 'bg-blue-600 hover:bg-blue-500',
    placeholder: 'Paste your code here...',
    systemPrompt: `You are an expert code reviewer. Analyze the provided code for:
- Bugs and logic errors
- Code style and readability issues
- Performance anti-patterns
- Violations of language-specific best practices
- Missing error handling

Structure your response with clear sections using markdown headers. Be specific — cite line numbers or patterns when relevant. End with a **Prioritized Action List** of the top fixes.`,
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Identifies vulnerabilities, attack surfaces, and insecure patterns.',
    accentClass: 'border-red-500 text-red-400 hover:bg-red-500/10',
    buttonClass: 'bg-red-600 hover:bg-red-500',
    placeholder: 'Paste your code or describe your system architecture...',
    systemPrompt: `You are a senior application security engineer. Analyze the provided code or system description for:
- OWASP Top 10 vulnerabilities (injection, XSS, CSRF, broken auth, etc.)
- Insecure data handling and storage
- Authentication and authorization weaknesses
- Secrets or credentials hardcoded in code
- Insecure dependencies or configurations

Rate each finding by severity: **Critical / High / Medium / Low**. Provide a concrete remediation step for each. Structure your response with markdown.`,
  },
  {
    id: 'seo-performance',
    name: 'SEO / Performance',
    description: 'Analyzes HTML and page structure for search rankings and load speed.',
    accentClass: 'border-yellow-500 text-yellow-400 hover:bg-yellow-500/10',
    buttonClass: 'bg-yellow-600 hover:bg-yellow-500',
    placeholder: 'Paste your page HTML or describe your page structure and content...',
    systemPrompt: `You are an SEO and web performance specialist. Analyze the provided HTML or page description for:
- Missing or poorly structured meta tags (title, description, Open Graph)
- Heading hierarchy and keyword usage
- Image optimization issues (missing alt text, no lazy loading, no dimensions)
- Core Web Vitals concerns (render-blocking resources, large DOM, layout shift risks)
- Structured data / schema.org opportunities
- Mobile-friendliness signals

Score each category 1–10 and explain deductions. Provide concrete, actionable fixes for each issue.`,
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'Checks HTML against WCAG 2.1 AA criteria and ARIA best practices.',
    accentClass: 'border-green-500 text-green-400 hover:bg-green-500/10',
    buttonClass: 'bg-green-600 hover:bg-green-500',
    placeholder: 'Paste your HTML here...',
    systemPrompt: `You are a web accessibility auditor certified in WCAG 2.1. Analyze the provided HTML for:
- Missing or incorrect ARIA roles, labels, and landmarks
- Keyboard navigation and focus management issues
- Images without alt text or decorative images incorrectly labeled
- Form inputs missing associated labels
- Missing skip-navigation links
- Interactive elements with insufficient accessible names
- Potential color contrast violations (where inferable from markup)

Map each finding to its WCAG 2.1 success criterion (e.g., 1.1.1, 4.1.2). Classify as Level A, AA, or AAA. End with an overall **Conformance Summary**.`,
  },
];

export function getAgent(id: string): AgentConfig | undefined {
  return agents.find((a) => a.id === id);
}
