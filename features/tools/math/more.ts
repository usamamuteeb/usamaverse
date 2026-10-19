import { CalcError } from './logic';

// ---------------------------------------------------------------- Exact fractions (BigInt)

export interface Rational {
  n: bigint;
  d: bigint;
}

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TEN = BigInt(10);

function bgcd(a: bigint, b: bigint): bigint {
  if (a < ZERO) a = -a;
  if (b < ZERO) b = -b;
  while (b) [a, b] = [b, a % b];
  return a;
}

export function rat(n: bigint, d: bigint = ONE): Rational {
  if (d === ZERO) throw new CalcError('Division by zero.');
  if (d < ZERO) {
    n = -n;
    d = -d;
  }
  const g = bgcd(n, d) || ONE;
  return { n: n / g, d: d / g };
}

const add = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Rational, b: Rational) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
const div = (a: Rational, b: Rational) => {
  if (b.n === ZERO) throw new CalcError('Division by zero.');
  return rat(a.n * b.d, a.d * b.n);
};
function pow(a: Rational, e: Rational): Rational {
  if (e.d !== ONE) throw new CalcError('Exponents must be whole numbers in exact fraction mode.');
  if (e.n > BigInt(1000) || e.n < BigInt(-1000)) throw new CalcError('Exponent is too large.');
  const k = Number(e.n);
  if (k < 0) return div(rat(ONE), pow(a, rat(BigInt(-k))));
  return rat(a.n ** BigInt(k), a.d ** BigInt(k));
}

function decimalToRat(s: string): Rational {
  const [i, f = ''] = s.split('.');
  return rat(BigInt((i || '0') + f), TEN ** BigInt(f.length));
}

/** Evaluate + − × ÷ ^ and parentheses over exact fractions. "2 1/3" is read as a mixed number. */
export function evaluateFraction(src: string): Rational {
  if (src.length > 500) throw new CalcError('Expression is too long.');
  let s = src.replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-');
  // Mixed numbers: "2 1/3" → "(2+1/3)", "-2 1/3" handled by unary minus outside parentheses.
  s = s.replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, '($1+$2/$3)');
  const toks = s.match(/\d+\.\d*|\.\d+|\d+|[-+*/^()]|\S/g) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const expr = (): Rational => {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = toks[i++];
      const r = term();
      v = op === '+' ? add(v, r) : sub(v, r);
    }
    return v;
  };
  const term = (): Rational => {
    let v = unary();
    while (peek() === '*' || peek() === '/') {
      const op = toks[i++];
      const r = unary();
      v = op === '*' ? mul(v, r) : div(v, r);
    }
    return v;
  };
  const unary = (): Rational => {
    if (peek() === '-') {
      i++;
      const v = unary();
      return rat(-v.n, v.d);
    }
    if (peek() === '+') {
      i++;
      return unary();
    }
    return power();
  };
  const power = (): Rational => {
    const b = primary();
    if (peek() === '^') {
      i++;
      return pow(b, unary());
    }
    return b;
  };
  const primary = (): Rational => {
    const t = peek();
    if (t === undefined) throw new CalcError('The expression ends too early.');
    if (/^[\d.]/.test(t)) {
      i++;
      return decimalToRat(t);
    }
    if (t === '(') {
      i++;
      const v = expr();
      if (peek() !== ')') throw new CalcError('Missing closing parenthesis.');
      i++;
      return v;
    }
    throw new CalcError(`Unexpected “${t}”.`);
  };
  if (toks.length === 0) throw new CalcError('Enter an expression.');
  const v = expr();
  if (i < toks.length) throw new CalcError(`Unexpected “${toks[i]}”.`);
  return v;
}

export function formatRational(r: Rational) {
  const neg = r.n < ZERO;
  const an = neg ? -r.n : r.n;
  const whole = an / r.d;
  const rem = an % r.d;
  const fraction = r.d === ONE ? `${r.n}` : `${r.n}/${r.d}`;
  const mixed = r.d === ONE || whole === ZERO ? fraction : `${neg ? '-' : ''}${whole} ${rem}/${r.d}`;
  return { fraction, mixed, decimal: rationalToDecimal(r, 15) };
}

