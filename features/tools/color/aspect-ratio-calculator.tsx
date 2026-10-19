'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatNumber } from '@/lib/format';
import { parseNum } from '@/features/tools/math/logic';
import { simplifyRatio } from './logic';

const fields: FieldDef[] = [
  { type: 'number', key: 'w', label: 'Width', default: '1920' },
  { type: 'number', key: 'h', label: 'Height', default: '1080' },
  { type: 'select', key: 'solve', label: 'Then calculate', default: 'height', choices: [{ value: 'height', label: 'Height for a new width' }, { value: 'width', label: 'Width for a new height' }] },
  { type: 'number', key: 'target', label: 'New value', default: '1280' },
];

function compute(v: FormValues): FormResult {
  const w = parseNum(v.w, 'the width', { min: 0 });
  const h = parseNum(v.h, 'the height', { min: 0 });
  const [rw, rh] = simplifyRatio(w, h);
  const rows = [
    { label: 'Aspect ratio', value: `${rw}:${rh}`, emphasis: true },
    { label: 'As a decimal', value: `${formatNumber(w / h, 6)} : 1` },
  ];
  if (String(v.target).trim()) {
    const t = parseNum(v.target, 'the new value', { min: 0 });
    if (v.solve === 'height') rows.push({ label: `Height at width ${formatNumber(t)}`, value: formatNumber((t * h) / w, 8), emphasis: true });
    else rows.push({ label: `Width at height ${formatNumber(t)}`, value: formatNumber((t * w) / h, 8), emphasis: true });
  }
  return { rows };
}

export default function AspectRatioCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
