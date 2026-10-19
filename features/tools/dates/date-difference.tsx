'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { dateDifference, parseDate, todayLocal, weekday } from './logic';

const fields: FieldDef[] = [
  { type: 'date', key: 'a', label: 'Start date', default: todayLocal },
  { type: 'date', key: 'b', label: 'End date', default: () => `${new Date().getFullYear()}-12-31` },
  { type: 'checkbox', key: 'inclusive', label: 'Include the end date (count both days)', default: false },
];

const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;

function compute(v: FormValues): FormResult | null {
  if (!v.a || !v.b) return null;
  const d = dateDifference(String(v.a), String(v.b));
  const days = d.totalDays + (v.inclusive ? 1 : 0);
  return {
    rows: [
      { label: 'Total', value: `${d.sign < 0 ? '−' : ''}${plural(days, 'day')}`, emphasis: true },
      { label: 'In weeks', value: `${plural(Math.floor(days / 7), 'week')}, ${plural(days % 7, 'day')}` },
      { label: 'Calendar difference', value: `${plural(d.years, 'year')}, ${plural(d.months, 'month')}, ${plural(d.days, 'day')}` },
      { label: 'Start weekday', value: weekday(parseDate(String(v.a))) },
      { label: 'End weekday', value: weekday(parseDate(String(v.b))) },
    ],
    note: d.sign < 0 ? 'The end date is before the start date, so the difference is negative.' : undefined,
  };
}

export default function DateDifference() {
  return <FormTool fields={fields} compute={compute} />;
}
