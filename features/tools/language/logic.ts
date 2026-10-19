import { graphemes } from '@/features/tools/text/logic';

// ---------------------------------------------------------------- Morse (ITU)

export const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', _: '..--.-', '"': '.-..-.', $: '...-..-', '@': '.--.-.',
};
const FROM_MORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

export function toMorse(text: string): { output: string; skipped: string[] } {
  const skipped = new Set<string>();
  const words = text
    .toUpperCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      [...w]
        .map((c) => {
          if (MORSE[c]) return MORSE[c];
          skipped.add(c);
          return '';
        })
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean);
  return { output: words.join(' / '), skipped: [...skipped] };
}

export function fromMorse(code: string): string {
  const norm = code.replace(/[·•]/g, '.').replace(/[–—_−]/g, '-').trim();
  if (!/^[.\-\s/|]*$/.test(norm)) throw new Error('Morse code may only contain dots, dashes, spaces and “/” between words.');
  return norm
    .split(/\s*[/|]\s*|\s{3,}/)
    .map((w) =>
      w
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((s) => {
          const c = FROM_MORSE[s];
          if (!c) throw new Error(`“${s}” is not a known Morse code.`);
          return c;
        })
        .join(''),
    )
    .filter(Boolean)
    .join(' ');
}

/** Timing in ITU units: dot 1, dash 3, intra-char gap 1, letter gap 3, word gap 7. */
export function morseTimeline(code: string): Array<{ on: boolean; units: number }> {
  const out: Array<{ on: boolean; units: number }> = [];
  const words = code.trim().split(/\s*\/\s*/);
  words.forEach((w, wi) => {
    const letters = w.split(/\s+/).filter(Boolean);
    letters.forEach((l, li) => {
      [...l].forEach((s, si) => {
        out.push({ on: true, units: s === '.' ? 1 : 3 });
        if (si < l.length - 1) out.push({ on: false, units: 1 });
      });
      if (li < letters.length - 1) out.push({ on: false, units: 3 });
    });
    if (wi < words.length - 1) out.push({ on: false, units: 7 });
  });
  return out;
}

// ---------------------------------------------------------------- NATO / ICAO

export const NATO: Record<string, string> = {
  A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo',
  L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform',
  V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu', '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
  '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Niner', '-': 'Dash', '.': 'Stop',
};
const FROM_NATO: Record<string, string> = Object.fromEntries(Object.entries(NATO).map(([k, v]) => [v.toLowerCase().replace('-', ''), k]));
Object.assign(FROM_NATO, { alpha: 'A', juliet: 'J', xray: 'X', nine: '9', whisky: 'W', decimal: '.', point: '.' });

export function toNato(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) =>
      [...line.toUpperCase()]
        .map((c) => (c === ' ' ? '(space)' : NATO[c] ?? c))
        .join(' '),
    )
    .join('\n');
}

export function fromNato(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => {
          if (w.toLowerCase() === '(space)') return ' ';
          const k = FROM_NATO[w.toLowerCase().replace(/[-.,]/g, '')];
          if (!k) throw new Error(`“${w}” is not a NATO spelling word.`);
          return k;
        })
        .join(''),
    )
    .join('\n');
}

// ---------------------------------------------------------------- Number to words (English, short scale)

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion', 'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion', 'vigintillion'];

function under1000(n: number, and: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) {
    const t = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : '');
    parts.push(h && and ? `and ${t}` : t);
  }
  return parts.join(' ');
}

const ORDINAL_IRREGULAR: Record<string, string> = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };

