'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { parseNum } from '@/features/tools/math/logic';
import { formatYMD, parseDate, toDayNumber, todayLocal, weekday } from './logic';
import { nthWeekday } from './zones';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const fields: FieldDef[] = [
  { type: 'select', key: 'mode', label: 'Find', default: 'nth', choices: [{ value: 'nth', label: 'The nth weekday of a month (e.g. 2nd Monday)' }, { value: 'dow', label: 'Which weekday a date falls on' }] },
  { type: 'select', key: 'nth', label: 'Which', default: '2', choices: [{ value: '1', label: 'First' }, { value: '2', label: 'Second' }, { value: '3', label: 'Third' }, { value: '4', label: 'Fourth' }, { value: '5', label: 'Fifth' }, { value: '-1', label: 'Last' }], showIf: (v) => v.mode === 'nth' },
  { type: 'select', key: 'wd', label: 'Weekday', default: '1', choices: DAYS.map((d, i) => ({ value: String(i), label: d })), showIf: (v) => v.mode === 'nth' },
  { type: 'select', key: 'month', label: 'Month', default: String(new Date().getMonth() + 1), choices: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })), showIf: (v) => v.mode === 'nth' },
  { type: 'number', key: 'year', label: 'Year', default: String(new Date().getFullYear()), showIf: (v) => v.mode === 'nth' },
  { type: 'date', key: 'date', label: 'Date', default: todayLocal, showIf: (v) => v.mode === 'dow' },
];

function compute(v: FormValues): FormResult | null {
  if (v.mode === 'dow') {
    if (!v.date) return null;
    const d = parseDate(String(v.date));
    const today = parseDate(todayLocal());
    const diff = toDayNumber(d) - toDayNumber(today);
    return { rows: [{ label: 'Weekday', value: weekday(d), emphasis: true }, { label: 'Relative to today', value: diff === 0 ? 'Today' : `${Math.abs(diff).toLocaleString('en-US')} day${Math.abs(diff) === 1 ? '' : 's'} ${diff > 0 ? 'from now' : 'ago'}` }] };
  }
  const y = parseNum(v.year, 'the year', { integer: true, min: 1, max: 9999 });
  const m = Number(v.month);
  const r = nthWeekday(y, m, Number(v.wd), Number(v.nth));
  if (!r) return { rows: [{ label: 'Result', value: `${MONTHS[m - 1]} ${y} has no fifth ${DAYS[Number(v.wd)]}.`, emphasis: true }] };
  return { rows: [{ label: 'Date', value: `${formatYMD(r)} — ${weekday(r)}, ${r.d} ${MONTHS[m - 1]} ${y}`, emphasis: true }] };
}

export default function WeekdayFinder() {
  return <FormTool fields={fields} compute={compute} />;
}
