/**
 * IANA time-zone helpers built on Intl (no time-zone database is bundled; the
 * browser's own tz data is used). Handles DST gaps (non-existent local times)
 * and overlaps (ambiguous local times) explicitly.
 */
import { daysInMonth, isLeap, parseDate, toDayNumber, fromDayNumber, type YMD } from './logic';

export const FALLBACK_ZONES = [
  'UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Istanbul', 'Europe/Moscow', 'Africa/Cairo', 'Africa/Lagos',
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland', 'America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
];

export function allZones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
    if (list && list.length) return list.includes('UTC') ? list : ['UTC', ...list];
  } catch {
    /* ignore */
  }
  return FALLBACK_ZONES;
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(zone: string) {
  let f = fmtCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', era: 'short' });
    fmtCache.set(zone, f);
  }
  return f;
}

export interface WallTime extends YMD {
  hh: number;
  mm: number;
  ss: number;
}

/** Wall-clock time of an instant in a zone. */
export function wallTime(epochMs: number, zone: string): WallTime {
  const p: Record<string, string> = {};
  for (const x of partsFormatter(zone).formatToParts(new Date(epochMs))) p[x.type] = x.value;
  let y = Number(p.year);
  if (p.era === 'BC' || p.era === 'B') y = 1 - y;
  return { y, m: Number(p.month), d: Number(p.day), hh: Number(p.hour) % 24, mm: Number(p.minute), ss: Number(p.second) };
}

function wallToUtcMs(w: WallTime): number {
  return toDayNumber(w) * 86_400_000 + ((w.hh * 60 + w.mm) * 60 + w.ss) * 1000;
}

/** UTC offset of a zone at an instant, in minutes (e.g. +300 for UTC+5). */
export function offsetMinutes(epochMs: number, zone: string): number {
  const t = Math.floor(epochMs / 1000) * 1000;
  return Math.round((wallToUtcMs(wallTime(t, zone)) - t) / 60_000);
}

export function formatOffset(min: number): string {
  const s = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `UTC${s}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

export interface ZonedResolution {
  /** Instants that display as the requested wall time (0 = gap, 2 = overlap). */
  candidates: number[];
  /** The instant used: earlier candidate, or for a gap the time shifted forward by the gap length. */
  instant: number;
  kind: 'exact' | 'ambiguous' | 'nonexistent';
}

export function parseWall(dateTime: string): WallTime {
  const m = dateTime.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error('Enter a date and time.');
  const d = parseDate(m[1]);
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  const ss = Number(m[4] ?? 0);
  if (hh > 23 || mm > 59 || ss > 59) throw new Error('That time does not exist.');
  return { ...d, hh, mm, ss };
}

/** Convert a wall-clock time in a zone to UTC, reporting DST gaps and overlaps. */
export function zonedToUtc(w: WallTime, zone: string): ZonedResolution {
  const guess = wallToUtcMs(w);
  const offsets = new Set([offsetMinutes(guess - 86_400_000, zone), offsetMinutes(guess, zone), offsetMinutes(guess + 86_400_000, zone)]);
  const candidates = [...offsets]
    .map((o) => guess - o * 60_000)
    .filter((t) => wallToUtcMs(wallTime(t, zone)) === guess)
    .sort((a, b) => a - b);
  const unique = [...new Set(candidates)];
  if (unique.length === 1) return { candidates: unique, instant: unique[0], kind: 'exact' };
  if (unique.length > 1) return { candidates: unique, instant: unique[0], kind: 'ambiguous' };
  // Gap: use the offset in effect before the transition (time moves forward by the gap).
  const before = offsetMinutes(guess - 86_400_000, zone);
  return { candidates: [], instant: guess - before * 60_000, kind: 'nonexistent' };
}

export function formatInZone(epochMs: number, zone: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: zone }).format(new Date(epochMs));
}

export function zoneAbbrev(epochMs: number, zone: string): string {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(new Date(epochMs));
    return p.find((x) => x.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

export function wallToString(w: WallTime): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(w.y).padStart(4, '0')}-${p(w.m)}-${p(w.d)} ${p(w.hh)}:${p(w.mm)}`;
}

// ---------------------------------------------------------------- ISO formats

export function isoWeek(d: YMD): { year: number; week: number; weekday: number } {
  const n = toDayNumber(d);
  const weekday = ((((n + 3) % 7) + 7) % 7) + 1; // 1970-01-01 was Thursday → Mon=1..Sun=7
  const thursday = n - weekday + 4;
  const ty = fromDayNumber(thursday).y;
  const jan1 = toDayNumber({ y: ty, m: 1, d: 1 });
  return { year: ty, week: Math.floor((thursday - jan1) / 7) + 1, weekday };
}

/** US convention: weeks start Sunday; week 1 is the week containing 1 January. */
export function usWeek(d: YMD): number {
  const n = toDayNumber(d);
  const jan1 = toDayNumber({ y: d.y, m: 1, d: 1 });
  const jan1Dow = (((jan1 + 4) % 7) + 7) % 7; // Sun=0
  return Math.floor((n - jan1 + jan1Dow) / 7) + 1;
}

