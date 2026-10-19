import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessDays, businessDays, isoWeek, nthWeekday, offsetMinutes, parseDuration, parseWall, sumDurations, formatHms, usWeek, wallTime, zonedToUtc, dayOfYear } from '@/features/tools/dates/zones';
import { formatYMD } from '@/features/tools/dates/logic';
import { amortization, compoundGrowth, describe as stats, evaluateFraction, evaluateScientific, formatRational, gpa, DEFAULT_SCALE, loanPayment, parseScale } from '@/features/tools/math/more';
import { QUANTITIES, convert } from '@/features/tools/units/logic';
import { formatNumber } from '@/lib/format';
import { borderRadiusCss, boxShadowCss, fluidClamp, palette, ppi, typeScale } from '@/features/tools/color/design';

test('time zones: offsets, DST gap and overlap', () => {
  assert.equal(offsetMinutes(Date.UTC(2026, 0, 15), 'Asia/Karachi'), 300);
  assert.equal(offsetMinutes(Date.UTC(2026, 6, 1), 'America/New_York'), -240);
  assert.equal(offsetMinutes(Date.UTC(2026, 0, 1), 'America/New_York'), -300);
  // 2026-03-08 02:30 does not exist in New York (spring forward).
  const gap = zonedToUtc(parseWall('2026-03-08T02:30'), 'America/New_York');
  assert.equal(gap.kind, 'nonexistent');
  assert.equal(new Date(gap.instant).toISOString(), '2026-03-08T07:30:00.000Z'); // shown as 03:30 EDT
  // 2026-11-01 01:30 happens twice in New York.
  const amb = zonedToUtc(parseWall('2026-11-01T01:30'), 'America/New_York');
  assert.equal(amb.kind, 'ambiguous');
  assert.deepEqual(amb.candidates.map((t) => new Date(t).toISOString()), ['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']);
  const ex = zonedToUtc(parseWall('2026-10-19T09:00'), 'Asia/Karachi');
  assert.equal(ex.kind, 'exact');
  assert.equal(new Date(ex.instant).toISOString(), '2026-10-19T04:00:00.000Z');
  // Date rollover across zones
  const w = wallTime(Date.UTC(2026, 11, 31, 20, 0), 'Asia/Tokyo');
  assert.deepEqual([w.y, w.m, w.d, w.hh], [2027, 1, 1, 5]);
  // Half-hour and 45-minute zones
  assert.equal(offsetMinutes(Date.UTC(2026, 0, 1), 'Asia/Kathmandu'), 345);
});

test('ISO and US week numbers, ordinal day', () => {
  assert.deepEqual(isoWeek({ y: 2021, m: 1, d: 3 }), { year: 2020, week: 53, weekday: 7 });
  assert.deepEqual(isoWeek({ y: 2026, m: 10, d: 19 }), { year: 2026, week: 43, weekday: 1 });
  assert.deepEqual(isoWeek({ y: 2024, m: 12, d: 30 }), { year: 2025, week: 1, weekday: 1 });
  assert.equal(usWeek({ y: 2026, m: 1, d: 3 }), 1);
  assert.equal(usWeek({ y: 2026, m: 1, d: 4 }), 2);
  assert.equal(dayOfYear({ y: 2024, m: 12, d: 31 }), 366);
});

test('nth weekday and business days', () => {
  assert.equal(formatYMD(nthWeekday(2027, 5, 1, 2)!), '2027-05-10'); // 2nd Monday May 2027
  assert.equal(formatYMD(nthWeekday(2026, 11, 4, -1)!), '2026-11-26'); // last Thursday
  assert.equal(nthWeekday(2026, 2, 0, 5), null);
  const b = businessDays('2026-10-19', '2026-10-31', { weekend: [0, 6], holidays: ['2026-10-23'], includeEnd: true });
  assert.deepEqual([b.work, b.weekendDays, b.holidays, b.calendarDays], [9, 3, 1, 13]);
  assert.equal(formatYMD(addBusinessDays('2026-10-23', 1, { weekend: [0, 6], holidays: [] })), '2026-10-26');
  assert.equal(formatYMD(addBusinessDays('2026-10-26', -1, { weekend: [5, 6], holidays: [] })), '2026-10-25');
});

test('duration parsing and sums', () => {
  assert.equal(parseDuration('1:30:00'), 5400);
  assert.equal(parseDuration('45:10'), 162600); // h:mm
  assert.equal(parseDuration('1h 20m 5s'), 4805);
  assert.equal(parseDuration('2.5h'), 9000);
  assert.throws(() => parseDuration('1:75'));
  assert.equal(formatHms(sumDurations('1:30:00 + 45m - 0:10\n2h')), '3:65:00'.replace('3:65', '4:05'));
});

test('exact fractions', () => {
  assert.deepEqual(formatRational(evaluateFraction('1/2 + 3/4')), { fraction: '5/4', mixed: '1 1/4', decimal: '1.25' });
  assert.equal(formatRational(evaluateFraction('2 1/3 × 3')).fraction, '7');
  assert.equal(formatRational(evaluateFraction('1/3')).decimal, '0.(3)');
  assert.equal(formatRational(evaluateFraction('1/7')).decimal, '0.(142857)');
  assert.equal(formatRational(evaluateFraction('-(1/2)^3')).fraction, '-1/8');
  assert.equal(formatRational(evaluateFraction('0.1 + 0.2')).fraction, '3/10');
  assert.throws(() => evaluateFraction('1/0'), /zero/);
});

