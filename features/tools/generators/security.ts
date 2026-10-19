// ---------------------------------------------------------------- CRC-32 (IEEE 802.3)

let TABLE: Uint32Array | null = null;
function table(): Uint32Array {
  if (TABLE) return TABLE;
  TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABLE[n] = c >>> 0;
  }
  return TABLE;
}

/** Incremental CRC-32: pass the previous value to continue across chunks. */
export function crc32(bytes: Uint8Array, prev = 0): number {
  const t = table();
  let c = (prev ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

export const hex32 = (n: number) => n.toString(16).padStart(8, '0');

// ---------------------------------------------------------------- HMAC (Web Crypto)

export type HmacAlg = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

export function decodeKey(key: string, format: 'text' | 'hex' | 'base64'): Uint8Array {
  if (format === 'text') return new TextEncoder().encode(key);
  if (format === 'hex') {
    const h = key.replace(/\s+/g, '').replace(/^0x/i, '');
    if (!/^([0-9a-f]{2})*$/i.test(h)) throw new Error('The hex key must have an even number of hex digits.');
    return Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
  }
  const b = key.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b)) throw new Error('The Base64 key contains invalid characters.');
  const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function hmac(message: string, key: Uint8Array, alg: HmacAlg): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto is not available (it needs a secure https:// or localhost page).');
  if (key.length === 0) throw new Error('Enter a key.');
  const k = await subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: alg }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', k, new TextEncoder().encode(message)));
}

export function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---------------------------------------------------------------- bcrypt (explain only; no hashing)

export function parseBcrypt(hash: string) {
  const m = hash.trim().match(/^\$(2[abxy]?)\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/);
  if (!m) throw new Error('A bcrypt hash looks like $2b$12$ followed by 53 characters from [./A-Za-z0-9].');
  const cost = Number(m[2]);
  if (cost < 4 || cost > 31) throw new Error('bcrypt cost must be between 04 and 31.');
  return { version: m[1], cost, rounds: 2 ** cost, salt: m[3], hash: m[4] };
}

export function costTable(baseCost: number, baseMs: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const cost = i + 8;
    return { cost, rounds: 2 ** cost, estimateMs: baseMs * 2 ** (cost - baseCost) };
  });
}

// ---------------------------------------------------------------- Password strength (local heuristic)

const COMMON = new Set(
  ('123456 123456789 12345678 password qwerty 12345 1234567 111111 1234567890 123123 abc123 1234 password1 iloveyou 1q2w3e4r 000000 qwerty123 ' +
    'zaq12wsx dragon sunshine princess letmein 654321 monkey 27653 1qaz2wsx 123321 qwertyuiop superman asdfghjkl 123qwe welcome football ' +
    'admin login master hello freedom whatever qazwsx trustno1 starwars passw0rd shadow baseball michael pakistan karachi lahore islamabad ' +
    'default changeme secret test guest root administrator 696969 121212 batman jordan liverpool chelsea arsenal').split(' '),
);
const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1qaz2wsx3edc'];

export interface StrengthReport {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  bits: number;
  crackTime: string;
  warnings: string[];
  suggestions: string[];
}

function humanTime(seconds: number): string {
  if (seconds < 1) return 'instantly';
  const units: Array<[number, string]> = [[31_556_952 * 100, 'centuries'], [31_556_952, 'years'], [2_629_746, 'months'], [86400, 'days'], [3600, 'hours'], [60, 'minutes'], [1, 'seconds']];
  for (const [s, name] of units) if (seconds >= s) return name === 'centuries' ? 'centuries or more' : `about ${Math.round(seconds / s)} ${name}`;
  return 'seconds';
}

/**
 * Rough, local-only estimate. Deliberately conservative: it penalises common
 * passwords, sequences, repeats, dates and keyboard patterns. Not a guarantee.
 */
export function passwordStrength(pw: string): StrengthReport {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  if (!pw) return { score: 0, label: 'Empty', bits: 0, crackTime: '—', warnings, suggestions: ['Type a password to check it.'] };
  const lower = pw.toLowerCase();
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33;
  const len = [...pw].length;
  let bits = len * Math.log2(Math.max(pool, 2));

  const unleet = (s: string) => s.replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/[$5]/g, 's').replace(/7/g, 't');
  // Strip leading/trailing digits & symbols first ("Password123!" → "password"), then undo leetspeak.
  const core = lower.replace(/[\d!@#$%^&*._-]+$/, '').replace(/^[\d!@#$%^&*._-]+/, '');
  const candidates = [lower, unleet(lower), core, unleet(core)];
  if (candidates.some((c) => c && COMMON.has(c))) {
    warnings.push('This is one of the most common passwords (or a simple variation of one).');
    bits = Math.min(bits, 10);
  }
  if (/(.)\1{2,}/.test(pw)) {
    warnings.push('Repeated characters like “aaa” are easy to guess.');
    bits -= 8;
  }
  for (const seq of SEQUENCES) {
    for (let k = 0; k + 4 <= seq.length; k++) {
      const s = seq.slice(k, k + 4);
      const rev = [...s].reverse().join('');
      if (lower.includes(s) || lower.includes(rev)) {
        warnings.push(`Contains the sequence “${lower.includes(s) ? s : rev}”.`);
        bits -= 10;
        k = seq.length;
      }
    }
  }
  if (/(19|20)\d{2}/.test(pw)) {
    warnings.push('Contains what looks like a year; dates are commonly guessed.');
    bits -= 6;
  }
  if (/^[A-Z][a-z]+\d{1,4}[!@#$]?$/.test(pw)) {
    warnings.push('“Word + numbers” is one of the first patterns attackers try.');
    bits -= 10;
  }
  bits = Math.max(0, bits);
  if (len < 12) suggestions.push('Use at least 12–16 characters; length matters most.');
  if (pool < 60) suggestions.push('Mix in more kinds of characters, or use a longer passphrase of random words.');
  suggestions.push('Use a different password for every site, ideally from a password manager.');
  const score = (bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4) as StrengthReport['score'];
  // Offline attack at ~10 billion guesses/second, half the space on average.
  const seconds = 2 ** bits / 2 / 1e10;
  return { score, label: ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][score], bits, crackTime: humanTime(seconds), warnings, suggestions };
}