export function numberToWords(input: string, o: { ordinal: boolean; british: boolean }): string {
  const s = input.trim().replace(/[,_\s]/g, '');
  const m = s.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!m) throw new Error('Enter a number such as 1234, -45 or 3.14.');
  const neg = !!m[1];
  const intStr = m[2].replace(/^0+(?=\d)/, '');
  if (intStr.length > 66) throw new Error('Numbers up to 66 digits (vigintillions) are supported.');
  if (o.ordinal && (m[3] || neg)) throw new Error('Ordinals need a positive whole number.');
  let n = BigInt(intStr);
  let words: string;
  if (n === BigInt(0)) words = 'zero';
  else {
    const groups: string[] = [];
    let scale = 0;
    const thousand = BigInt(1000);
    while (n > BigInt(0)) {
      const chunk = Number(n % thousand);
      if (chunk) groups.unshift(`${under1000(chunk, o.british)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`);
      n /= thousand;
      scale++;
    }
    // British "and" before a final chunk under 100 (e.g. "one thousand and five").
    if (o.british && groups.length > 1 && Number(BigInt(intStr) % thousand) < 100 && Number(BigInt(intStr) % thousand) > 0) groups[groups.length - 1] = `and ${groups[groups.length - 1]}`;
    words = groups.join(' ');
  }
  if (o.ordinal) {
    words = words.replace(/([a-z]+)$/, (w) => {
      if (ORDINAL_IRREGULAR[w]) return ORDINAL_IRREGULAR[w];
      if (w.endsWith('y')) return w.slice(0, -1) + 'ieth';
      return w + 'th';
    });
  }
  if (m[3]) words += ' point ' + [...m[3]].map((d) => ONES[Number(d)]).join(' ');
  return (neg ? 'minus ' : '') + words;
}

// ---------------------------------------------------------------- UTF-8 bytes

export type ByteFormat = 'binary' | 'hex' | 'decimal' | 'octal';

export function textToBytes(text: string, f: ByteFormat, sep = ' '): string {
  const bytes = new TextEncoder().encode(text);
  const radix = { binary: 2, hex: 16, decimal: 10, octal: 8 }[f];
  const width = { binary: 8, hex: 2, decimal: 0, octal: 3 }[f];
  return Array.from(bytes, (b) => b.toString(radix).toUpperCase().padStart(width, '0')).join(sep);
}

export function bytesToText(input: string, f: ByteFormat): string {
  const clean = input.trim();
  if (!clean) return '';
  let tokens: string[];
  if (f === 'binary' && /^[01]+$/.test(clean) && clean.length % 8 === 0) tokens = clean.match(/.{8}/g)!;
  else if (f === 'hex' && /^[0-9a-f]+$/i.test(clean) && clean.length % 2 === 0) tokens = clean.match(/.{2}/g)!;
  else tokens = clean.split(/[\s,;:-]+|0x/i).filter(Boolean);
  const radix = { binary: 2, hex: 16, decimal: 10, octal: 8 }[f];
  const valid = { binary: /^[01]{1,8}$/, hex: /^[0-9a-f]{1,2}$/i, decimal: /^\d{1,3}$/, octal: /^[0-7]{1,3}$/ }[f];
  const bytes = tokens.map((t) => {
    if (!valid.test(t)) throw new Error(`“${t}” is not a valid ${f} byte.`);
    const v = parseInt(t, radix);
    if (v > 255) throw new Error(`“${t}” is larger than one byte (255).`);
    return v;
  });
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    throw new Error('These bytes are not valid UTF-8 text.');
  }
}

// ---------------------------------------------------------------- Braille (uncontracted English, Grade 1)

const LETTER_DOTS: Record<string, number[]> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5], p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6],
};
const PUNCT_DOTS: Record<string, number[]> = { ',': [2], ';': [2, 3], ':': [2, 5], '.': [2, 5, 6], '!': [2, 3, 5], '?': [2, 3, 6], "'": [3], '-': [3, 6] };
const NUMBER_SIGN = [3, 4, 5, 6];
const CAPITAL_SIGN = [6];

export const cell = (dots: number[]) => String.fromCodePoint(0x2800 + dots.reduce((m, d) => m | (1 << (d - 1)), 0));

