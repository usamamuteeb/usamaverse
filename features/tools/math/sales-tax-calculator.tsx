'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatMoney } from '@/lib/format';
import { parseNum, salesTax } from './logic';

const fields: FieldDef[] = [
  { type: 'select', key: 'mode', label: 'The amount is', default: 'add', choices: [{ value: 'add', label: 'Before tax (add tax)' }, { value: 'extract', label: 'Tax-inclusive (remove tax)' }] },
  { type: 'number', key: 'amount', label: 'Amount', default: '', placeholder: '1000' },
  { type: 'number', key: 'rate', label: 'Tax rate', default: '', suffix: '%', placeholder: '17', hint: 'Enter your own rate. This tool does not look up rates.' },
];

function compute(v: FormValues): FormResult | null {
  if (!String(v.amount).trim() || !String(v.rate).trim()) return null;
  const r = salesTax(parseNum(v.amount, 'the amount', { min: 0 }), parseNum(v.rate, 'the tax rate'), v.mode as 'add');
  return {
    rows: [
      { label: 'Net (before tax)', value: formatMoney(r.net) },
      { label: 'Tax', value: formatMoney(r.tax) },
      { label: 'Gross (with tax)', value: formatMoney(r.gross), emphasis: true },
    ],
  };
}

export default function SalesTaxCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
