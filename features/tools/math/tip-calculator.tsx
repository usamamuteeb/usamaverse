'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatMoney } from '@/lib/format';
import { parseNum, tip } from './logic';

const fields: FieldDef[] = [
  { type: 'number', key: 'bill', label: 'Bill amount', default: '' , placeholder: '2500' },
  { type: 'number', key: 'pct', label: 'Tip', default: '10', suffix: '%' },
  { type: 'number', key: 'people', label: 'Number of people', default: '1' },
];

function compute(v: FormValues): FormResult | null {
  if (!String(v.bill).trim()) return null;
  const r = tip(parseNum(v.bill, 'the bill amount', { min: 0 }), parseNum(v.pct, 'the tip percentage', { min: 0, max: 100 }), parseNum(v.people, 'the number of people', { integer: true, min: 1 }));
  return {
    rows: [
      { label: 'Tip', value: formatMoney(r.tip) },
      { label: 'Total', value: formatMoney(r.total), emphasis: true },
      { label: 'Per person', value: formatMoney(r.perPerson), emphasis: true },
      { label: 'Tip per person', value: formatMoney(r.tipPerPerson) },
    ],
    note: 'Amounts are rounded to 2 decimals for display; per-person shares may not add up exactly.',
  };
}

export default function TipCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
