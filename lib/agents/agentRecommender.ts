// WORKFLOW-10: Auto-detected multi-agent recommendation.
// After detectAgents() runs, compute a weighted relevance score for each
// recommended agent based on tag specificity and match count. Returns the
// top 5 most-relevant agents with explanations.

import { detectAgents, TAG_TO_AGENTS } from '@/lib/detectAgents';

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
 *
 * Pass `precomputedDetection` when the caller has already run `detectAgents`
 * on the same input — avoids a duplicate full-input regex pipeline pass
 * (the audit POST handler does this; 5-50ms saved per audit on a 200KB input).
 */
export function recommendAgents(
  input: string,
  topN = 5,
  precomputedDetection?: ReturnType<typeof detectAgents>,
): RecommendationResult {
  const detection = precomputedDetection ?? detectAgents(input);

  if (detection.recommendedAgents.length === 0) {
    return {
      recommendations: [],
      language: detection.language,
      framework: detection.framework,
      detectedTags: detection.patterns,
    };
  }

  // Build a reverse mapping: agent → which tags caused its recommendation.
  // Uses the canonical TAG_TO_AGENTS from detectAgents.ts (was previously a
  // hand-maintained subset that left ~40 tags un-scored — agents recommended
  // via those tags ended up with matchedTags=[] and relevance 0, producing
  // an effectively random sort at the bottom of the list).
  const agentToTags = new Map<string, string[]>();

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
