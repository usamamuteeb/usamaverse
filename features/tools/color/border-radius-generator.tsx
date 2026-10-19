'use client';

import { useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { CheckboxField, RangeField, SelectField, Status } from '@/components/tool-kit/fields';
import { borderRadiusCss } from './design';

export default function BorderRadiusGenerator() {
  const [unit, setUnit] = useState<'px' | '%' | 'rem'>('px');
  const [linked, setLinked] = useState(true);
  const [r, setR] = useState({ tl: 16, tr: 16, br: 16, bl: 16 });
  const max = unit === '%' ? 50 : unit === 'rem' ? 10 : 120;
  const step = unit === 'rem' ? 0.125 : 1;
  const set = (k: keyof typeof r, v: number) => setR((p) => (linked ? { tl: v, tr: v, br: v, bl: v } : { ...p, [k]: v }));
  let css = '';
  let error: string | null = null;
  try {
    css = borderRadiusCss(r, unit);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const line = `border-radius: ${css};`;
  const labels: Record<keyof typeof r, string> = { tl: 'Top left', tr: 'Top right', br: 'Bottom right', bl: 'Bottom left' };
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <SelectField label="Unit" value={unit} onChange={(v) => { setUnit(v as 'px'); setR({ tl: 0, tr: 0, br: 0, bl: 0 }); }} options={[{ value: 'px', label: 'px' }, { value: '%', label: '%' }, { value: 'rem', label: 'rem' }]} />
        <CheckboxField label="Same radius for all corners" checked={linked} onChange={setLinked} />
        {(Object.keys(labels) as Array<keyof typeof r>).map((k) => (
          <RangeField key={k} label={labels[k]} value={r[k]} min={0} max={max} step={step} onChange={(v) => set(k, v)} format={(v) => `${v}${unit}`} />
        ))}
        <Button variant="ghost" onClick={() => setR({ tl: 16, tr: 16, br: 16, bl: 16 })}>Reset</Button>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        <div className="preview-box">
          <div className="demo" style={{ borderRadius: css, background: '#C6283D', border: 0 }} role="img" aria-label="Corner radius preview" />
        </div>
        <div className="output-head"><span className="field-label">CSS</span><CopyButton text={line} /></div>
        <pre className="code-block">{line}</pre>
      </div>
    </div>
  );
}
