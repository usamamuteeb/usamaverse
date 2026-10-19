'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatNumber } from '@/lib/format';
import { basicStats, parseNumberList } from './logic';

const fields: FieldDef[] = [{ type: 'textarea', key: 'list', label: 'Numbers', default: '', placeholder: '4, 8, 15, 16, 23, 42', hint: 'Separate with spaces, commas, semicolons or new lines.' }];

function compute(v: FormValues): FormResult | null {
  const nums = parseNumberList(String(v.list));
  if (nums.length === 0) return null;
  const s = basicStats(nums);
  return {
    rows: [
      { label: 'Mean (average)', value: formatNumber(s.mean), emphasis: true },
      { label: 'Sum', value: formatNumber(s.sum) },
      { label: 'Count', value: s.count.toLocaleString('en-US') },
      { label: 'Minimum', value: formatNumber(s.min) },
      { label: 'Maximum', value: formatNumber(s.max) },
    ],
  };
}

export default function AverageCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
