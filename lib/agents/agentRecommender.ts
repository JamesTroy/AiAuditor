// WORKFLOW-10: Auto-detected multi-agent recommendation.
// After detectAgents() runs, compute a weighted relevance score for each
// recommended agent based on tag specificity and match count. Returns the
// top 5 most-relevant agents with explanations.

import { detectAgents } from '@/lib/detectAgents';

export interface AgentRecommendation {
  agentId: string;
  /** Relevance score (0-100). */
  relevance: number;
  /** Why this agent was recommended. */
  reason: string;
  /** Tags that matched for this agent. */
  matchedTags: string[];
}

export interface RecommendationResult {
  /** Top recommended agents, sorted by relevance. */
  recommendations: AgentRecommendation[];
  /** Detected language. */
  language: string | null;
  /** Detected framework. */
  framework: string | null;
  /** All detected tags. */
  detectedTags: string[];
}

// Tag specificity: inversely proportional to how many agents a tag maps to.
// Tags that map to few agents are more specific and thus more valuable.
// These values are derived from the TAG_TO_AGENTS map in detectAgents.ts.
const TAG_SPECIFICITY: Record<string, number> = {
  // Very specific tags (map to 1-2 agents) — high value
  'graphql': 90,
  'websocket': 90,
  'regex': 95,
  'i18n': 95,
  'state-machines': 90,
  'email': 95,
  'dark-mode': 90,
  'svelte': 85,
  'solidjs': 85,
  'astro': 85,
  'trpc': 85,

  // Moderately specific (map to 2-3 agents)
  'react': 75,
  'nextjs': 70,
  'express': 70,
  'orm': 70,
  'docker': 70,
  'sql': 75,
  'auth': 70,
  'forms': 75,
  'migrations': 75,
  'cors': 75,
  'bundle': 75,
  'tailwind': 70,
  'hono': 80,
  'fastify': 80,
  'nestjs': 65,

  // General tags (map to many agents) — lower value
  'typescript': 50,
  'javascript': 55,
  'python': 55,
  'go': 50,
  'rust': 50,
  'java': 45,
  'csharp': 40,
  'kotlin': 45,
  'swift': 45,
  'scala': 45,
  'elixir': 50,

  // Pattern tags (variable specificity)
  'api': 55,
  'testing': 65,
  'logging': 70,
  'caching': 70,
  'concurrency': 65,
  'accessibility': 65,
  'responsive': 70,
  'env-config': 70,
  'client-storage': 65,
  'error-handling': 60,
  'rate-limiting': 75,
  'pagination': 75,
  'openapi': 80,
  'observability': 70,
  'ci-cd': 65,
  'container': 60,
  'bloat': 75,
  'marketing': 80,
  'dx': 80,
  'navigation': 70,
  'micro-interactions': 75,
  'error-ux': 70,
  'mobile-ux': 70,
  'data-viz': 75,
  'content': 65,
  'onboarding': 75,
  'search': 70,
  'tables': 75,
  'notifications': 70,
  'spacing': 65,
};

// Default specificity for unknown tags
const DEFAULT_SPECIFICITY = 50;

// Agent descriptions for explaining recommendations
const AGENT_DESCRIPTIONS: Record<string, string> = {
  'security': 'vulnerabilities, attack surfaces, and insecure patterns',
  'code-quality': 'bugs, anti-patterns, and style issues',
  'performance': 'algorithmic complexity, memory leaks, and bottlenecks',
  'architecture': 'system design, coupling, and scalability',
  'accessibility': 'WCAG 2.2 compliance and ARIA patterns',
  'sql': 'injection risks, N+1 queries, and missing indexes',
  'api-design': 'REST/GraphQL conventions and error contracts',
  'react-patterns': 'React hooks, rendering, and component patterns',
  'frontend-performance': 'render performance and bundle optimization',
  'test-quality': 'coverage gaps and test quality',
  'auth-review': 'authentication and authorization security',
  'devops': 'Docker, CI/CD, and infrastructure issues',
  'typescript-strictness': 'type safety and strict mode violations',
  'seo-performance': 'search rankings and page load speed',
  'privacy': 'PII exposure and GDPR/CCPA compliance',
  'caching': 'cache strategy and invalidation patterns',
  'error-handling': 'error handling completeness and resilience',
  'database-infra': 'database configuration and reliability',
  'cors-headers': 'CORS configuration and header security',
  'rate-limiting': 'rate limiting and abuse prevention',
  'bundle-size': 'JavaScript bundle size optimization',
  'container-security': 'container hardening and supply chain security',
  'observability': 'logging, monitoring, and tracing',
  'security-gaps': 'MISSING security controls (auth, rate limits, CSRF, audit logs)',
  'resilience-gaps': 'MISSING reliability controls (timeouts, retries, idempotency, observability)',
  'coverage-gaps': 'MISSING handlers, branches, validations, and tests',
};

