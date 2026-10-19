'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { sitemapXml } from './more';

const options: OptionDef[] = [
  { type: 'text', key: 'lastmod', label: 'Last modified (optional, YYYY-MM-DD)', default: '' },
  { type: 'select', key: 'changefreq', label: 'Change frequency (optional)', default: '', choices: ['', 'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'].map((v) => ({ value: v, label: v || 'Leave out' })) },
  { type: 'select', key: 'priority', label: 'Priority (optional)', default: '', choices: ['', '1.0', '0.8', '0.5', '0.3'].map((v) => ({ value: v, label: v || 'Leave out' })) },
];

export default function SitemapGenerator() {
  return (
    <TransformTool
      inputLabel="Page URLs (one per line)"
      options={options}
      example={'https://example.com/\nhttps://example.com/about\nhttps://example.com/products?id=1&color=red'}
      transform={(t, v) => {
        const lm = str(v.lastmod).trim();
        if (lm && !/^\d{4}-\d{2}-\d{2}$/.test(lm)) throw new Error('Last modified must be YYYY-MM-DD.');
        const r = sitemapXml(t, { lastmod: lm, changefreq: str(v.changefreq), priority: str(v.priority) });
        return { output: r.xml, summary: `${r.count} URL${r.count === 1 ? '' : 's'}.`, warning: r.warnings.join(' ') || undefined };
      }}
      filename="sitemap.xml"
      mime="application/xml"
    />
  );
}
