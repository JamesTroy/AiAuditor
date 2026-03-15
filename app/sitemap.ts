import type { MetadataRoute } from 'next';
import { agents } from '@/lib/agents';

// CACHE-005: Sitemap content is derived from a static agents array and only
// changes on deploy. force-static avoids regenerating it per request.
export const dynamic = 'force-static';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.consulting';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/site-audit`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/how-it-works`, changeFrequency: 'monthly', priority: 0.7 },
  ];

  const agentRoutes: MetadataRoute.Sitemap = agents.map((agent) => ({
    url: `${BASE_URL}/audit/${agent.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...agentRoutes];
}
