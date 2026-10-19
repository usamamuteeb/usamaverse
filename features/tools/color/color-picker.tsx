'use client';

import { useEffect, useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { parseColor, toHex, toHslString, toRgbString } from './logic';

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

export default function ColorPicker() {
  const [color, setColor] = useState('#c6283d');
  const [recent, setRecent] = useState<string[]>([]);
  const [canDrop, setCanDrop] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setCanDrop('EyeDropper' in window), []);
  const choose = (hex: string) => {
    setColor(hex);
    setRecent((r) => [hex, ...r.filter((x) => x !== hex)].slice(0, 12));
  };
  const c = parseColor(color)!;
  const formats = [
    ['HEX', toHex(c)],
    ['RGB', toRgbString(c)],
    ['HSL', toHslString(c)],
  ];
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div className="field">
          <label htmlFor="picker" className="field-label">Pick a color</label>
          <input id="picker" type="color" className="color-input big" value={toHex({ ...c, a: 1 })} onChange={(e) => choose(e.target.value)} />
        </div>
        {canDrop ? (
          <Button
            variant="primary"
            onClick={async () => {
              setError(null);
              try {
                const Ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
                const r = await new Ctor().open();
                choose(r.sRGBHex.toLowerCase());
              } catch {
                setError('Picking was cancelled.');
              }
            }}
          >
            Pick from screen (eyedropper)
          </Button>
        ) : (
          <Status tone="info">Your browser doesn’t support picking colors from the screen (the EyeDropper API, available in Chromium-based desktop browsers). The color wheel still works.</Status>
        )}
        {error && <p className="field-hint">{error}</p>}
      </div>
      <div className="tool-col">
        <div className="swatch-large" aria-hidden="true"><span style={{ background: color }} /></div>
        <dl className="result-rows">
          {formats.map(([k, v]) => (
            <div className="result-row" key={k}>
              <dt>{k}</dt>
              <dd className="mono with-action">{v} <CopyButton text={v} /></dd>
            </div>
          ))}
        </dl>
        {recent.length > 1 && (
          <>
            <h2 className="field-label">Recent picks (this visit only)</h2>
            <div className="actions">
              {recent.map((r) => (
                <button key={r} type="button" className="btn btn-ghost mono" onClick={() => setColor(r)}>
                  <span aria-hidden="true" style={{ display: 'inline-block', width: 14, height: 14, background: r, borderRadius: 3 }} /> {r}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
