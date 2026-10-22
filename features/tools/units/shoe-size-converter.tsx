'use client';

import { useState } from 'react';
import { SelectField, TextField } from '@/components/tool-kit/fields';
import { findShoeSize, SHOE_ROWS, type ShoeUnit } from './shoe-sizes';

const units: Array<{ value: ShoeUnit; label: string }> = [
  { value: 'footCm', label: 'Foot length (cm)' }, { value: 'uk', label: 'UK' }, { value: 'eu', label: 'EU' },
  { value: 'usMen', label: 'US men' }, { value: 'usWomen', label: 'US women' },
];

export default function ShoeSizeConverter() {
  const [unit, setUnit] = useState<ShoeUnit>('footCm');
  const [value, setValue] = useState('26.3');
  const row = findShoeSize(unit, value);
  return <div className="tool-grid">
    <div className="tool-col">
      <div className="field-row">
        <SelectField label="Known measurement or size" value={unit} onChange={(v) => { setUnit(v as ShoeUnit); setValue(v === 'footCm' ? '26.3' : v === 'eu' ? '42⅔' : v === 'usWomen' ? '10' : v === 'uk' ? '8.5' : '9'); }} options={units} />
        {unit === 'eu' ? <SelectField label="EU size" value={value} onChange={setValue} options={SHOE_ROWS.map((r) => ({ value: r.eu, label: r.eu }))} /> :
          <TextField label={unit === 'footCm' ? 'Length of your longer foot' : 'Size'} value={value} onChange={setValue} type="number" step="0.1" />}
      </div>
      <p className="field-hint">Measure both feet while standing; use the longer foot. For a length between chart entries, the next listed size is shown. Fit and widths vary by model and brand.</p>
      <p className="field-hint">Chart: <a href="https://www.adidas.co.uk/help/size_charts/men-shoes" target="_blank" rel="noopener noreferrer">adidas adult footwear size guide</a>. Values are adidas equivalents, not a universal conversion standard.</p>
    </div>
    <div className="tool-col">
      {row ? <div className="shoe-results" aria-live="polite">
        <strong>Suggested chart row</strong>
        <div><span>Foot length</span><b>{row.footCm} cm</b></div><div><span>UK</span><b>{row.uk}</b></div><div><span>EU</span><b>{row.eu}</b></div><div><span>US men</span><b>{row.usMen}</b></div><div><span>US women</span><b>{row.usWomen ?? '—'}</b></div>
      </div> : <p role="status" className="field-hint">Choose a size in the adidas adult chart ({SHOE_ROWS[0].footCm}–{SHOE_ROWS.at(-1)!.footCm} cm).</p>}
    </div>
  </div>;
}
