import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site';
import { categoriesWithCounts, publicTools } from '@/lib/tools/public';
import { workspaces } from '@/lib/tools/workspaces';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/tools`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/apps`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/apps/typing`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/apps/resume-tailor`, changeFrequency: 'monthly', priority: 0.8 },
    ...categoriesWithCounts().map((c) => ({ url: `${base}/category/${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...workspaces.map((w) => ({ url: `${base}/workspaces/${w.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...publicTools.map((t) => ({ url: `${base}/tools/${t.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/help`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
