'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { ageOn, formatYMD, todayLocal, weekday } from './logic';

const fields: FieldDef[] = [
  { type: 'date', key: 'dob', label: 'Date of birth', default: '' },
  { type: 'date', key: 'on', label: 'Age on', default: todayLocal, hint: 'Defaults to today on this device.' },
];

const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;

function compute(v: FormValues): FormResult | null {
  if (!v.dob || !v.on) return null;
  const a = ageOn(String(v.dob), String(v.on));
  return {
    rows: [
      { label: 'Age', value: `${plural(a.years, 'year')}, ${plural(a.months, 'month')}, ${plural(a.days, 'day')}`, emphasis: true },
      { label: 'Total days', value: a.totalDays.toLocaleString('en-US') },
      { label: 'Total weeks', value: Math.floor(a.totalDays / 7).toLocaleString('en-US') },
      { label: 'Next birthday', value: a.daysToBirthday === 0 ? 'Today 🎉' : `${formatYMD(a.nextBirthday)} (${weekday(a.nextBirthday)}), in ${plural(a.daysToBirthday, 'day')} — turning ${a.turning}` },
    ],
  };
}

export default function AgeCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
