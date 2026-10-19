import { parseCsv, resolveDelimiter, toCsv } from '@/lib/tools/shared/csv';

const cell = (s: string) => s.replace(/\r\n|\r|\n/g, ' ').replace(/\|/g, '\\|').trim();

export function csvToMarkdown(text: string, o: { delimiter: string; header: boolean; align: 'none' | 'left' | 'center' | 'right' }): string {
  const rows = parseCsv(text, resolveDelimiter(o.delimiter, text));
  if (rows.length === 0) return '';
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => cell(r[i] ?? ''));
  const head = o.header ? pad(rows[0]) : Array.from({ length: cols }, (_, i) => `Column ${i + 1}`);
  const body = (o.header ? rows.slice(1) : rows).map(pad);
  const sep = { none: '---', left: ':---', center: ':---:', right: '---:' }[o.align];
  const line = (r: string[]) => `| ${r.join(' | ')} |`;
  return [line(head), `|${Array(cols).fill(` ${sep} `).join('|')}|`, ...body.map(line)].join('\n');
}

// ---------------------------------------------------------------- Table operations


export interface Table {
  header: string[] | null;
  rows: string[][];
  delimiter: string;
  columns: number;
}

export function readTable(text: string, delimiterChoice: string, hasHeader: boolean): Table {
  const delimiter = resolveDelimiter(delimiterChoice, text);
  const all = parseCsv(text, delimiter);
  const columns = all.reduce((m, r) => Math.max(m, r.length), 0);
  const pad = (r: string[]) => Array.from({ length: columns }, (_, i) => r[i] ?? '');
  const header = hasHeader && all.length ? pad(all[0]) : null;
  return { header, rows: (hasHeader ? all.slice(1) : all).map(pad), delimiter, columns };
}

export function columnLabels(t: Table): string[] {
  return Array.from({ length: t.columns }, (_, i) => (t.header?.[i]?.trim() ? `${t.header[i]} (#${i + 1})` : `Column ${i + 1}`));
}

export function writeTable(t: Table, rows: string[][], header: string[] | null, delimiter = t.delimiter): string {
  return toCsv(header ? [header, ...rows] : rows, delimiter);
}

export function selectColumns(t: Table, order: number[]): string {
  if (!order.length) throw new Error('Choose at least one column.');
  const pick = (r: string[]) => order.map((i) => r[i] ?? '');
  return writeTable(t, t.rows.map(pick), t.header ? pick(t.header) : null);
}

export function duplicates(t: Table, keyCols: number[], o: { ignoreCase: boolean; trim: boolean }) {
  const cols = keyCols.length ? keyCols : Array.from({ length: t.columns }, (_, i) => i);
  const norm = (v: string) => {
    let s = o.trim ? v.trim() : v;
    if (o.ignoreCase) s = s.toLocaleLowerCase();
    return s;
  };
  const groups = new Map<string, number[]>();
  t.rows.forEach((r, i) => {
    const key = JSON.stringify(cols.map((c) => norm(r[c] ?? '')));
    const g = groups.get(key);
    if (g) g.push(i);
    else groups.set(key, [i]);
  });
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  const removeSet = new Set(dupGroups.flatMap((g) => g.slice(1)));
  return {
    dupGroups,
    duplicateRows: removeSet.size,
    deduped: writeTable(t, t.rows.filter((_, i) => !removeSet.has(i)), t.header),
    onlyDuplicates: writeTable(t, dupGroups.flat().sort((a, b) => a - b).map((i) => t.rows[i]), t.header),
  };
}

export function sortTable(t: Table, col: number, o: { mode: 'text' | 'natural' | 'number'; desc: boolean; emptyLast: boolean }): string {
  const collator = new Intl.Collator(undefined, { numeric: o.mode === 'natural', sensitivity: 'base' });
  const num = (s: string) => {
    const n = Number(s.replace(/[,\s]/g, ''));
    return s.trim() === '' || Number.isNaN(n) ? null : n;
  };
  const sorted = t.rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const va = a.r[col] ?? '';
      const vb = b.r[col] ?? '';
      const ea = va.trim() === '';
      const eb = vb.trim() === '';
      if (o.emptyLast && ea !== eb) return ea ? 1 : -1;
      let c: number;
      if (o.mode === 'number') {
        const na = num(va);
        const nb = num(vb);
        c = na === null && nb === null ? 0 : na === null ? 1 : nb === null ? -1 : na - nb;
      } else c = collator.compare(va, vb);
      return (o.desc ? -c : c) || a.i - b.i; // stable
    })
    .map((x) => x.r);
  return writeTable(t, sorted, t.header);
}

export type FilterOp = 'contains' | 'not-contains' | 'equals' | 'not-equals' | 'starts' | 'ends' | 'empty' | 'not-empty' | 'gt' | 'lt';

export function filterTable(t: Table, col: number, op: FilterOp, value: string, ignoreCase: boolean) {
  const v = ignoreCase ? value.toLocaleLowerCase() : value;
  const n = Number(value);
  if ((op === 'gt' || op === 'lt') && (value.trim() === '' || Number.isNaN(n))) throw new Error('Enter a number to compare with.');
  const keep = (cell: string) => {
    const c = ignoreCase ? cell.toLocaleLowerCase() : cell;
    switch (op) {
      case 'contains': return c.includes(v);
      case 'not-contains': return !c.includes(v);
      case 'equals': return c === v;
      case 'not-equals': return c !== v;
      case 'starts': return c.startsWith(v);
      case 'ends': return c.endsWith(v);
      case 'empty': return cell.trim() === '';
      case 'not-empty': return cell.trim() !== '';
      case 'gt':
      case 'lt': {
        const x = Number(cell.replace(/[,\s]/g, ''));
        if (cell.trim() === '' || Number.isNaN(x)) return false;
        return op === 'gt' ? x > n : x < n;
      }
    }
  };
  const rows = t.rows.filter((r) => keep(r[col] ?? ''));
  return { csv: writeTable(t, rows, t.header), kept: rows.length, total: t.rows.length };
}

export function delimiterReport(text: string) {
  const candidates: Array<[string, string]> = [[',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Pipe']];
  return candidates.map(([d, name]) => {
    try {
      const rows = parseCsv(text.slice(0, 200_000), d).filter((r) => !(r.length === 1 && r[0] === ''));
      const counts = rows.map((r) => r.length);
      const first = counts[0] ?? 0;
      const consistent = counts.filter((c) => c === first).length;
      return { delimiter: d, name, columns: first, consistency: counts.length ? consistent / counts.length : 0, rows: counts.length, error: null as string | null };
    } catch (e) {
      return { delimiter: d, name, columns: 0, consistency: 0, rows: 0, error: e instanceof Error ? e.message : String(e) };
    }
  });
}

export function convertDelimiter(text: string, from: string, to: string): string {
  return toCsv(parseCsv(text, resolveDelimiter(from, text)), to === 'tab' ? '\t' : to);
}
