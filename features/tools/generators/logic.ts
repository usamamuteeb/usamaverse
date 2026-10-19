import { randomChoice, randomIndex, randomInt, randomUUID, shuffle } from '@/lib/tools/shared/random';

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
};
const AMBIGUOUS = /[Il1O0o|`'"]/g;

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export function passwordPools(o: PasswordOptions): string[] {
  const pools: string[] = [];
  (['lower', 'upper', 'digits', 'symbols'] as const).forEach((k) => {
    if (o[k]) pools.push(o.excludeAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]);
  });
  return pools;
}

export function generatePassword(o: PasswordOptions): string {
  if (!Number.isInteger(o.length) || o.length < 4 || o.length > 128) throw new Error('Choose a length from 4 to 128.');
  const pools = passwordPools(o);
  if (pools.length === 0) throw new Error('Select at least one character set.');
  if (pools.length > o.length) throw new Error('The length is shorter than the number of selected character sets.');
  const all = pools.join('');
  // One character from each selected set, the rest from the full pool, then a secure shuffle.
  const chars = pools.map((p) => randomChoice([...p]));
  while (chars.length < o.length) chars.push(all[randomIndex(all.length)]);
  return shuffle(chars).join('');
}

/** Approximate entropy assuming uniform choice from the combined pool. */
export function entropyBits(length: number, poolSize: number): number {
  return poolSize > 1 ? length * Math.log2(poolSize) : 0;
}

export function strengthLabel(bits: number): string {
  if (bits < 40) return 'Weak';
  if (bits < 60) return 'Fair';
  if (bits < 80) return 'Strong';
  return 'Very strong';
}

export function randomNumbers(o: { min: number; max: number; count: number; unique: boolean; sort: boolean }): number[] {
  const { min, max, count } = o;
  if (![min, max, count].every(Number.isInteger)) throw new Error('Use whole numbers.');
  if (Math.abs(min) > 1e9 || Math.abs(max) > 1e9) throw new Error('Keep the range between −1,000,000,000 and 1,000,000,000.');
  if (max < min) throw new Error('Maximum must be at least the minimum.');
  if (count < 1 || count > 1000) throw new Error('Generate between 1 and 1,000 numbers.');
  const span = max - min + 1;
  if (o.unique && count > span) throw new Error(`Only ${span.toLocaleString()} unique numbers exist in that range.`);
  let out: number[];
  if (o.unique) {
    const seen = new Set<number>();
    while (seen.size < count) seen.add(randomInt(min, max));
    out = [...seen];
  } else out = Array.from({ length: count }, () => randomInt(min, max));
  return o.sort ? out.sort((a, b) => a - b) : out;
}

export const STRING_CHARSETS: Record<string, string> = {
  alnum: SETS.lower + SETS.upper + SETS.digits,
  alpha: SETS.lower + SETS.upper,
  lower: SETS.lower + SETS.digits,
  hex: '0123456789abcdef',
  digits: SETS.digits,
  base64url: SETS.upper + SETS.lower + SETS.digits + '-_',
};

export function randomStrings(o: { length: number; count: number; charset: string; custom: string }): string[] {
  if (!Number.isInteger(o.length) || o.length < 1 || o.length > 1024) throw new Error('Length must be 1 to 1,024.');
  if (!Number.isInteger(o.count) || o.count < 1 || o.count > 500) throw new Error('Count must be 1 to 500.');
  const chars = o.charset === 'custom' ? [...new Set(Array.from(o.custom))] : [...STRING_CHARSETS[o.charset]];
  if (!chars || chars.length < 2) throw new Error('Provide at least two different characters.');
  return Array.from({ length: o.count }, () => Array.from({ length: o.length }, () => chars[randomIndex(chars.length)]).join(''));
}

export function pins(length: number, count: number): string[] {
  if (!Number.isInteger(length) || length < 4 || length > 12) throw new Error('PIN length must be 4 to 12 digits.');
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Count must be 1 to 100.');
  return Array.from({ length: count }, () => Array.from({ length }, () => String(randomIndex(10))).join(''));
}

export function uuids(count: number, uppercase: boolean, hyphens: boolean): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('Count must be 1 to 500.');
  return Array.from({ length: count }, () => {
    let u = randomUUID();
    if (!hyphens) u = u.replace(/-/g, '');
    return uppercase ? u.toUpperCase() : u;
  });
}

export type HashAlg = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

export async function hashText(text: string, alg: HashAlg, format: 'hex' | 'base64' = 'hex'): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto is not available here (it requires a secure https:// or localhost page).');
  const buf = new Uint8Array(await subtle.digest(alg, new TextEncoder().encode(text)));
  if (format === 'base64') {
    let bin = '';
    buf.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}
