'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { parseNum } from '@/features/tools/math/logic';
import { formatYMD, todayLocal, weekday } from './logic';
import { addBusinessDays, businessDays } from './zones';

const WEEKENDS: Record<string, number[]> = { satsun: [0, 6], frisat: [5, 6], sun: [0], fri: [5], none: [] };

const fields: FieldDef[] = [
  { type: 'select', key: 'mode', label: 'Calculate', default: 'between', choices: [{ value: 'between', label: 'Working days between two dates' }, { value: 'add', label: 'Date after N working days' }] },
  { type: 'date', key: 'start', label: 'Start date', default: todayLocal },
  { type: 'date', key: 'end', label: 'End date', default: () => `${new Date().getFullYear()}-12-31`, showIf: (v) => v.mode === 'between' },
  { type: 'number', key: 'n', label: 'Working days to add (negative to go back)', default: '10', showIf: (v) => v.mode === 'add' },
  { type: 'select', key: 'weekend', label: 'Weekend', default: 'satsun', choices: [{ value: 'satsun', label: 'Saturday + Sunday' }, { value: 'frisat', label: 'Friday + Saturday' }, { value: 'sun', label: 'Sunday only' }, { value: 'fri', label: 'Friday only' }, { value: 'none', label: 'No weekend' }] },
  { type: 'textarea', key: 'holidays', label: 'Holidays to skip (one date per line, YYYY-MM-DD)', default: '', placeholder: '2026-12-25' },
  { type: 'checkbox', key: 'inclusive', label: 'Count the end date too', default: true, showIf: (v) => v.mode === 'between' },
];

function compute(v: FormValues): FormResult | null {
  if (!v.start) return null;
  const holidays = String(v.holidays).split(/[\s,]+/).filter(Boolean);
  const weekend = WEEKENDS[String(v.weekend)];
  if (v.mode === 'add') {
    const r = addBusinessDays(String(v.start), parseNum(v.n, 'the number of days', { integer: true }), { weekend, holidays });
    return { rows: [{ label: 'Result', value: `${formatYMD(r)} (${weekday(r)})`, emphasis: true }], note: 'The start date itself is not counted.' };
  }
  if (!v.end) return null;
  const r = businessDays(String(v.start), String(v.end), { weekend, holidays, includeEnd: Boolean(v.inclusive) });
  return {
    rows: [
      { label: 'Working days', value: r.work.toLocaleString('en-US'), emphasis: true },
      { label: 'Weekend days', value: r.weekendDays.toLocaleString('en-US') },
      { label: 'Holidays on working days', value: r.holidays.toLocaleString('en-US') },
      { label: 'Calendar days counted', value: r.calendarDays.toLocaleString('en-US') },
    ],
    note: 'Public holidays are not built in; add the ones that apply to you.',
  };
}

export default function BusinessDays() {
  return <FormTool fields={fields} compute={compute} />;
}