export function dayOfYear(d: YMD): number {
  return toDayNumber(d) - toDayNumber({ y: d.y, m: 1, d: 1 }) + 1;
}

export function weekdayIndex(d: YMD): number {
  return (((toDayNumber(d) + 4) % 7) + 7) % 7; // Sun=0 … Sat=6
}

/** nth (1..5, or -1 for last) weekday (0=Sun) of a month. */
export function nthWeekday(y: number, m: number, weekday: number, nth: number): YMD | null {
  const dim = daysInMonth(y, m);
  if (nth === -1) {
    for (let d = dim; d >= 1; d--) if (weekdayIndex({ y, m, d }) === weekday) return { y, m, d };
    return null;
  }
  let count = 0;
  for (let d = 1; d <= dim; d++) {
    if (weekdayIndex({ y, m, d }) === weekday && ++count === nth) return { y, m, d };
  }
  return null;
}

export { isLeap };

// ---------------------------------------------------------------- Business days

export function businessDays(aStr: string, bStr: string, o: { weekend: number[]; holidays: string[]; includeEnd: boolean }) {
  const a = toDayNumber(parseDate(aStr, 'start date'));
  const b = toDayNumber(parseDate(bStr, 'end date'));
  if (b < a) throw new Error('The end date is before the start date.');
  if (b - a > 366 * 200) throw new Error('Range is limited to 200 years.');
  const hol = new Set(o.holidays.map((h) => toDayNumber(parseDate(h, `holiday “${h}”`))));
  let work = 0;
  let weekendDays = 0;
  let holidays = 0;
  const last = o.includeEnd ? b : b - 1;
  for (let n = a; n <= last; n++) {
    const dow = (((n + 4) % 7) + 7) % 7;
    if (o.weekend.includes(dow)) weekendDays++;
    else if (hol.has(n)) holidays++;
    else work++;
  }
  return { work, weekendDays, holidays, calendarDays: last - a + 1 };
}

export function addBusinessDays(startStr: string, count: number, o: { weekend: number[]; holidays: string[] }): YMD {
  if (!Number.isInteger(count) || Math.abs(count) > 100_000) throw new Error('Use a whole number up to 100,000.');
  if (o.weekend.length >= 7) throw new Error('At least one weekday must be a working day.');
  const hol = new Set(o.holidays.map((h) => toDayNumber(parseDate(h, `holiday “${h}”`))));
  let n = toDayNumber(parseDate(startStr));
  const step = count < 0 ? -1 : 1;
  let left = Math.abs(count);
  while (left > 0) {
    n += step;
    const dow = (((n + 4) % 7) + 7) % 7;
    if (!o.weekend.includes(dow) && !hol.has(n)) left--;
  }
  return fromDayNumber(n);
}

// ---------------------------------------------------------------- Durations

/** Parse "1:30:00" (h:mm:ss), "1:30" (h:mm), "1h 30m 20s", "90m", "2.5h" → seconds. */
export function parseDuration(token: string): number {
  const t = token.trim().toLowerCase();
  if (!t) throw new Error('Empty duration.');
  const colon = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?$/);
  if (colon) {
    const [a, b, c] = [Number(colon[1]), Number(colon[2]), colon[3] !== undefined ? Number(colon[3]) : null];
    if (b > 59 || (c !== null && c >= 60)) throw new Error(`“${token}” has minutes or seconds above 59.`);
    return a * 3600 + b * 60 + (c ?? 0); // h:mm or h:mm:ss (like spreadsheets)
  }
  const unitRe = /(\d+(?:\.\d+)?)\s*(d|days?|h|hrs?|hours?|m|mins?|minutes?|s|secs?|seconds?)/g;
  let total = 0;
  let consumed = '';
  for (const m of t.matchAll(unitRe)) {
    const v = Number(m[1]);
    const u = m[2][0];
    total += v * (u === 'd' ? 86400 : u === 'h' ? 3600 : u === 'm' ? 60 : 1);
    consumed += m[0];
  }
  if (consumed.replace(/\s/g, '') !== t.replace(/\s/g, '')) throw new Error(`Could not read “${token}”. Use forms like 1:30:00, 45m or 1h 20m.`);
  return total;
}

export function sumDurations(expr: string): number {
  const cleaned = expr.replace(/\r?\n/g, ' + ').trim();
  if (!cleaned) throw new Error('Enter some durations.');
  const parts = cleaned.split(/\s*([+-])\s*/).filter((x) => x !== '');
  let sign = 1;
  let total = 0;
  let expectValue = true;
  for (const p of parts) {
    if (p === '+' || p === '-') {
      if (p === '-') sign = -sign;
      expectValue = true;
      continue;
    }
    if (!expectValue) throw new Error('Put + or − between durations.');
    total += sign * parseDuration(p);
    sign = 1;
    expectValue = false;
  }
  return total;
}

export function formatHms(totalSeconds: number): string {
  const neg = totalSeconds < 0;
  let s = Math.round(Math.abs(totalSeconds));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return `${neg ? '−' : ''}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export { daysInMonth };
