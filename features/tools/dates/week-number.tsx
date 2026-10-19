'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatYMD, fromDayNumber, parseDate, toDayNumber, todayLocal, weekday } from './logic';
import { dayOfYear, isoWeek, usWeek } from './zones';

const fields: FieldDef[] = [{ type: 'date', key: 'date', label: 'Date', default: todayLocal }];

function compute(v: FormValues): FormResult | null {
  if (!v.date) return null;
  const d = parseDate(String(v.date));
  const iso = isoWeek(d);
  const n = toDayNumber(d);
  const monday = fromDayNumber(n - (iso.weekday - 1));
  const sunday = fromDayNumber(n - (iso.weekday - 1) + 6);
  return {
    rows: [
      { label: 'ISO 8601 week', value: `Week ${iso.week} of ${iso.year} (${iso.year}-W${String(iso.week).padStart(2, '0')})`, emphasis: true },
      { label: 'ISO week runs', value: `${formatYMD(monday)} (Mon) → ${formatYMD(sunday)} (Sun)` },
      { label: 'US convention week', value: `Week ${usWeek(d)} of ${d.y}` },
      { label: 'Weekday', value: weekday(d) },
      { label: 'Day of year', value: String(dayOfYear(d)) },
    ],
    note: 'ISO weeks start on Monday and week 1 contains the first Thursday of the year (so early January can belong to the previous year’s week 52/53). The US convention starts weeks on Sunday with week 1 containing 1 January.',
  };
}

export default function WeekNumber() {
  return <FormTool fields={fields} compute={compute} />;
}
