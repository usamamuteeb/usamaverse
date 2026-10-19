'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatNumber } from '@/lib/format';
import { parseNumberList } from './logic';
import { describe } from './more';

const fields: FieldDef[] = [{ type: 'textarea', key: 'list', label: 'Numbers', default: '', placeholder: '3, 7, 7, 2, 9, 4', hint: 'Separate with spaces, commas, semicolons or new lines.' }];

function compute(v: FormValues): FormResult | null {
  const nums = parseNumberList(String(v.list));
  if (!nums.length) return null;
  const d = describe(nums);
  return {
    rows: [
      { label: 'Median', value: formatNumber(d.median), emphasis: true },
      { label: 'Mode', value: d.modes.length ? `${d.modes.map((m) => formatNumber(m)).join(', ')} (appears ${d.modeCount}×)` : 'No mode (every value appears once)', emphasis: true },
      { label: 'Mean', value: formatNumber(d.mean) },
      { label: 'Range', value: `${formatNumber(d.range)} (${formatNumber(d.min)} to ${formatNumber(d.max)})` },
      { label: 'Quartiles Q1 / Q3', value: `${formatNumber(d.q1)} / ${formatNumber(d.q3)}` },
      { label: 'Std. deviation (population)', value: formatNumber(d.populationSd) },
      { label: 'Std. deviation (sample)', value: Number.isNaN(d.sampleSd) ? 'Needs 2+ values' : formatNumber(d.sampleSd) },
      { label: 'Count', value: d.count.toLocaleString('en-US') },
    ],
    note: 'Quartiles use linear interpolation (the same method as Excel QUARTILE.INC).',
  };
}

export default function MedianMode() {
  return <FormTool fields={fields} compute={compute} />;
}