/** Exact long division; marks repeating decimals with parentheses when they fit. */
export function rationalToDecimal(r: Rational, maxDigits = 15): string {
  const neg = r.n < ZERO;
  let n = neg ? -r.n : r.n;
  const whole = n / r.d;
  n %= r.d;
  if (n === ZERO) return `${neg ? '-' : ''}${whole}`;
  const seen = new Map<string, number>();
  let digits = '';
  while (n !== ZERO && digits.length < maxDigits) {
    const key = n.toString();
    if (seen.has(key)) {
      const at = seen.get(key)!;
      return `${neg ? '-' : ''}${whole}.${digits.slice(0, at)}(${digits.slice(at)})`;
    }
    seen.set(key, digits.length);
    n *= TEN;
    digits += (n / r.d).toString();
    n %= r.d;
  }
  return `${neg ? '-' : ''}${whole}.${digits}${n !== ZERO ? '…' : ''}`;
}

// ---------------------------------------------------------------- Descriptive statistics

function quantile(sorted: number[], p: number): number {
  // Linear interpolation between closest ranks (same as Excel QUARTILE.INC / NumPy default).
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function describe(nums: number[]) {
  if (nums.length === 0) throw new Error('Enter at least one number.');
  const s = nums.slice().sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const counts = new Map<number, number>();
  s.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
  const maxCount = Math.max(...counts.values());
  const modes = maxCount === 1 ? [] : [...counts.entries()].filter(([, c]) => c === maxCount).map(([v]) => v);
  const ss = s.reduce((a, x) => a + (x - mean) ** 2, 0);
  return {
    count: n,
    median: quantile(s, 0.5),
    modes,
    modeCount: maxCount,
    mean,
    min: s[0],
    max: s[n - 1],
    range: s[n - 1] - s[0],
    q1: quantile(s, 0.25),
    q3: quantile(s, 0.75),
    populationSd: Math.sqrt(ss / n),
    sampleSd: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN,
  };
}

// ---------------------------------------------------------------- Loans & interest

export function loanPayment(principal: number, annualRatePct: number, months: number): number {
  if (!(principal > 0)) throw new Error('Loan amount must be greater than zero.');
  if (!Number.isInteger(months) || months < 1 || months > 1200) throw new Error('Term must be 1 to 1,200 months.');
  if (annualRatePct < 0 || annualRatePct > 100) throw new Error('Rate must be between 0 and 100%.');
  const r = annualRatePct / 100 / 12;
  return r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);
}

export interface AmortRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export function amortization(principal: number, annualRatePct: number, months: number): { payment: number; rows: AmortRow[]; totalInterest: number } {
  const payment = loanPayment(principal, annualRatePct, months);
  const r = annualRatePct / 100 / 12;
  let balance = principal;
  let totalInterest = 0;
  const rows: AmortRow[] = [];
  for (let m = 1; m <= months; m++) {
    const interest = balance * r;
    let princ = payment - interest;
    if (m === months) princ = balance; // absorb rounding in the final payment
    balance -= princ;
    totalInterest += interest;
    rows.push({ month: m, payment: princ + interest, interest, principal: princ, balance: Math.abs(balance) < 1e-7 ? 0 : balance });
  }
  return { payment, rows, totalInterest };
}

