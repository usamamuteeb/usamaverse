'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { parseNum } from '@/features/tools/math/logic';
import { addToDate, formatYMD, todayLocal, weekday } from './logic';

const fields: FieldDef[] = [
  { type: 'date', key: 'date', label: 'Start date', default: todayLocal },
  { type: 'select', key: 'dir', label: 'Operation', default: 'add', choices: [{ value: 'add', label: 'Add' }, { value: 'sub', label: 'Subtract' }] },
  { type: 'number', key: 'amount', label: 'Amount', default: '30' },
  { type: 'select', key: 'unit', label: 'Unit', default: 'days', choices: [{ value: 'days', label: 'Days' }, { value: 'weeks', label: 'Weeks' }, { value: 'months', label: 'Months' }, { value: 'years', label: 'Years' }] },
];

function compute(v: FormValues): FormResult | null {
  if (!v.date) return null;
  const amount = parseNum(v.amount, 'the amount', { integer: true, min: 0 });
  const r = addToDate(String(v.date), v.dir === 'sub' ? -amount : amount, v.unit as 'days');
  return {
    rows: [
      { label: 'Result', value: formatYMD(r.result), emphasis: true },
      { label: 'Weekday', value: weekday(r.result) },
      { label: 'Long form', value: new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: 'UTC' }).format(Date.UTC(r.result.y, r.result.m - 1, r.result.d)) },
    ],
    note: r.clamped ? 'The day did not exist in the target month, so the last day of that month was used.' : undefined,
  };
}

export default function DateAddSubtract() {
  return <FormTool fields={fields} compute={compute} />;
}