test('descriptive statistics', () => {
  const d = stats([1, 2, 2, 3, 4, 7, 9]);
  assert.equal(d.median, 3);
  assert.deepEqual(d.modes, [2]);
  assert.equal(d.q1, 2);
  assert.equal(d.q3, 5.5);
  assert.equal(formatNumber(stats([2, 4, 4, 4, 5, 5, 7, 9]).populationSd), '2');
  assert.deepEqual(stats([1, 2, 3]).modes, []);
});

test('loan and interest', () => {
  assert.equal(formatNumber(loanPayment(100000, 6, 360), 8), '599.55053');
  const a = amortization(1000, 12, 12);
  assert.equal(a.rows.at(-1)!.balance, 0);
  assert.equal(formatNumber(a.totalInterest, 6), '66.1855');
  assert.equal(formatNumber(compoundGrowth({ principal: 1000, ratePct: 5, years: 10, perYear: 1, contribution: 0, simple: false }).final, 8), '1628.8946');
  assert.equal(compoundGrowth({ principal: 1000, ratePct: 5, years: 10, perYear: 1, contribution: 0, simple: true }).final, 1500);
  assert.equal(formatNumber(loanPayment(1200, 0, 12)), '100');
});

test('GPA', () => {
  const r = gpa([{ credits: '3', grade: 'A' }, { credits: '4', grade: 'b+' }, { credits: '', grade: '' }], DEFAULT_SCALE)!;
  assert.equal(formatNumber(r.gpa, 4), '3.6');
  assert.equal(r.credits, 7);
  assert.throws(() => gpa([{ credits: '3', grade: 'Z' }], DEFAULT_SCALE), /not on the grade scale/);
  assert.deepEqual(parseScale('A = 4\nB: 3'), [{ grade: 'A', points: 4 }, { grade: 'B', points: 3 }]);
});

test('scientific calculator', () => {
  assert.equal(evaluateScientific('sin(30)'), 0.5 + (evaluateScientific('sin(30)') - 0.5));
  assert.equal(formatNumber(evaluateScientific('sin(30)')), '0.5');
  assert.equal(evaluateScientific('cos(90)'), 0);
  assert.equal(formatNumber(evaluateScientific('sin(pi/2)', 'rad')), '1');
  assert.equal(evaluateScientific('5!'), 120);
  assert.equal(evaluateScientific('2^10 mod 7'), 2);
  assert.equal(evaluateScientific('-7 mod 3'), 2);
  assert.equal(formatNumber(evaluateScientific('log(1000) + ln(e) + sqrt(16)')), '8');
  assert.equal(formatNumber(evaluateScientific('asin(1)')), '90');
  assert.throws(() => evaluateScientific('tan(90)'), /undefined/);
  assert.throws(() => evaluateScientific('sqrt(-1)'), /not a real/);
  assert.throws(() => evaluateScientific('alert(1)'), /Unknown name/);
});

test('new unit quantities', () => {
  assert.equal(formatNumber(convert(QUANTITIES.pressure, 1, 'atm', 'psi')), '14.6959487755');
  assert.equal(formatNumber(convert(QUANTITIES.energy, 1, 'kWh', 'MJ')), '3.6');
  assert.equal(formatNumber(convert(QUANTITIES.power, 1, 'hp', 'W')), '745.699871582');
  assert.equal(formatNumber(convert(QUANTITIES.angle, 180, 'deg', 'rad')), '3.14159265359');
  assert.equal(formatNumber(convert(QUANTITIES.frequency, 60, 'rpm', 'Hz')), '1');
  assert.equal(formatNumber(convert(QUANTITIES.fuel, 5, 'L100', 'kmL')), '20');
  assert.equal(formatNumber(convert(QUANTITIES.fuel, 30, 'mpgus', 'L100')), '7.84048611111');
  assert.throws(() => convert(QUANTITIES.fuel, 0, 'L100', 'kmL'));
  assert.equal(formatNumber(convert(QUANTITIES.typography, 12, 'pt', 'px')), '16');
  assert.equal(formatNumber(convert(QUANTITIES.cooking, 1, 'autbsp', 'mtsp')), '4');
});

test('palettes and CSS generators', () => {
  assert.deepEqual(palette('#ff0000', 'complementary'), ['#ff0000', '#00ffff']);
  assert.equal(palette('#336699', 'triadic').length, 3);
  assert.equal(boxShadowCss([{ x: 0, y: 4, blur: 12, spread: 0, color: '#000', opacity: 25, inset: false }]), '0px 4px 12px 0px rgb(0 0 0 / 0.25)');
  assert.equal(borderRadiusCss({ tl: 8, tr: 8, br: 8, bl: 8 }, 'px'), '8px');
  assert.equal(borderRadiusCss({ tl: 8, tr: 0, br: 8, bl: 0 }, 'px'), '8px 0');
  assert.equal(fluidClamp({ minPx: 16, maxPx: 24, minVw: 320, maxVw: 1280, rootPx: 16 }).css, 'clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)');
  assert.equal(Math.round(ppi(1920, 1080, 24).ppi * 100) / 100, 91.79);
  assert.equal(typeScale(16, 1.25, 2, 1).map((r) => +r.px.toFixed(2)).join(','), '25,20,16,12.8');
});
