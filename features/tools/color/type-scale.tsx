'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/tool-kit/actions';
import { NumberField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { RATIOS, typeScale } from './design';

export default function TypeScale() {
  const [base, setBase] = useState('16');
  const [ratio, setRatio] = useState('1.25');
  const [up, setUp] = useState('5');
  const [down, setDown] = useState('2');
  const [sample, setSample] = useState('The quick brown fox');
  let rows: ReturnType<typeof typeScale> = [];
  let error: string | null = null;
  try {
    rows = typeScale(Number(base), Number(ratio), Number(up), Number(down));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const css = `:root {\n${rows.map((r) => `  --step-${r.step < 0 ? `n${-r.step}` : r.step}: ${+r.rem.toFixed(4)}rem; /* ${+r.px.toFixed(2)}px */`).join('\n')}\n}`;
  return (
    <div className="stack">
      <div className="form-grid">
        <NumberField label="Base size (px)" value={base} onChange={setBase} />
        <SelectField label="Ratio" value={ratio} onChange={setRatio} options={RATIOS.map((r) => ({ value: String(r.value), label: r.label }))} />
        <NumberField label="Steps up" value={up} onChange={setUp} />
        <NumberField label="Steps down" value={down} onChange={setDown} />
        <TextField label="Sample text" value={sample} onChange={setSample} />
      </div>
      {error && <Status tone="error">{error}</Status>}
      {rows.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th scope="col">Step</th><th scope="col">px</th><th scope="col">rem</th><th scope="col">Preview</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.step}>
                    <td>{r.step}</td>
                    <td className="mono">{r.px.toFixed(2)}</td>
                    <td className="mono">{r.rem.toFixed(4)}</td>
                    <td style={{ fontSize: `${r.px}px`, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{sample}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="output-head"><span className="field-label">CSS custom properties (rem at a 16px root)</span><CopyButton text={css} /></div>
          <pre className="code-block">{css}</pre>
        </>
      )}
    </div>
  );
}
