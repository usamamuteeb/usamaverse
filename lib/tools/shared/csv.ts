/**
 * RFC 4180-style CSV parsing and writing.
 * Handles quoted fields with delimiters, escaped quotes ("") and line breaks,
 * CRLF / LF / CR line endings and a leading UTF-8 BOM.
 */
export type Delimiter = ',' | ';' | '\t' | '|';

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvError';
  }
}

export function parseCsv(text: string, delimiter: string = ','): string[][] {
  if (delimiter.length !== 1 || delimiter === '"' || delimiter === '\n' || delimiter === '\r') {
    throw new CsvError('Delimiter must be a single character other than a quote or line break.');
  }
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  let quoteStartLine = 0;
  let line = 1;
  const n = src.length;

  if (n === 0) return [];

  while (i < n) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (ch === '\n') line++;
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      if (field.length === 0) {
        inQuotes = true;
        quoteStartLine = line;
        i++;
        continue;
      }
      // Quote in the middle of an unquoted field: keep it literally (lenient).
      field += ch;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (ch === '\r' && src[i + 1] === '\n') i++;
      i++;
      line++;
      continue;
    }
    field += ch;
    i++;
  }
  if (inQuotes) throw new CsvError(`A quoted field that starts on line ${quoteStartLine} is never closed.`);
  // Final record (no trailing newline) — skip if the file ended with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function needsQuotes(value: string, delimiter: string): boolean {
  return value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r') || /^\s|\s$/.test(value);
}

export function toCsvField(value: string, delimiter: string = ','): string {
  return needsQuotes(value, delimiter) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][], delimiter: string = ',', newline = '\r\n'): string {
  return rows.map((r) => r.map((v) => toCsvField(v, delimiter)).join(delimiter)).join(newline);
}

/** Guess the delimiter by counting candidates outside quotes on the first lines. */
export function detectDelimiter(text: string): Delimiter {
  const candidates: Delimiter[] = [',', ';', '\t', '|'];
  const sample = text.slice(0, 20000);
  const counts = new Map<Delimiter, number[]>();
  candidates.forEach((c) => counts.set(c, []));
  let inQuotes = false;
  let lineCounts = new Map<Delimiter, number>(candidates.map((c) => [c, 0]));
  let lines = 0;
  for (let i = 0; i < sample.length && lines < 10; i++) {
    const ch = sample[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && sample[i + 1] === '\n') i++;
      candidates.forEach((c) => counts.get(c)!.push(lineCounts.get(c)!));
      lineCounts = new Map(candidates.map((c) => [c, 0]));
      lines++;
    } else if (!inQuotes && (candidates as string[]).includes(ch)) {
      lineCounts.set(ch as Delimiter, lineCounts.get(ch as Delimiter)! + 1);
    }
  }
  if (lines < 10) candidates.forEach((c) => counts.get(c)!.push(lineCounts.get(c)!));
  let best: Delimiter = ',';
  let bestScore = -1;
  for (const c of candidates) {
    const arr = counts.get(c)!.filter((_, idx, a) => idx < a.length);
    const nonZero = arr.filter((x) => x > 0);
    if (nonZero.length === 0) continue;
    const consistent = nonZero.every((x) => x === nonZero[0]) ? 2 : 1;
    const score = consistent * nonZero.length * 1000 + nonZero[0];
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** Make header names unique and non-empty: "", "id", "id" → "column_1", "id", "id_2". */
export function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h, i) => {
    let name = h.trim() || `column_${i + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) name = `${name}_${count + 1}`;
    return name;
  });
}

export function resolveDelimiter(choice: string, text: string): string {
  if (choice === 'auto') return detectDelimiter(text);
  if (choice === 'tab') return '\t';
  return choice;
}
