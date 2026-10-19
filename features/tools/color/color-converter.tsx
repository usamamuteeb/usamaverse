'use client';

import { useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { Status, TextField } from '@/components/tool-kit/fields';
import { parseColor, rgbToHsl, toHex, toHslString, toRgbString } from './logic';

export default function ColorConverter() {
  const [input, setInput] = useState('#C6283D');
  const c = parseColor(input);
  const opaqueHex = c ? toHex({ ...c, a: 1 }) : '#000000';
  const hsl = c ? rgbToHsl(c.r, c.g, c.b) : null;
  const rows = c
    ? [
        { label: 'HEX', value: toHex(c) },
        { label: 'RGB', value: toRgbString(c) },
        { label: 'RGB (legacy comma syntax)', value: c.a < 1 ? `rgba(${c.r}, ${c.g}, ${c.b}, ${+c.a.toFixed(3)})` : `rgb(${c.r}, ${c.g}, ${c.b})` },
        { label: 'HSL', value: toHslString(c) },
        { label: 'HSL (legacy comma syntax)', value: c.a < 1 ? `hsla(${hsl!.h}, ${hsl!.s}%, ${hsl!.l}%, ${+c.a.toFixed(3)})` : `hsl(${hsl!.h}, ${hsl!.s}%, ${hsl!.l}%)` },
      ]
    : [];

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextField label="Color" value={input} onChange={setInput} placeholder="#ff8800, rgb(255 136 0), hsl(32 100% 50%), crimson" hint="Accepts HEX (3, 4, 6 or 8 digits), rgb()/rgba(), hsl()/hsla() and basic color names." />
        <div className="field">
          <label htmlFor="native-color" className="field-label">
            Pick a color
          </label>
          <input id="native-color" type="color" className="color-input" value={opaqueHex} onChange={(e) => setInput(e.target.value)} />
        </div>
        <div className="actions">
          <Button variant="ghost" onClick={() => setInput('#C6283D')}>
            Reset
          </Button>
        </div>
      </div>
      <div className="tool-col">
        {!c && input.trim() && <Status tone="error">“{input}” is not a color this tool understands.</Status>}
        {c && (
          <>
            <div className="swatch-large checker" aria-hidden="true">
              <span style={{ background: toRgbString(c) }} />
            </div>
            <dl className="result-rows">
              {rows.map((r) => (
                <div className="result-row" key={r.label}>
                  <dt>{r.label}</dt>
                  <dd className="mono with-action">
                    {r.value} <CopyButton text={r.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
