'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatNumber } from '@/lib/format';
import { parseNum, percentChange, percentOf, whatPercent } from './logic';

const fields: FieldDef[] = [
  { type: 'select', key: 'mode', label: 'Question', default: 'of', choices: [{ value: 'of', label: 'What is X% of Y?' }, { value: 'what', label: 'X is what percent of Y?' }, { value: 'change', label: 'Percentage change from X to Y' }] },
  { type: 'number', key: 'x', label: 'X', default: '15' },
  { type: 'number', key: 'y', label: 'Y', default: '200' },
];

function compute(v: FormValues): FormResult {
  const x = parseNum(v.x, 'X');
  const y = parseNum(v.y, 'Y');
  switch (v.mode) {
    case 'of':
      return { rows: [{ label: `${formatNumber(x)}% of ${formatNumber(y)}`, value: formatNumber(percentOf(x, y)), emphasis: true }] };
    case 'what':
      return { rows: [{ label: `${formatNumber(x)} is`, value: `${formatNumber(whatPercent(x, y))}% of ${formatNumber(y)}`, emphasis: true }] };
    default: {
      const c = percentChange(x, y);
      return { rows: [{ label: c >= 0 ? 'Increase' : 'Decrease', value: `${formatNumber(Math.abs(c))}%`, emphasis: true }, { label: 'Difference', value: formatNumber(y - x) }] };
    }
  }
}

export default function PercentageCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
