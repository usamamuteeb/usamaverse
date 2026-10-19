/** 1D barcodes: Code 128 (auto subset B/C) and EAN-13 / UPC-A. Output is a list of bar/space widths. */

// Code 128 patterns (bar, space, bar, space, bar, space widths) for values 0–106.
const C128 = (
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112'
).split(' ');

export const CODE128_PATTERNS = C128;

const START_B = 104;
const START_C = 105;
const CODE_B = 100; // in subset C: switch to B
const CODE_C = 99; // in subset B: switch to C
const STOP = 106;

/** Encode printable ASCII (32–126) using subset B, switching to C for runs of ≥4 digits (even length). */
export function code128Values(text: string): number[] {
  if (!text) throw new Error('Enter some text.');
  if (text.length > 80) throw new Error('Keep Code 128 content to 80 characters or fewer.');
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) throw new Error(`“${ch}” cannot be encoded. Code 128 here supports printable ASCII (space to ~).`);
  }
  const values: number[] = [];
  let i = 0;
  const digitRun = (from: number) => {
    let j = from;
    while (j < text.length && /\d/.test(text[j])) j++;
    return j - from;
  };
  const startRun = digitRun(0);
  let subset: 'B' | 'C' = startRun >= 4 ? 'C' : 'B';
  values.push(subset === 'C' ? START_C : START_B);
  while (i < text.length) {
    if (subset === 'C') {
      const run = digitRun(i);
      if (run >= 2) {
        values.push(Number(text.slice(i, i + 2)));
        i += 2;
        continue;
      }
      values.push(CODE_B);
      subset = 'B';
      continue;
    }
    const run = digitRun(i);
    if (run >= 4) {
      // Switch to C for an even number of digits; an odd leading digit stays in B.
      if (run % 2 === 1) {
        values.push(text.charCodeAt(i) - 32);
        i++;
      }
      values.push(CODE_C);
      subset = 'C';
      continue;
    }
    values.push(text.charCodeAt(i) - 32);
    i++;
  }
  const checksum = values.reduce((sum, v, k) => sum + v * (k === 0 ? 1 : k), 0) % 103;
  values.push(checksum, STOP);
  return values;
}

export function code128Widths(text: string): number[] {
  const widths = code128Values(text).flatMap((v) => [...C128[v]].map(Number));
  return widths;
}

// EAN-13
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = L.map((p) => [...p].map((b) => (b === '0' ? '1' : '0')).join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function eanCheckDigit(first12: string): number {
  const sum = [...first12].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

/** Accepts 12 digits (check digit added) or 13 (check digit verified). UPC-A (11/12 digits) is EAN-13 with a leading 0. */
export function normalizeEan(input: string, kind: 'ean13' | 'upca'): string {
  const d = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(d)) throw new Error('Use digits only.');
  const want = kind === 'ean13' ? 12 : 11;
  let full: string;
  if (d.length === want) full = d + eanCheckDigit(kind === 'upca' ? '0' + d : d);
  else if (d.length === want + 1) {
    const body = d.slice(0, -1);
    const expected = eanCheckDigit(kind === 'upca' ? '0' + body : body);
    if (Number(d.slice(-1)) !== expected) throw new Error(`Check digit should be ${expected}, not ${d.slice(-1)}.`);
    full = d;
  } else throw new Error(kind === 'ean13' ? 'EAN-13 needs 12 digits (or 13 including the check digit).' : 'UPC-A needs 11 digits (or 12 including the check digit).');
  return kind === 'upca' ? '0' + full : full;
}

/** Module bits (1 = bar) for a 13-digit EAN, including guards. */
export function eanBits(ean13: string): string {
  const first = Number(ean13[0]);
  const left = [...ean13.slice(1, 7)].map((c, i) => (PARITY[first][i] === 'L' ? L : G)[Number(c)]).join('');
  const right = [...ean13.slice(7)].map((c) => R[Number(c)]).join('');
  return `101${left}01010${right}101`;
}

export function bitsToWidths(bits: string): number[] {
  const out: number[] = [];
  let run = 1;
  for (let i = 1; i <= bits.length; i++) {
    if (i < bits.length && bits[i] === bits[i - 1]) run++;
    else {
      out.push(run);
      run = 1;
    }
  }
  return out; // starts with a bar
}

export function barcodeSvg(widths: number[], o: { moduleWidth: number; height: number; quiet: number; text: string; showText: boolean }): string {
  const total = widths.reduce((a, b) => a + b, 0) + o.quiet * 2;
  const W = total * o.moduleWidth;
  const textH = o.showText ? 18 : 0;
  let x = o.quiet;
  let rects = '';
  widths.forEach((w, i) => {
    if (i % 2 === 0) rects += `<rect x="${x * o.moduleWidth}" y="0" width="${w * o.moduleWidth}" height="${o.height}"/>`;
    x += w;
  });
  const esc = o.text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const label = o.showText ? `<text x="${W / 2}" y="${o.height + 15}" font-family="monospace" font-size="14" text-anchor="middle">${esc}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${o.height + textH}" viewBox="0 0 ${W} ${o.height + textH}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects}</g>${label}</svg>`;
}
