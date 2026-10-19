'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatMoney, formatNumber } from '@/lib/format';
import { discount, parseNum } from './logic';

const fields: FieldDef[] = [
  { type: 'number', key: 'price', label: 'Original price', default: '', placeholder: '4999' },
  { type: 'number', key: 'd1', label: 'Discount', default: '20', suffix: '%' },
  { type: 'number', key: 'd2', label: 'Extra discount (applied after the first)', default: '0', suffix: '%' },
];

function compute(v: FormValues): FormResult | null {
  if (!String(v.price).trim()) return null;
  const r = discount(parseNum(v.price, 'the price', { min: 0 }), parseNum(v.d1, 'the discount'), String(v.d2).trim() ? parseNum(v.d2, 'the extra discount') : 0);
  return {
    rows: [
      { label: 'Sale price', value: formatMoney(r.final), emphasis: true },
      { label: 'You save', value: formatMoney(r.saved) },
      { label: 'Effective discount', value: `${formatNumber(r.effectivePercent)}%` },
    ],
  };
}

export default function DiscountCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
