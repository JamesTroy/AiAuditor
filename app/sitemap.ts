import type { MetadataRoute } from 'next';
import { agents } from '@/lib/agents';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/site-audit`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/stack`, changeFrequency: 'monthly', priority: 0.7 },
  ];

  const agentRoutes: MetadataRoute.Sitemap = agents.map((agent) => ({
    url: `${BASE_URL}/audit/${agent.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...agentRoutes];
}