export function compoundGrowth(o: { principal: number; ratePct: number; years: number; perYear: number; contribution: number; simple: boolean }) {
  const { principal, ratePct, years, perYear, contribution, simple } = o;
  if (principal < 0 || contribution < 0) throw new Error('Amounts cannot be negative.');
  if (!(years > 0) || years > 200) throw new Error('Years must be between 0 and 200.');
  if (ratePct < -100 || ratePct > 1000) throw new Error('Rate is out of range.');
  const r = ratePct / 100;
  const yearly: Array<{ year: number; balance: number; contributed: number; interest: number }> = [];
  if (simple) {
    for (let y = 1; y <= Math.ceil(years); y++) {
      const t = Math.min(y, years);
      const balance = principal * (1 + r * t);
      yearly.push({ year: y, balance, contributed: principal, interest: balance - principal });
    }
    return { final: principal * (1 + r * years), contributed: principal, yearly };
  }
  if (![1, 2, 4, 12, 52, 365].includes(perYear)) throw new Error('Unsupported compounding frequency.');
  const periods = Math.round(years * perYear);
  const i = r / perYear;
  const monthlyEquivalentPerPeriod = (contribution * 12) / perYear; // contribution entered per month
  let bal = principal;
  let contributed = principal;
  for (let p = 1; p <= periods; p++) {
    bal = bal * (1 + i) + monthlyEquivalentPerPeriod;
    contributed += monthlyEquivalentPerPeriod;
    if (p % perYear === 0 || p === periods) yearly.push({ year: Math.ceil(p / perYear), balance: bal, contributed, interest: bal - contributed });
  }
  return { final: bal, contributed, yearly };
}

// ---------------------------------------------------------------- GPA

export interface GradeScaleEntry {
  grade: string;
  points: number;
}

export const DEFAULT_SCALE: GradeScaleEntry[] = [
  { grade: 'A+', points: 4.0 }, { grade: 'A', points: 4.0 }, { grade: 'A-', points: 3.7 },
  { grade: 'B+', points: 3.3 }, { grade: 'B', points: 3.0 }, { grade: 'B-', points: 2.7 },
  { grade: 'C+', points: 2.3 }, { grade: 'C', points: 2.0 }, { grade: 'C-', points: 1.7 },
  { grade: 'D+', points: 1.3 }, { grade: 'D', points: 1.0 }, { grade: 'F', points: 0 },
];

export function parseScale(text: string): GradeScaleEntry[] {
  const out: GradeScaleEntry[] = [];
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const m = line.match(/^\s*([^=:\t,]+?)\s*[=:\t,]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) throw new Error(`Scale line ${i + 1} should look like “A = 4.0”.`);
    out.push({ grade: m[1].trim().toUpperCase(), points: Number(m[2]) });
  }
  if (!out.length) throw new Error('The grade scale is empty.');
  return out;
}

export function gpa(courses: Array<{ credits: string; grade: string }>, scale: GradeScaleEntry[]) {
  const map = new Map(scale.map((s) => [s.grade.toUpperCase(), s.points]));
  let credits = 0;
  let points = 0;
  let used = 0;
  courses.forEach((c, idx) => {
    if (!c.credits.trim() && !c.grade.trim()) return;
    const cr = Number(c.credits);
    if (!(cr > 0)) throw new Error(`Course ${idx + 1}: credits must be a positive number.`);
    const g = c.grade.trim().toUpperCase();
    const p = map.has(g) ? map.get(g)! : /^\d+(\.\d+)?$/.test(g) ? Number(g) : NaN;
    if (Number.isNaN(p)) throw new Error(`Course ${idx + 1}: “${c.grade}” is not on the grade scale.`);
    credits += cr;
    points += cr * p;
    used++;
  });
  if (!used) return null;
  return { gpa: points / credits, credits, qualityPoints: points, courses: used };
}

// ---------------------------------------------------------------- Scientific calculator

const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
};
const TRIG = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan'] as const;

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new CalcError('Factorial needs a whole number ≥ 0.');
  if (n > 170) throw new CalcError('Factorial above 170! is too large.');
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

/**
 * Scientific expression evaluator (no eval). Supports + − × ÷ ^ % mod, n!, parentheses,
 * constants pi π e, functions sin cos tan asin acos atan (degrees or radians) and
 * sqrt cbrt abs exp ln log log2 floor ceil round sinh cosh tanh.
 */