export function toBraille(text: string): { output: string; skipped: string[] } {
  const skipped = new Set<string>();
  let out = '';
  let inNumber = false;
  for (const ch of text) {
    if (/\d/.test(ch)) {
      if (!inNumber) out += cell(NUMBER_SIGN);
      inNumber = true;
      out += cell(LETTER_DOTS['jabcdefghi'[Number(ch)]]);
      continue;
    }
    if (inNumber && ch !== '.' && ch !== ',') inNumber = false;
    const low = ch.toLowerCase();
    if (LETTER_DOTS[low]) {
      if (ch !== low) out += cell(CAPITAL_SIGN);
      out += cell(LETTER_DOTS[low]);
    } else if (PUNCT_DOTS[ch]) out += cell(PUNCT_DOTS[ch]);
    else if (ch === ' ' || ch === '\n') {
      out += ch === ' ' ? '⠀' : '\n';
      inNumber = false;
    } else skipped.add(ch);
  }
  return { output: out, skipped: [...skipped] };
}

export const BRAILLE_TABLE = [
  ...Object.entries(LETTER_DOTS).map(([k, d]) => ({ label: k, dots: d })),
  ...Object.entries(PUNCT_DOTS).map(([k, d]) => ({ label: k, dots: d })),
  { label: 'number sign', dots: NUMBER_SIGN },
  { label: 'capital sign', dots: CAPITAL_SIGN },
];

// ---------------------------------------------------------------- Unicode inspector

const CATEGORIES: Array<[RegExp, string]> = [
  [/\p{Lu}/u, 'Uppercase letter'], [/\p{Ll}/u, 'Lowercase letter'], [/\p{Lt}/u, 'Titlecase letter'], [/\p{Lm}/u, 'Modifier letter'], [/\p{Lo}/u, 'Other letter'],
  [/\p{Mn}/u, 'Non-spacing mark (combining)'], [/\p{Mc}/u, 'Spacing mark'], [/\p{Me}/u, 'Enclosing mark'], [/\p{Nd}/u, 'Decimal digit'], [/\p{Nl}/u, 'Letter number'], [/\p{No}/u, 'Other number'],
  [/\p{Pc}/u, 'Connector punctuation'], [/\p{Pd}/u, 'Dash'], [/\p{Ps}/u, 'Open punctuation'], [/\p{Pe}/u, 'Close punctuation'], [/\p{Pi}/u, 'Initial quote'], [/\p{Pf}/u, 'Final quote'], [/\p{Po}/u, 'Other punctuation'],
  [/\p{Sm}/u, 'Math symbol'], [/\p{Sc}/u, 'Currency symbol'], [/\p{Sk}/u, 'Modifier symbol'], [/\p{So}/u, 'Other symbol'],
  [/\p{Zs}/u, 'Space separator'], [/\p{Zl}/u, 'Line separator'], [/\p{Zp}/u, 'Paragraph separator'],
  [/\p{Cc}/u, 'Control character'], [/\p{Cf}/u, 'Format character (invisible)'], [/\p{Co}/u, 'Private use'], [/\p{Cs}/u, 'Surrogate'],
];
const SCRIPTS = ['Latin', 'Greek', 'Cyrillic', 'Arabic', 'Hebrew', 'Devanagari', 'Bengali', 'Gurmukhi', 'Gujarati', 'Tamil', 'Telugu', 'Thai', 'Han', 'Hiragana', 'Katakana', 'Hangul', 'Armenian', 'Georgian', 'Ethiopic', 'Khmer', 'Sinhala', 'Common', 'Inherited'];
const SCRIPT_RES = SCRIPTS.map((s) => [s, new RegExp(`\\p{Script=${s}}`, 'u')] as const);

export interface CodePointInfo {
  char: string;
  codePoint: string;
  decimal: number;
  category: string;
  script: string;
  utf8: string;
  utf16: string;
  htmlEntity: string;
  jsEscape: string;
}

