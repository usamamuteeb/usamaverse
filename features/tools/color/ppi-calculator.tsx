'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { parseNum } from '@/features/tools/math/logic';
import { ppi } from './design';

const fields: FieldDef[] = [
  { type: 'number', key: 'w', label: 'Horizontal resolution', default: '1920', suffix: 'px' },
  { type: 'number', key: 'h', label: 'Vertical resolution', default: '1080', suffix: 'px' },
  { type: 'number', key: 'd', label: 'Diagonal size', default: '24', suffix: 'inches' },
];

function compute(v: FormValues): FormResult {
  const r = ppi(parseNum(v.w, 'the width'), parseNum(v.h, 'the height'), parseNum(v.d, 'the diagonal'));
  return {
    rows: [
      { label: 'Pixel density', value: `${r.ppi.toFixed(2)} PPI`, emphasis: true },
      { label: 'Dot pitch', value: `${r.dotPitchMm.toFixed(4)} mm` },
      { label: 'Physical size', value: `${r.widthIn.toFixed(2)} × ${r.heightIn.toFixed(2)} in (${(r.widthIn * 2.54).toFixed(1)} × ${(r.heightIn * 2.54).toFixed(1)} cm)` },
      { label: 'Total pixels', value: `${r.megapixels.toFixed(2)} megapixels` },
    ],
    note: 'Assumes square pixels and that the diagonal is the visible screen area.',
  };
}

export default function PpiCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
