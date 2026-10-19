/**
 * Calendar-date arithmetic on plain YYYY-MM-DD values using UTC internally,
 * so time zones and daylight-saving changes never shift the result.
 */
export interface YMD {
  y: number;
  m: number; // 1-12
  d: number;
}

const DAY = 86_400_000;

export function parseDate(s: string, label = 'date'): YMD {
  const m = String(s).trim().match(/^(-?\d{1,6})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Enter a valid ${label}.`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) throw new Error(`The ${label} does not exist on the calendar.`);
  return { y, m: mo, d };
}

export function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

export function toDayNumber(d: YMD): number {
  const t = new Date(0);
  t.setUTCFullYear(d.y, d.m - 1, d.d);
  t.setUTCHours(0, 0, 0, 0);
  return Math.round(t.getTime() / DAY);
}

export function fromDayNumber(n: number): YMD {
  const t = new Date(n * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function formatYMD(d: YMD): string {
  const y = d.y < 0 ? `-${String(-d.y).padStart(4, '0')}` : String(d.y).padStart(4, '0');
  return `${y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

export function compare(a: YMD, b: YMD): number {
  return toDayNumber(a) - toDayNumber(b);
}

function addMonthsClamped(d: YMD, months: number): YMD {
  const total = d.y * 12 + (d.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return { y, m, d: Math.min(d.d, daysInMonth(y, m)) };
}

/**
 * Calendar difference from a to b (a ≤ b): the largest whole number of months
 * that fits (adding months clamps to month end), then the remaining days.
 * 31 Jan → 1 Mar 2024 = 1 month 1 day.
 */
export function calendarDiff(a: YMD, b: YMD): { years: number; months: number; days: number } {
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (compare(addMonthsClamped(a, months), b) > 0) months--;
  const days = toDayNumber(b) - toDayNumber(addMonthsClamped(a, months));
  return { years: Math.floor(months / 12), months: months % 12, days };
}

export function dateDifference(aStr: string, bStr: string) {
  let a = parseDate(aStr, 'start date');
  let b = parseDate(bStr, 'end date');
  let sign = 1;
  if (compare(a, b) > 0) {
    [a, b] = [b, a];
    sign = -1;
  }
  const totalDays = toDayNumber(b) - toDayNumber(a);
  return { sign, totalDays, weeks: Math.floor(totalDays / 7), remDays: totalDays % 7, ...calendarDiff(a, b) };
}

export function addToDate(dStr: string, amount: number, unit: 'days' | 'weeks' | 'months' | 'years'): { result: YMD; clamped: boolean } {
  const d = parseDate(dStr);
  if (!Number.isInteger(amount)) throw new Error('Amount must be a whole number.');
  if (Math.abs(amount) > 1_000_000) throw new Error('Amount is too large.');
  if (unit === 'days' || unit === 'weeks') return { result: fromDayNumber(toDayNumber(d) + amount * (unit === 'weeks' ? 7 : 1)), clamped: false };
  const result = addMonthsClamped(d, unit === 'years' ? amount * 12 : amount);
  return { result, clamped: result.d !== d.d };
}

export function ageOn(dobStr: string, onStr: string) {
  const dob = parseDate(dobStr, 'date of birth');
  const on = parseDate(onStr, 'date');
  if (compare(dob, on) > 0) throw new Error('The date of birth is after the comparison date.');
  const diff = calendarDiff(dob, on);
  // Next birthday (29 Feb → 28 Feb in common years).
  const bday = (y: number): YMD => ({ y, m: dob.m, d: dob.m === 2 && dob.d === 29 && !isLeap(y) ? 28 : dob.d });
  let next = bday(on.y);
  if (compare(next, on) < 0) next = bday(on.y + 1);
  return {
    ...diff,
    totalDays: toDayNumber(on) - toDayNumber(dob),
    daysToBirthday: toDayNumber(next) - toDayNumber(on),
    nextBirthday: next,
    turning: next.y - dob.y,
  };
}

export function todayLocal(): string {
  const n = new Date();
  return formatYMD({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() });
}

export function weekday(d: YMD, locale?: string): string {
  const t = new Date(0);
  t.setUTCFullYear(d.y, d.m - 1, d.d);
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(t);
}

/** hh:mm:ss.cc */
export function formatClock(ms: number, showCentis = true): string {
  const total = Math.max(0, Math.floor(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return showCentis ? `${base}.${String(cs).padStart(2, '0')}` : base;
}
