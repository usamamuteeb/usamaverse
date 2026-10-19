'use client';

import { useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { NumberField, RangeField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { gradientCss, parseColor, toHex, type GradientStop } from './logic';

const DEFAULT: GradientStop[] = [
  { color: '#0B0A0D', pos: 0 },
  { color: '#C6283D', pos: 100 },
];

export default function GradientGenerator() {
  const [type, setType] = useState<'linear' | 'radial'>('linear');
  const [angle, setAngle] = useState(135);
  const [shape, setShape] = useState<'circle' | 'ellipse'>('circle');
  const [stops, setStops] = useState<GradientStop[]>(DEFAULT);

  let css = '';
  let error: string | null = null;
  try {
    css = gradientCss({ type, angle, shape, stops });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const line = css ? `background: ${css};` : '';
  const update = (i: number, patch: Partial<GradientStop>) => setStops((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <SelectField label="Type" value={type} onChange={(v) => setType(v as 'linear')} options={[{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }]} />
        {type === 'linear' ? (
          <RangeField label="Angle" value={angle} onChange={setAngle} min={0} max={360} format={(v) => `${v}°`} />
        ) : (
          <SelectField label="Shape" value={shape} onChange={(v) => setShape(v as 'circle')} options={[{ value: 'circle', label: 'Circle' }, { value: 'ellipse', label: 'Ellipse' }]} />
        )}
        {stops.map((s, i) => {
          const c = parseColor(s.color);
          return (
            <fieldset key={i} className="stop-row">
              <legend className="field-label">Stop {i + 1}</legend>
              <TextField label="Color" value={s.color} onChange={(v) => update(i, { color: v })} />
              <input type="color" className="color-input" aria-label={`Stop ${i + 1} color picker`} value={c ? toHex({ ...c, a: 1 }) : '#000000'} onChange={(e) => update(i, { color: e.target.value })} />
              <NumberField label="Position" suffix="%" value={String(s.pos)} onChange={(v) => update(i, { pos: Math.min(100, Math.max(0, Number(v) || 0)) })} />
              {stops.length > 2 && (
                <Button variant="ghost" onClick={() => setStops((st) => st.filter((_, k) => k !== i))} ariaLabel={`Remove stop ${i + 1}`}>
                  Remove
                </Button>
              )}
            </fieldset>
          );
        })}
        <div className="actions">
          <Button onClick={() => setStops((s) => [...s, { color: '#F04459', pos: 50 }])} disabled={stops.length >= 4}>
            Add stop
          </Button>
          <Button variant="ghost" onClick={() => { setStops(DEFAULT); setAngle(135); setType('linear'); }}>
            Reset
          </Button>
        </div>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {css && (
          <>
            <div className="gradient-preview" style={{ background: css }} role="img" aria-label="Gradient preview" />
            <div className="output-head">
              <span className="field-label">CSS</span>
              <CopyButton text={line} />
            </div>
            <pre className="code-block">{line}</pre>
          </>
        )}
      </div>
    </div>
  );
}
