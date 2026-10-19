'use client';

import { useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { CheckboxField, RangeField, Status, TextField } from '@/components/tool-kit/fields';
import { boxShadowCss, type ShadowLayer } from './design';

const DEFAULT: ShadowLayer[] = [
  { x: 0, y: 4, blur: 12, spread: 0, color: '#000000', opacity: 18, inset: false },
  { x: 0, y: 1, blur: 3, spread: 0, color: '#000000', opacity: 12, inset: false },
];

export default function BoxShadowGenerator() {
  const [layers, setLayers] = useState<ShadowLayer[]>(DEFAULT);
  const [radius, setRadius] = useState(12);
  const set = (i: number, patch: Partial<ShadowLayer>) => setLayers((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  let css = '';
  let error: string | null = null;
  try {
    css = boxShadowCss(layers);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const line = `box-shadow: ${css};`;
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {layers.map((l, i) => (
          <fieldset key={i} className="options">
            <legend className="field-label">Layer {i + 1}</legend>
            <RangeField label="Offset X" value={l.x} min={-50} max={50} onChange={(v) => set(i, { x: v })} format={(v) => `${v}px`} />
            <RangeField label="Offset Y" value={l.y} min={-50} max={50} onChange={(v) => set(i, { y: v })} format={(v) => `${v}px`} />
            <RangeField label="Blur" value={l.blur} min={0} max={100} onChange={(v) => set(i, { blur: v })} format={(v) => `${v}px`} />
            <RangeField label="Spread" value={l.spread} min={-50} max={50} onChange={(v) => set(i, { spread: v })} format={(v) => `${v}px`} />
            <RangeField label="Opacity" value={l.opacity} min={0} max={100} onChange={(v) => set(i, { opacity: v })} format={(v) => `${v}%`} />
            <TextField label="Color" value={l.color} onChange={(v) => set(i, { color: v })} />
            <CheckboxField label="Inset" checked={l.inset} onChange={(v) => set(i, { inset: v })} />
            {layers.length > 1 && <Button variant="ghost" onClick={() => setLayers((ls) => ls.filter((_, k) => k !== i))}>Remove layer</Button>}
          </fieldset>
        ))}
        <div className="actions">
          <Button onClick={() => setLayers((ls) => [...ls, { x: 0, y: 8, blur: 24, spread: -4, color: '#000000', opacity: 20, inset: false }])} disabled={layers.length >= 4}>Add layer</Button>
          <Button variant="ghost" onClick={() => setLayers(DEFAULT)}>Reset</Button>
        </div>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        <div className="preview-box">
          <div className="demo" style={{ boxShadow: css || undefined, borderRadius: radius }} role="img" aria-label="Shadow preview" />
        </div>
        <RangeField label="Preview corner radius" value={radius} min={0} max={60} onChange={setRadius} format={(v) => `${v}px`} />
        {css && (
          <>
            <div className="output-head"><span className="field-label">CSS</span><CopyButton text={line} /></div>
            <pre className="code-block">{line}</pre>
          </>
        )}
      </div>
    </div>
  );
}