export function inspectCodePoint(ch: string): CodePointInfo {
  const cp = ch.codePointAt(0)!;
  const utf8 = Array.from(new TextEncoder().encode(ch), (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  const utf16 = Array.from({ length: ch.length }, (_, i) => ch.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')).join(' ');
  return {
    char: ch,
    codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
    decimal: cp,
    category: CATEGORIES.find(([re]) => re.test(ch))?.[1] ?? 'Unassigned',
    script: SCRIPT_RES.find(([, re]) => re.test(ch))?.[0] ?? 'Other',
    utf8,
    utf16,
    htmlEntity: `&#x${cp.toString(16).toUpperCase()};`,
    jsEscape: cp > 0xffff ? `\\u{${cp.toString(16).toUpperCase()}}` : `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`,
  };
}

export function inspectText(text: string, max = 500) {
  const clusters = graphemes(text).slice(0, max);
  return clusters.map((g) => ({ grapheme: g, points: Array.from(g).map(inspectCodePoint) }));
}

// ---------------------------------------------------------------- Misc text generators

/** Invoice/reference numbers from a pattern: {YYYY} {YY} {MM} {DD} {SEQ} or {SEQ:5}, {RAND:4} is not offered (no storage, deterministic). */
export function invoiceNumbers(pattern: string, start: number, count: number, step: number, date: Date): string[] {
  if (!/\{SEQ(?::\d+)?\}/.test(pattern)) throw new Error('The pattern needs a {SEQ} or {SEQ:5} placeholder for the running number.');
  if (!Number.isInteger(start) || start < 0) throw new Error('Start must be a whole number ≥ 0.');
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Generate 1 to 1,000 numbers.');
  if (!Number.isInteger(step) || step < 1) throw new Error('Step must be a whole number ≥ 1.');
  const p2 = (n: number) => String(n).padStart(2, '0');
  const base = pattern
    .replace(/\{YYYY\}/g, String(date.getFullYear()))
    .replace(/\{YY\}/g, String(date.getFullYear()).slice(-2))
    .replace(/\{MM\}/g, p2(date.getMonth() + 1))
    .replace(/\{DD\}/g, p2(date.getDate()));
  const unknown = base.match(/\{(?!SEQ(?::\d+)?\})[^}]*\}/);
  if (unknown) throw new Error(`Unknown placeholder ${unknown[0]}.`);
  return Array.from({ length: count }, (_, i) => base.replace(/\{SEQ(?::(\d+))?\}/g, (_m, w?: string) => String(start + i * step).padStart(Number(w ?? 0), '0')));
}

export type Align = 'left' | 'center' | 'right' | 'none';

export function gridToMarkdown(grid: string[][], align: Align[]): string {
  if (!grid.length || !grid[0].length) return '';
  const cols = grid[0].length;
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
  const cells = grid.map((r) => Array.from({ length: cols }, (_, i) => esc(r[i] ?? '')));
  const widths = Array.from({ length: cols }, (_, i) => Math.max(3, ...cells.map((r) => graphemes(r[i]).length)));
  const pad = (s: string, w: number) => s + ' '.repeat(w - graphemes(s).length);
  const sep = widths.map((w, i) => {
    const a = align[i] ?? 'none';
    const dashes = '-'.repeat(Math.max(1, w - (a === 'center' ? 2 : a === 'none' ? 0 : 1)));
    return a === 'center' ? `:${dashes}:` : a === 'left' ? `:${dashes}` : a === 'right' ? `${dashes}:` : dashes;
  });
  const line = (r: string[]) => `| ${r.map((c, i) => pad(c, widths[i])).join(' | ')} |`;
  return [line(cells[0]), `| ${sep.join(' | ')} |`, ...cells.slice(1).map(line)].join('\n');
}

const h = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function gridToHtml(grid: string[][], o: { header: boolean; caption: string; className: string }): string {
  if (!grid.length) return '';
  if (o.className && !/^[A-Za-z_-][\w -]*$/.test(o.className)) throw new Error('Class names may only use letters, digits, - and _.');
  const cls = o.className.trim() ? ` class="${h(o.className.trim())}"` : '';
  const lines = [`<table${cls}>`];
  if (o.caption.trim()) lines.push(`  <caption>${h(o.caption.trim())}</caption>`);
  const body = o.header ? grid.slice(1) : grid;
  if (o.header) lines.push('  <thead>', `    <tr>${grid[0].map((c) => `<th scope="col">${h(c)}</th>`).join('')}</tr>`, '  </thead>');
  lines.push('  <tbody>', ...body.map((r) => `    <tr>${r.map((c) => `<td>${h(c)}</td>`).join('')}</tr>`), '  </tbody>', '</table>');
  return lines.join('\n');
}
