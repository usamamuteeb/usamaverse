import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site';
import { categoriesWithCounts, publicTools } from '@/lib/tools/public';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/tools`, changeFrequency: 'weekly', priority: 0.9 },
    ...categoriesWithCounts().map((c) => ({ url: `${base}/category/${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...publicTools.map((t) => ({ url: `${base}/tools/${t.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/help`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
