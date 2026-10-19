/**
 * Standard 5-field cron (minute hour day-of-month month day-of-week), as used by
 * Vixie cron / most Linux crontabs, plus @hourly/@daily/@weekly/@monthly/@yearly.
 * When both day-of-month and day-of-week are restricted, a time matches if EITHER does.
 */
export interface CronField {
  values: number[];
  any: boolean; // written as * (or */1)
  /** Field starts with * — used for cron's day-of-month/day-of-week OR rule. */
  star: boolean;
  text: string;
}

export interface CronSpec {
  minute: CronField;
  hour: CronField;
  dom: CronField;
  month: CronField;
  dow: CronField;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

function parseField(text: string, min: number, max: number, label: string, names?: string[]): CronField {
  const values = new Set<number>();
  const tok = (s: string): number => {
    const low = s.toLowerCase();
    if (names) {
      const idx = names.indexOf(low);
      if (idx !== -1) return idx + (label === 'month' ? 1 : 0);
    }
    if (!/^\d+$/.test(s)) throw new Error(`“${s}” is not valid in the ${label} field.`);
    let n = Number(s);
    if (label === 'day-of-week' && n === 7) n = 0;
    if (n < min || n > max) throw new Error(`${n} is outside ${min}–${max} in the ${label} field.`);
    return n;
  };
  for (const part of text.split(',')) {
    if (!part) throw new Error(`Empty list item in the ${label} field.`);
    const [rangePart, stepPart] = part.split('/');
    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) === 0) throw new Error(`Step “/${stepPart}” in the ${label} field must be a positive number.`);
      step = Number(stepPart);
    }
    let lo: number;
    let hi: number;
    if (rangePart === '*') {
      lo = min;
      hi = label === 'day-of-week' ? 6 : max;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-');
      lo = tok(a);
      hi = tok(b);
      if (label === 'day-of-week' && b === '7') hi = 7;
      if (hi < lo) throw new Error(`Range ${rangePart} in the ${label} field goes backwards.`);
    } else {
      lo = tok(rangePart);
      hi = stepPart !== undefined ? (label === 'day-of-week' ? 6 : max) : lo;
    }
    for (let v = lo; v <= hi; v += step) values.add(label === 'day-of-week' && v === 7 ? 0 : v);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const fullSize = label === 'day-of-week' ? 7 : max - min + 1;
  return { values: sorted, any: text === '*' || text === '*/1' || (sorted.length === fullSize && !text.includes('/')), star: text.startsWith('*'), text };
}

export function parseCron(expr: string): CronSpec {
  let e = expr.trim().replace(/\s+/g, ' ');
  if (MACROS[e.toLowerCase()]) e = MACROS[e.toLowerCase()];
  if (e.toLowerCase() === '@reboot') throw new Error('@reboot runs once at startup; it has no schedule to explain.');
  const parts = e.split(' ');
  if (parts.length === 6) throw new Error('This has 6 fields. Standard cron uses 5 (minute hour day month weekday); seconds fields (Quartz, some libraries) are not supported.');
  if (parts.length !== 5) throw new Error(`Expected 5 fields, found ${parts.length}.`);
  if (/[?LW#]/i.test(e.replace(/[a-z]{3}/gi, ''))) throw new Error('Quartz-only symbols (? L W #) are not part of standard cron.');
  return {
    minute: parseField(parts[0], 0, 59, 'minute'),
    hour: parseField(parts[1], 0, 23, 'hour'),
    dom: parseField(parts[2], 1, 31, 'day-of-month'),
    month: parseField(parts[3], 1, 12, 'month', MONTHS),
    dow: parseField(parts[4], 0, 7, 'day-of-week', DAYS),
  };
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function describeNums(f: CronField, unit: string, fmt: (n: number) => string = String): string {
  const step = f.text.match(/^(\*|\d+(?:-\d+)?)\/(\d+)$/);
  if (step) return `every ${step[2]} ${unit}s${step[1] !== '*' ? ` (${step[1]})` : ''}`;
  if (f.values.length > 12) return `${f.values.length} ${unit} values`;
  return `${unit} ${list(f.values.map(fmt))}`;
}

export function explainCron(spec: CronSpec): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  let time: string;
  if (!spec.minute.any && !spec.hour.any && spec.minute.values.length * spec.hour.values.length <= 6) {
    const times: string[] = [];
    for (const h of spec.hour.values) for (const m of spec.minute.values) times.push(`${p2(h)}:${p2(m)}`);
    time = `At ${list(times)}`;
  } else if (spec.minute.any && spec.hour.any) time = 'Every minute';
  else if (spec.minute.any) time = `Every minute during ${describeNums(spec.hour, 'hour', (h) => `${p2(h)}:00–${p2(h)}:59`)}`;
  else if (spec.hour.any) time = spec.minute.text.includes('/') ? `${cap(describeNums(spec.minute, 'minute'))}` : `At ${describeNums(spec.minute, 'minute')} past every hour`;
  else time = `At ${describeNums(spec.minute, 'minute')} past ${describeNums(spec.hour, 'hour')}`;

  const parts = [time];
  const domR = !spec.dom.any;
  const dowR = !spec.dow.any;
  const dows = list(spec.dow.values.map((d) => DAY_NAMES[d]));
  if (domR && dowR) {
    const either = !spec.dom.star && !spec.dow.star;
    parts.push(either ? `on ${describeNums(spec.dom, 'day-of-month')} OR on any ${dows}` : `on ${describeNums(spec.dom, 'day-of-month')} that is also a ${dows}`);
  } else if (domR) parts.push(`on ${describeNums(spec.dom, 'day-of-month')}`);
  else if (dowR) parts.push(`on ${dows}`);
  if (!spec.month.any) parts.push(`in ${list(spec.month.values.map((m) => MONTH_NAMES[m - 1]))}`);
  return parts.join(', ') + '.';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Next run times after `from` (wall-clock of a Date in the local zone of the runtime). */
export function nextRuns(spec: CronSpec, from: Date, count = 5): Date[] {
  const out: Date[] = [];
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  const has = (f: CronField, v: number) => f.values.includes(v);
  const limit = from.getTime() + 5 * 366 * 86_400_000;
  while (out.length < count && d.getTime() < limit) {
    if (!has(spec.month, d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    const domOk = has(spec.dom, d.getDate());
    const dowOk = has(spec.dow, d.getDay());
    const dayOk = !spec.dom.star && !spec.dow.star ? domOk || dowOk : domOk && dowOk;
    if (!dayOk) {
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    if (!has(spec.hour, d.getHours())) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!has(spec.minute, d.getMinutes())) {
      d.setMinutes(d.getMinutes() + 1, 0, 0);
      continue;
    }
    out.push(new Date(d.getTime()));
    d.setMinutes(d.getMinutes() + 1, 0, 0);
  }
  return out;
}