/**
 * Compute weighted relevance scores for recommended agents.
 * Returns the top N most-relevant agents with explanations.
 */
export function recommendAgents(
  input: string,
  topN = 5,
): RecommendationResult {
  const detection = detectAgents(input);

  if (detection.recommendedAgents.length === 0) {
    return {
      recommendations: [],
      language: detection.language,
      framework: detection.framework,
      detectedTags: detection.patterns,
    };
  }

  // Build a reverse mapping: agent → which tags caused its recommendation
  // This requires reconstructing the tag-to-agent mapping
  const agentToTags = new Map<string, string[]>();
  const TAG_TO_AGENTS: Record<string, string[]> = {
    'typescript': ['typescript-strictness', 'code-quality'],
    'javascript': ['code-quality', 'frontend-performance'],
    'python': ['code-quality', 'performance'],
    'react': ['react-patterns', 'frontend-performance', 'accessibility'],
    'nextjs': ['react-patterns', 'seo-performance', 'frontend-performance', 'seo-technical'],
    'express': ['api-design', 'security', 'rate-limiting', 'error-handling'],
    'sql': ['sql', 'database-infra', 'data-security'],
    'auth': ['auth-review', 'security', 'privacy'],
    'testing': ['test-quality', 'code-quality'],
    'caching': ['caching', 'performance'],
    'api': ['api-design', 'cors-headers', 'security'],
    'docker': ['devops', 'container-security', 'ci-cd'],
    'accessibility': ['accessibility', 'ux-review'],
    'graphql': ['graphql', 'api-design', 'security'],
    'concurrency': ['concurrency', 'performance'],
    'error-handling': ['error-handling', 'code-quality'],
    'cors': ['cors-headers', 'security'],
    'bundle': ['bundle-size', 'frontend-performance'],
    'observability': ['observability', 'logging'],
    'container': ['container-security', 'devops', 'cloud-infra'],
    'bloat': ['code-bloat', 'code-quality'],
  };

  for (const tag of detection.patterns) {
    const agents = TAG_TO_AGENTS[tag];
    if (agents) {
      for (const agentId of agents) {
        if (!agentToTags.has(agentId)) agentToTags.set(agentId, []);
        agentToTags.get(agentId)!.push(tag);
      }
    }
  }

  // Score each recommended agent
  const scored: AgentRecommendation[] = detection.recommendedAgents.map((agentId) => {
    const matchedTags = agentToTags.get(agentId) ?? [];
    const tagScoreSum = matchedTags.reduce(
      (sum, tag) => sum + (TAG_SPECIFICITY[tag] ?? DEFAULT_SPECIFICITY),
      0,
    );

    // Relevance = average tag specificity × log2(match count + 1)
    const avgSpecificity = matchedTags.length > 0
      ? tagScoreSum / matchedTags.length
      : DEFAULT_SPECIFICITY;
    const matchBonus = Math.log2(matchedTags.length + 1);
    const relevance = Math.min(100, Math.round(avgSpecificity * matchBonus));

    const description = AGENT_DESCRIPTIONS[agentId] ?? 'specialized analysis';
    const reason = matchedTags.length > 0
      ? `Detected ${matchedTags.join(', ')} patterns — checks for ${description}`
      : `General recommendation for ${description}`;

    return { agentId, relevance, reason, matchedTags };
  });

  // Sort by relevance descending, take top N
  scored.sort((a, b) => b.relevance - a.relevance);

  return {
    recommendations: scored.slice(0, topN),
    language: detection.language,
    framework: detection.framework,
    detectedTags: detection.patterns,
  };
}

/**
 * Format recommendations as an X-Recommended-Agents header value.
 */
export function formatRecommendationHeader(result: RecommendationResult): string {
  return result.recommendations
    .map((r) => `${r.agentId}:${r.relevance}`)
    .join(',');
}
