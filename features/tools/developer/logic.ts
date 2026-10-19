import { CsvError, parseCsv, resolveDelimiter, toCsv, uniqueHeaders } from '@/lib/tools/shared/csv';

// ---------------------------------------------------------------- JSON

export function lineCol(text: string, pos: number): { line: number; col: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      col = 1;
    } else col++;
  }
  return { line, col };
}

export function parseJsonWithLocation(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const lc = msg.match(/line (\d+) column (\d+)/);
    const pos = msg.match(/position (\d+)/);
    let where = '';
    if (lc) where = ` (line ${lc[1]}, column ${lc[2]})`;
    else if (pos) {
      const { line, col } = lineCol(text, Number(pos[1]));
      where = ` (line ${line}, column ${col})`;
    } else if (/end of (JSON|data)|Unexpected end/i.test(msg)) {
      const { line, col } = lineCol(text, text.length);
      where = ` (end of input, line ${line}, column ${col})`;
    }
    const clean = msg.replace(/^JSON\.parse: /, '').replace(/ in JSON at position \d+.*$/, '').replace(/\s*\(line \d+ column \d+\)/, '');
    throw new Error(`Invalid JSON${where}: ${clean}`);
  }
}

function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeysDeep((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export function formatJson(text: string, o: { indent: '2' | '4' | 'tab' | 'minify'; sortKeys: boolean }): string {
  let value = parseJsonWithLocation(text);
  if (o.sortKeys) value = sortKeysDeep(value);
  const indent = o.indent === 'minify' ? undefined : o.indent === 'tab' ? '\t' : Number(o.indent);
  return JSON.stringify(value, null, indent);
}

/** Integers with 16+ digits likely exceed Number.MAX_SAFE_INTEGER precision. */
export function hasUnsafeIntegers(text: string): boolean {
  const withoutStrings = text.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const found = withoutStrings.match(/(?<![\d.eE+-])-?\d{16,}(?![\d.eE])/g);
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  return !!found && found.some((d) => {
    const b = BigInt(d);
    return b > max || b < -max;
  });
}

// ---------------------------------------------------------------- JSON ↔ CSV

function cellValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function jsonToCsv(text: string, delimiter = ','): { output: string; rows: number; columns: number } {
  const data = parseJsonWithLocation(text);
  const list: unknown[] = Array.isArray(data) ? data : [data];
  if (list.length === 0) return { output: '', rows: 0, columns: 0 };

  if (list.every((r) => Array.isArray(r))) {
    const rows = (list as unknown[][]).map((r) => r.map(cellValue));
    return { output: toCsv(rows, delimiter), rows: rows.length, columns: Math.max(...rows.map((r) => r.length)) };
  }
  if (!list.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))) {
    throw new Error('Expected a JSON array of objects (or an array of arrays).');
  }
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of list as Record<string, unknown>[]) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    }
  }
  const rows = (list as Record<string, unknown>[]).map((r) => headers.map((h) => cellValue(r[h])));
  return { output: toCsv([headers, ...rows], delimiter), rows: rows.length, columns: headers.length };
}

export function csvToJson(text: string, o: { delimiter: string; header: boolean }): { output: string; rows: number } {
  let rows: string[][];
  try {
    rows = parseCsv(text, resolveDelimiter(o.delimiter, text));
  } catch (e) {
    if (e instanceof CsvError) throw new Error(e.message);
    throw e;
  }
  if (rows.length === 0) return { output: '[]', rows: 0 };
  if (!o.header) return { output: JSON.stringify(rows, null, 2), rows: rows.length };
  const headers = uniqueHeaders(rows[0]);
  const body = rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  return { output: JSON.stringify(body, null, 2), rows: body.length };
}

// ---------------------------------------------------------------- HTML entities

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
  euro: '€', pound: '£', yen: '¥', cent: '¢', sect: '§', para: '¶', deg: '°', plusmn: '±', times: '×', divide: '÷',
  middot: '·', bull: '•', larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔', frac12: '½', frac14: '¼', frac34: '¾',
  sup2: '²', sup3: '³', micro: 'µ', iexcl: '¡', iquest: '¿', shy: '­', ensp: ' ', emsp: ' ', thinsp: ' ',
};

