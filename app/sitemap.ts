import type { MetadataRoute } from 'next';
import { agents } from '@/lib/agents/registry';

// CACHE-005: Sitemap content is derived from a static agents array and only
// changes on deploy. force-static avoids regenerating it per request.
export const dynamic = 'force-static';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.consulting';

export default function sitemap(): MetadataRoute.Sitemap {
  // AUDIT-002: Include ALL public crawlable pages — missing pages reduce search visibility.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/audit`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/how-it-works`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/trust`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/benchmarks`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/security`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${BASE_URL}/terms`, changeFrequency: 'yearly', priority: 0.5 },
  ];

  const agentRoutes: MetadataRoute.Sitemap = agents.map((agent) => ({
    url: `${BASE_URL}/audit/${agent.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...agentRoutes];
}
