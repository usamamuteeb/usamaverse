'use client';

import { useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { OutputPanel } from '@/components/tool-kit/output';
import { robotsTxt } from './more';

export default function RobotsTxtGenerator() {
  const [groups, setGroups] = useState([{ agent: '*', allow: '', disallow: '/admin/\n/cart/' }]);
  const [sitemaps, setSitemaps] = useState('https://example.com/sitemap.xml');
  let out = '';
  let error: string | null = null;
  try {
    out = robotsTxt(groups, sitemaps);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const set = (i: number, k: 'agent' | 'allow' | 'disallow', v: string) => setGroups((g) => g.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {groups.map((g, i) => (
          <fieldset key={i} className="options">
            <legend className="field-label">Rule group {i + 1}</legend>
            <TextField label="User-agent" value={g.agent} onChange={(v) => set(i, 'agent', v)} hint="* means all crawlers. Examples: Googlebot, Bingbot, GPTBot." />
            <TextAreaField label="Allow paths (one per line)" value={g.allow} onChange={(v) => set(i, 'allow', v)} rows={3} />
            <TextAreaField label="Disallow paths (one per line, empty = allow everything)" value={g.disallow} onChange={(v) => set(i, 'disallow', v)} rows={3} />
            {groups.length > 1 && <Button variant="ghost" onClick={() => setGroups((x) => x.filter((_, j) => j !== i))}>Remove group</Button>}
          </fieldset>
        ))}
        <Button onClick={() => setGroups((g) => [...g, { agent: 'GPTBot', allow: '', disallow: '/' }])}>Add group</Button>
        <TextAreaField label="Sitemap URLs (one per line)" value={sitemaps} onChange={setSitemaps} rows={2} />
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        <OutputPanel label="robots.txt" value={out} filename="robots.txt" />
        <Status tone="info">robots.txt is a request, not access control: well-behaved crawlers follow it, but it doesn’t hide or protect pages.</Status>
      </div>
    </div>
  );
}
