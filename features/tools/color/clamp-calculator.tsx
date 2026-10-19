'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { parseNum } from '@/features/tools/math/logic';
import { fluidClamp } from './design';

const fields: FieldDef[] = [
  { type: 'number', key: 'minPx', label: 'Smallest size', default: '16', suffix: 'px' },
  { type: 'number', key: 'maxPx', label: 'Largest size', default: '24', suffix: 'px' },
  { type: 'number', key: 'minVw', label: 'At viewport width', default: '360', suffix: 'px' },
  { type: 'number', key: 'maxVw', label: 'Up to viewport width', default: '1280', suffix: 'px' },
  { type: 'number', key: 'root', label: 'Root font size', default: '16', suffix: 'px' },
  { type: 'text', key: 'prop', label: 'CSS property', default: 'font-size' },
];

function compute(v: FormValues): FormResult {
  const r = fluidClamp({ minPx: parseNum(v.minPx, 'the smallest size'), maxPx: parseNum(v.maxPx, 'the largest size'), minVw: parseNum(v.minVw, 'the minimum viewport'), maxVw: parseNum(v.maxVw, 'the maximum viewport'), rootPx: parseNum(v.root, 'the root size') });
  return {
    output: `${String(v.prop).trim() || 'font-size'}: ${r.css};`,
    outputLabel: 'CSS',
    note: 'Using rem for the bounds keeps the size responsive to the user’s browser font setting (an accessibility requirement for zoom).',
    rows: [{ label: 'Slope', value: `${r.slopeVw.toFixed(4)}vw` }],
  };
}

export default function ClampCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
