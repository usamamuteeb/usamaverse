'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatHms, sumDurations } from './zones';

const fields: FieldDef[] = [
  { type: 'textarea', key: 'expr', label: 'Durations', default: '1:30 + 45m\n2h 15m\n- 0:20', hint: 'One per line (lines are added) or with + and −. Formats: 1:30 (h:mm), 1:30:15 (h:mm:ss), 2h 15m 10s, 90m, 1.5h.' },
];

function compute(v: FormValues): FormResult | null {
  if (!String(v.expr).trim()) return null;
  const s = sumDurations(String(v.expr));
  const a = Math.abs(s);
  return {
    rows: [
      { label: 'Total (h:mm:ss)', value: formatHms(s), emphasis: true },
      { label: 'Days, hours, minutes', value: `${s < 0 ? '−' : ''}${Math.floor(a / 86400)}d ${Math.floor((a % 86400) / 3600)}h ${Math.floor((a % 3600) / 60)}m ${Math.round(a % 60)}s` },
      { label: 'Decimal hours', value: (s / 3600).toFixed(4).replace(/\.?0+$/, '') },
      { label: 'Total minutes', value: (s / 60).toFixed(2).replace(/\.?0+$/, '') },
      { label: 'Total seconds', value: String(Math.round(s)) },
    ],
  };
}

export default function TimeDurationCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
