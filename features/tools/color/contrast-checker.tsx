'use client';

import { useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { Status, TextField } from '@/components/tool-kit/fields';
import { contrastRatio, parseColor, toHex, wcagResults } from './logic';

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const c = parseColor(value);
  return (
    <div className="color-pair">
      <TextField label={label} value={value} onChange={onChange} />
      <input type="color" className="color-input" aria-label={`${label} picker`} value={c ? toHex({ ...c, a: 1 }) : '#000000'} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function ContrastChecker() {
  const [fg, setFg] = useState('#F5F0F2');
  const [bg, setBg] = useState('#0B0A0D');
  const f = parseColor(fg);
  const b = parseColor(bg);
  const ratio = f && b ? contrastRatio(f, b) : null;

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <ColorInput label="Text color" value={fg} onChange={setFg} />
        <ColorInput label="Background color" value={bg} onChange={setBg} />
        <div className="actions">
          <Button onClick={() => { setFg(bg); setBg(fg); }}>⇄ Swap</Button>
          <Button variant="ghost" onClick={() => { setFg('#F5F0F2'); setBg('#0B0A0D'); }}>
            Reset
          </Button>
        </div>
        {(!f || !b) && <Status tone="error">Enter two valid colors.</Status>}
        {b && b.a < 1 && <Status tone="info">The background is translucent; it is measured as if placed on white.</Status>}
      </div>
      <div className="tool-col">
        {ratio !== null && f && b && (
          <>
            <div className="contrast-sample" style={{ color: fg, background: bg }}>
              <p className="sample-large">Large text sample (24px)</p>
              <p>Normal text sample — the quick brown fox jumps over the lazy dog.</p>
            </div>
            <p className="big-result" aria-live="polite">
              <span className="big-result-label">Contrast ratio</span>
              <span className="big-result-value">{(Math.floor(ratio * 100) / 100).toFixed(2)} : 1</span>
            </p>
            <ul className="checks">
              {wcagResults(ratio).map((r) => (
                <li key={r.label} className={r.pass ? 'pass' : 'fail'}>
                  <span aria-hidden="true">{r.pass ? '✓' : '✕'}</span> <strong>{r.pass ? 'Pass' : 'Fail'}</strong> — {r.label} (needs {r.need}:1)
                </li>
              ))}
            </ul>
            <p className="field-hint">Large text means at least 24px regular or about 18.7px bold.</p>
          </>
        )}
      </div>
    </div>
  );
}
