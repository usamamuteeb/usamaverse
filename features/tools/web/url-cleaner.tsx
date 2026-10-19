'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, type OptionDef } from '@/components/tool-kit/options';
import { cleanUrl, TRACKER_GROUPS } from './more';

const options: OptionDef[] = Object.entries(TRACKER_GROUPS).map(([k, g]) => ({ type: 'checkbox' as const, key: k, label: g.label, default: k !== 'ref' }));

export default function UrlCleaner() {
  return (
    <TransformTool
      inputLabel="URLs (one per line)"
      inputRows={6}
      options={options}
      example={'https://shop.example.com/item/42?color=red&utm_source=newsletter&utm_medium=email&fbclid=IwAR123\nhttps://youtu.be/abc?si=XyZ123&t=30'}
      transform={(t, v) => {
        const groups = Object.keys(TRACKER_GROUPS).filter((k) => bool(v[k]));
        let removed = 0;
        const out = t.split(/\r?\n/).map((line, i) => {
          if (!line.trim()) return '';
          try {
            const r = cleanUrl(line, groups);
            removed += r.removed.length;
            return r.url;
          } catch {
            throw new Error(`Line ${i + 1} is not a valid absolute URL.`);
          }
        });
        return { output: out.join('\n'), summary: `${removed} tracking parameter${removed === 1 ? '' : 's'} removed.` };
      }}
    />
  );
}