export function evaluateScientific(src: string, angle: 'deg' | 'rad' = 'deg', ans = 0): number {
  if (src.length > 1000) throw new CalcError('Expression is too long.');
  const s = src.replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt').toLowerCase();
  const toks = s.match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?|[a-z][a-z0-9]*|\*\*|[-+*/^()%!,]|\S/g) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const toRad = (x: number) => (angle === 'deg' ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (angle === 'deg' ? (x * 180) / Math.PI : x);
  const clean = (x: number) => (Math.abs(x) < 1e-15 ? 0 : x);

  const expr = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = toks[i++];
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const term = (): number => {
    let v = unary();
    while (peek() === '*' || peek() === '/' || peek() === 'mod') {
      const op = toks[i++];
      const r = unary();
      if ((op === '/' || op === 'mod') && r === 0) throw new CalcError('Division by zero.');
      v = op === '*' ? v * r : op === '/' ? v / r : ((v % r) + r) % r;
    }
    return v;
  };
  const unary = (): number => {
    if (peek() === '-') {
      i++;
      return -unary();
    }
    if (peek() === '+') {
      i++;
      return unary();
    }
    return power();
  };
  const power = (): number => {
    const b = postfix();
    if (peek() === '^' || peek() === '**') {
      i++;
      return b ** unary();
    }
    return b;
  };
  const postfix = (): number => {
    let v = primary();
    for (;;) {
      if (peek() === '!') {
        i++;
        v = factorial(v);
      } else if (peek() === '%') {
        i++;
        v /= 100;
      } else break;
    }
    return v;
  };
  const primary = (): number => {
    const t = peek();
    if (t === undefined) throw new CalcError('The expression ends too early.');
    if (/^[\d.]/.test(t)) {
      i++;
      return parseFloat(t);
    }
    if (t === '(') {
      i++;
      const v = expr();
      if (peek() !== ')') throw new CalcError('Missing closing parenthesis.');
      i++;
      return v;
    }
    if (/^[a-z]/.test(t)) {
      i++;
      if (t === 'pi') return Math.PI;
      if (t === 'e') return Math.E;
      if (t === 'ans') return ans;
      const isTrig = (TRIG as readonly string[]).includes(t);
      if (!isTrig && !FUNCS[t]) throw new CalcError(`Unknown name “${t}”.`);
      if (peek() !== '(') throw new CalcError(`Use parentheses after ${t}, like ${t}(30).`);
      i++;
      const x = expr();
      if (peek() !== ')') throw new CalcError('Missing closing parenthesis.');
      i++;
      switch (t) {
        case 'sin':
          return clean(Math.sin(toRad(x)));
        case 'cos':
          return clean(Math.cos(toRad(x)));
        case 'tan': {
          if (angle === 'deg' && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-12) throw new CalcError('tan is undefined at 90° + k·180°.');
          return clean(Math.tan(toRad(x)));
        }
        case 'asin':
          if (x < -1 || x > 1) throw new CalcError('asin needs a value between −1 and 1.');
          return fromRad(Math.asin(x));
        case 'acos':
          if (x < -1 || x > 1) throw new CalcError('acos needs a value between −1 and 1.');
          return fromRad(Math.acos(x));
        case 'atan':
          return fromRad(Math.atan(x));
        default:
          if ((t === 'sqrt' || t.startsWith('log') || t === 'ln') && x < 0) throw new CalcError(`${t} of a negative number is not a real number.`);
          if ((t.startsWith('log') || t === 'ln') && x === 0) throw new CalcError(`${t}(0) is undefined.`);
          return FUNCS[t](x);
      }
    }
    throw new CalcError(`Unexpected “${t}”.`);
  };
  if (toks.length === 0) throw new CalcError('Enter an expression.');
  const v = expr();
  if (i < toks.length) throw new CalcError(`Unexpected “${toks[i]}”.`);
  if (!Number.isFinite(v)) throw new CalcError('The result is too large or undefined.');
  return v;
}

