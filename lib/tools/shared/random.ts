/**
 * Cryptographically secure randomness. There is deliberately no Math.random
 * fallback: if Web Crypto is missing, callers get a clear error.
 */
export class SecureRandomUnavailableError extends Error {
  constructor() {
    super('This browser does not provide a secure random generator (crypto.getRandomValues), so nothing was generated.');
    this.name = 'SecureRandomUnavailableError';
  }
}

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') throw new SecureRandomUnavailableError();
  return c;
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = getCrypto();
  for (let i = 0; i < n; i += 65536) c.getRandomValues(out.subarray(i, Math.min(n, i + 65536)));
  return out;
}

function randomUint32(): number {
  const buf = new Uint32Array(1);
  getCrypto().getRandomValues(buf);
  return buf[0];
}

/** Uniform integer in [0, n) without modulo bias (rejection sampling). n ≤ 2^32. */
export function randomIndex(n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > 2 ** 32) throw new RangeError('randomIndex: n must be an integer in 1..2^32');
  if (n === 1) return 0;
  const limit = 2 ** 32 - (2 ** 32 % n);
  let x: number;
  do x = randomUint32();
  while (x >= limit);
  return x % n;
}

/** Uniform integer in [min, max] inclusive. */
export function randomInt(min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max)) throw new RangeError('Use whole numbers.');
  if (max < min) throw new RangeError('Maximum must be at least the minimum.');
  return min + randomIndex(max - min + 1);
}

export function randomChoice<T>(items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('Nothing to choose from.');
  return items[randomIndex(items.length)];
}

/** Secure Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** RFC 9562 version 4 UUID. */
export function randomUUID(): string {
  const c = getCrypto();
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
