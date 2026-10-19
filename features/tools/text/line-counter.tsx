'use client';

import { StatsTool, type Stat } from '@/components/tool-kit/StatsTool';
import { lineStats } from './logic';

function compute(input: string): Stat[] {
  const s = lineStats(input);
  const n = (x: number) => x.toLocaleString('en-US');
  return [
    { label: 'Total lines', value: n(s.total) },
    { label: 'Non-empty lines', value: n(s.nonEmpty) },
    { label: 'Blank lines', value: n(s.blank) },
    { label: 'Unique lines', value: n(s.unique) },
    { label: 'Longest line', value: s.total ? `${n(s.longest)} characters (line ${s.longestLineNumber})` : '0' },
  ];
}

export default function LineCounter() {
  return <StatsTool inputLabel="Lines" compute={compute} placeholder="Paste lines of text…" example={'apple\nbanana\n\napple\ncherry pie'} />;
}
