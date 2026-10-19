import { parseCsv, toCsv } from '@/lib/tools/shared/csv';
import { graphemes, splitLines } from './logic';

export type SplitMode = 'comma' | 'tab' | 'semicolon' | 'pipe' | 'spaces' | 'custom' | 'csv';
export type OutputMode = 'aligned' | 'csv' | 'tsv' | 'markdown';

export function textToColumns(text: string, o: { split: SplitMode; custom: string; output: OutputMode; trim: boolean }): { output: string; rows: number; columns: number } {
  let rows: string[][];
  if (o.split === 'csv') rows = parseCsv(text, ',');
  else {
    const lines = splitLines(text).filter((l, i, a) => !(i === a.length - 1 && l === ''));
    const sep = { comma: ',', tab: '\t', semicolon: ';', pipe: '|', custom: o.custom } as Record<string, string>;
    if (o.split === 'custom' && !o.custom) throw new Error('Enter a custom delimiter.');
    rows = lines.map((l) => (o.split === 'spaces' ? l.trim().split(/\s+/) : l.split(sep[o.split])));
  }
  if (o.trim) rows = rows.map((r) => r.map((c) => c.trim()));
  const columns = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const padded = rows.map((r) => Array.from({ length: columns }, (_, i) => r[i] ?? ''));
  let output: string;
  if (o.output === 'csv') output = toCsv(padded, ',', '\n');
  else if (o.output === 'tsv') output = padded.map((r) => r.map((c) => c.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
  else {
    const flat = (c: string) => c.replace(/\r?\n/g, ' ');
    const widths = Array.from({ length: columns }, (_, i) => Math.max(o.output === 'markdown' ? 3 : 1, ...padded.map((r) => graphemes(flat(r[i])).length)));
    const padCell = (c: string, w: number) => flat(c) + ' '.repeat(Math.max(0, w - graphemes(flat(c)).length));
    if (o.output === 'aligned') output = padded.map((r) => r.map((c, i) => padCell(c, widths[i])).join('  ').replace(/\s+$/, '')).join('\n');
    else {
      const esc = (c: string) => flat(c).replace(/\|/g, '\\|');
      const line = (r: string[]) => `| ${r.map((c, i) => padCell(esc(c), widths[i])).join(' | ')} |`;
      output = padded.length ? [line(padded[0]), `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`, ...padded.slice(1).map(line)].join('\n') : '';
    }
  }
  return { output, rows: padded.length, columns };
}
