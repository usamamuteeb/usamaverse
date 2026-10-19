/**
 * Safe expression evaluator (recursive descent). Never uses eval/Function.
 * Grammar:
 *   expr   := term (('+' | '-') term)*
 *   term   := unary (('*' | '/') unary)*
 *   unary  := ('+' | '-') unary | power
 *   power  := postfix ('^' unary)?          (right-associative; -2^2 = -4)
 *   postfix:= primary '%'*                   (50% = 0.5)
 *   primary:= number | '(' expr ')'
 */
type Tok = { t: 'num'; v: number; p: number } | { t: 'op'; v: string; p: number };

export class CalcError extends Error {}

function tokenize(src: string): Tok[] {
  const s = src.replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/,/g, '');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
    if (m) {
      out.push({ t: 'num', v: parseFloat(m[0]), p: i });
      i += m[0].length;
      continue;
    }
    if (s.startsWith('**', i)) {
      out.push({ t: 'op', v: '^', p: i });
      i += 2;
      continue;
    }
    if ('+-*/^()%'.includes(c)) {
      out.push({ t: 'op', v: c, p: i });
      i++;
      continue;
    }
    throw new CalcError(`Unexpected “${c}” at position ${i + 1}. Use numbers, + − × ÷ ^ % and parentheses.`);
  }
  return out;
}