export function htmlEncode(s: string, o: { nonAscii: boolean }): string {
  let out = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  if (o.nonAscii) {
    out = Array.from(out, (ch) => {
      const cp = ch.codePointAt(0)!;
      return cp > 126 ? `&#x${cp.toString(16).toUpperCase()};` : ch;
    }).join('');
  }
  return out;
}

export function htmlDecode(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body: string) => {
    if (body[0] === '#') {
      const cp = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return m;
      return String.fromCodePoint(cp);
    }
    return NAMED[body] ?? NAMED[body.toLowerCase()] ?? m;
  });
}

// ---------------------------------------------------------------- URL encoding

export type UrlMode = 'component' | 'uri' | 'form';

export function urlEncode(s: string, mode: UrlMode): string {
  if (mode === 'uri') return encodeURI(s);
  const enc = encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return mode === 'form' ? enc.replace(/%20/g, '+') : enc;
}

export function urlDecode(s: string, mode: UrlMode): string {
  try {
    const src = mode === 'form' ? s.replace(/\+/g, ' ') : s;
    return mode === 'uri' ? decodeURI(src) : decodeURIComponent(src);
  } catch {
    throw new Error('Malformed percent-encoding: a “%” is not followed by valid hex, or the bytes are not valid UTF-8.');
  }
}

// ---------------------------------------------------------------- Base64

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToBytes(input: string): Uint8Array {
  let s = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('This is not valid Base64: it contains characters outside A–Z, a–z, 0–9, +, /, - and _.');
  s = s.replace(/=+$/, '');
  if (s.length % 4 === 1) throw new Error('This Base64 text has an impossible length; it may be truncated.');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function base64EncodeText(s: string, urlSafe: boolean): string {
  const b = bytesToBase64(new TextEncoder().encode(s));
  return urlSafe ? b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b;
}

export function base64DecodeText(s: string): string {
  const bytes = base64ToBytes(s);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Decoded successfully, but the bytes are not valid UTF-8 text (it may be a binary file).');
  }
}

// ---------------------------------------------------------------- JWT

export interface DecodedJwt {
  header: unknown;
  payload: unknown;
  hasSignature: boolean;
  times: Array<{ claim: string; value: number; iso: string; note: string }>;
}

function decodeSegment(seg: string, name: string): unknown {
  let text: string;
  try {
    text = base64DecodeText(seg);
  } catch {
    throw new Error(`The ${name} is not valid Base64URL.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The ${name} decoded, but it is not JSON.`);
  }
}

export function decodeJwt(token: string, now = Date.now()): DecodedJwt {
  const t = token.trim().replace(/^Bearer\s+/i, '');
  const parts = t.split('.');
  if (parts.length === 5) throw new Error('This looks like an encrypted JWE token (5 parts). Its contents cannot be read without the key.');
  if (parts.length !== 3) throw new Error(`A JWT has 3 parts separated by dots; this has ${parts.length}.`);
  const header = decodeSegment(parts[0], 'header');
  const payload = decodeSegment(parts[1], 'payload');
  const times: DecodedJwt['times'] = [];
  if (payload && typeof payload === 'object') {
    for (const claim of ['iat', 'nbf', 'exp'] as const) {
      const v = (payload as Record<string, unknown>)[claim];
      if (typeof v === 'number' && Number.isFinite(v)) {
        const ms = v * 1000;
        const d = new Date(ms);
        let note = '';
        if (claim === 'exp') note = ms < now ? 'expired' : 'not expired yet';
        if (claim === 'nbf') note = ms > now ? 'not valid yet' : 'already valid';
        if (claim === 'iat') note = 'issued at';
        times.push({ claim, value: v, iso: Number.isNaN(d.getTime()) ? 'out of range' : d.toISOString(), note });
      }
    }
  }
  return { header, payload, hasSignature: parts[2].length > 0, times };
}

// ---------------------------------------------------------------- Unix time

export function fromTimestamp(input: string, unit: 'auto' | 's' | 'ms'): { ms: number; unitUsed: 's' | 'ms' } {
  const t = input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) throw new Error('Enter a number such as 1700000000 (seconds) or 1700000000000 (milliseconds).');
  const n = Number(t);
  const unitUsed = unit === 'auto' ? (Math.abs(n) >= 1e11 ? 'ms' : 's') : unit;
  const ms = unitUsed === 's' ? n * 1000 : n;
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) throw new Error('That timestamp is outside the range a JavaScript date can represent.');
  return { ms, unitUsed };
}