export function evaluate(src: string): number {
  if (src.length > 1000) throw new CalcError('Expression is too long (1,000 characters max).');
  const toks = tokenize(src);
  if (toks.length === 0) throw new CalcError('Enter an expression.');
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  let depth = 0;

  const expr = (): number => {
    let v = term();
    while (isOp('+') || isOp('-')) {
      const op = toks[i++].v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const term = (): number => {
    let v = unary();
    while (isOp('*') || isOp('/')) {
      const op = toks[i++].v;
      const r = unary();
      if (op === '/' && r === 0) throw new CalcError('Division by zero.');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const unary = (): number => {
    if (isOp('-')) {
      i++;
      return -unary();
    }
    if (isOp('+')) {
      i++;
      return unary();
    }
    return power();
  };
  const power = (): number => {
    const base = postfix();
    if (isOp('^')) {
      i++;
      const e = unary();
      return base ** e;
    }
    return base;
  };
  const postfix = (): number => {
    let v = primary();
    while (isOp('%')) {
      i++;
      v /= 100;
    }
    return v;
  };
  const primary = (): number => {
    const tk = peek();
    if (!tk) throw new CalcError('The expression ends too early.');
    if (tk.t === 'num') {
      i++;
      if (peek()?.t === 'num' || isOp('(')) throw new CalcError(`Missing operator at position ${peek()!.p + 1}.`);
      return tk.v;
    }
    if (tk.v === '(') {
      i++;
      if (++depth > 100) throw new CalcError('Too many nested parentheses.');
      const v = expr();
      if (!isOp(')')) throw new CalcError('Missing closing parenthesis.');
      i++;
      depth--;
      if (peek()?.t === 'num' || isOp('(')) throw new CalcError(`Missing operator at position ${peek()!.p + 1}.`);
      return v;
    }
    throw new CalcError(`Unexpected “${tk.v}” at position ${tk.p + 1}.`);
  };

  const v = expr();
  if (i < toks.length) throw new CalcError(`Unexpected “${toks[i].v}” at position ${toks[i].p + 1}.`);
  if (!Number.isFinite(v)) throw new CalcError('The result is too large or undefined.');
  return v;
}

// ---------------------------------------------------------------- Number parsing helpers

export function parseNum(raw: string | boolean | undefined, label: string, o: { min?: number; max?: number; integer?: boolean } = {}): number {
  const s = String(raw ?? '').trim().replace(/,/g, '');
  if (s === '') throw new Error(`Enter ${label}.`);
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) throw new Error(`${cap(label)} must be a number.`);
  const n = Number(s);
  if (o.integer && !Number.isInteger(n)) throw new Error(`${cap(label)} must be a whole number.`);
  if (o.min !== undefined && n < o.min) throw new Error(`${cap(label)} must be at least ${o.min}.`);
  if (o.max !== undefined && n > o.max) throw new Error(`${cap(label)} must be at most ${o.max}.`);
  return n;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function parseNumberList(text: string): number[] {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const nums: number[] = [];
  for (const t of tokens) {
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) throw new Error(`“${t.slice(0, 30)}” is not a number. Separate numbers with spaces, commas or new lines.`);
    nums.push(Number(t));
  }
  return nums;
}

export function basicStats(nums: number[]) {
  if (nums.length === 0) throw new Error('Enter at least one number.');
  // Kahan summation reduces float error on long lists.
  let sum = 0;
  let c = 0;
  for (const n of nums) {
    const y = n - c;
    const t = sum + y;
    c = t - sum - y;
    sum = t;
  }
  return { count: nums.length, sum, mean: sum / nums.length, min: Math.min(...nums), max: Math.max(...nums) };
}

// ---------------------------------------------------------------- Money / percent

export function percentOf(p: number, of: number) {
  return (p / 100) * of;
}

export function whatPercent(part: number, whole: number) {
  if (whole === 0) throw new Error('The whole value cannot be zero.');
  return (part / whole) * 100;
}

export function percentChange(from: number, to: number) {
  if (from === 0) throw new Error('Percentage change from zero is undefined.');
  return ((to - from) / Math.abs(from)) * 100;
}

export function tip(bill: number, pct: number, people: number) {
  if (bill < 0) throw new Error('The bill cannot be negative.');
  if (!Number.isInteger(people) || people < 1) throw new Error('Number of people must be a whole number of at least 1.');
  const tipAmount = (bill * pct) / 100;
  const total = bill + tipAmount;
  return { tip: tipAmount, total, perPerson: total / people, tipPerPerson: tipAmount / people };
}

export function discount(price: number, d1: number, d2: number) {
  if (price < 0) throw new Error('Price cannot be negative.');
  if (d1 < 0 || d1 > 100 || d2 < 0 || d2 > 100) throw new Error('Discounts must be between 0 and 100%.');
  const final = price * (1 - d1 / 100) * (1 - d2 / 100);
  return { final, saved: price - final, effectivePercent: price ? ((price - final) / price) * 100 : 0 };
}

export function salesTax(amount: number, rate: number, mode: 'add' | 'extract') {
  if (amount < 0) throw new Error('Amount cannot be negative.');
  if (rate < 0 || rate > 100) throw new Error('Rate must be between 0 and 100%.');
  if (mode === 'add') {
    const tax = (amount * rate) / 100;
    return { net: amount, tax, gross: amount + tax };
  }
  const net = amount / (1 + rate / 100);
  return { net, tax: amount - net, gross: amount };
}

// ---------------------------------------------------------------- Bases

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

export function parseBigInBase(input: string, base: number): bigint {
  if (!Number.isInteger(base) || base < 2 || base > 36) throw new Error('Base must be between 2 and 36.');
  let s = input.trim().toLowerCase().replace(/[\s_]/g, '');
  let neg = false;
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  const prefix = { 16: '0x', 8: '0o', 2: '0b' }[base as 2 | 8 | 16];
  if (prefix && s.startsWith(prefix)) s = s.slice(2);
  if (!s) throw new Error('Enter a number.');
  let v = BigInt(0);
  const B = BigInt(base);
  for (const ch of s) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) throw new Error(`“${ch}” is not a valid digit in base ${base}.`);
    v = v * B + BigInt(d);
  }
  return neg ? -v : v;
}

export function bigToBase(v: bigint, base: number): string {
  return v.toString(base);
}

// ---------------------------------------------------------------- Roman numerals

const ROMAN: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new Error('Standard Roman numerals cover whole numbers from 1 to 3,999.');
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) {
    out += s;
    n -= v;
  }
  return out;
}

export function fromRoman(s: string): number {
  const t = s.trim().toUpperCase();
  if (!t || !/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(t)) throw new Error(`“${s.trim()}” is not a standard Roman numeral (for example XIV, MCMXC).`);
  let i = 0;
  let n = 0;
  for (const [v, sym] of ROMAN) while (t.startsWith(sym, i)) {
    n += v;
    i += sym.length;
  }
  return n;
}
