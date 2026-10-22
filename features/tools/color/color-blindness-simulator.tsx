'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { RangeField, TextAreaField } from '@/components/tool-kit/fields';
import { downloadBlob } from '@/lib/tools/shared/download';
import { canvasToBlob, useImageFile } from '@/features/tools/image/useImage';
import { CVD_INFO, simulate, simulateHex, type Cvd } from './cvd';

const KINDS = Object.keys(CVD_INFO) as Cvd[];
const MAX_SIDE = 900;

export default function ColorBlindnessSimulator() {
  const { img, picker } = useImageFile();
  const [severity, setSeverity] = useState(100);
  const [palette, setPalette] = useState('#b3263e, #2e7d32, #1f4e9a, #f2c06a, #7e57c2');
  const refs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    if (!img) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const bctx = base.getContext('2d', { willReadFrequently: true })!;
    bctx.drawImage(img.bitmap, 0, 0, w, h);
    const src = bctx.getImageData(0, 0, w, h);
    for (const k of ['original', ...KINDS]) {
      const c = refs.current[k];
      if (!c) continue;
      c.width = w;
      c.height = h;
      const data = new ImageData(new Uint8ClampedArray(src.data), w, h);
      if (k !== 'original') simulate(data.data, k as Cvd, severity / 100);
      c.getContext('2d')!.putImageData(data, 0, 0);
    }
  }, [img, severity]);

  const colors = useMemo(() => palette.split(/[\s,;]+/).map((c) => (c.startsWith('#') ? c : `#${c}`)).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 12), [palette]);

  const save = async (k: string) => {
    const c = refs.current[k];
    if (!c) return;
    downloadBlob(await canvasToBlob(c, 'image/png'), `${(img?.file.name ?? 'image').replace(/\.[^.]+$/, '')}-${k}.png`);
  };

  return (
    <div className="stack">
      <div className="tool-grid">
        <div className="tool-col">
          {picker}
          <RangeField label="Severity" value={severity} onChange={setSeverity} min={0} max={100} step={5} format={(v) => `${v}%`} hint="100% = full dichromacy; lower values approximate milder colour weakness." />
        </div>
        <div className="tool-col">
          <TextAreaField label="Or check a palette (hex colours)" value={palette} onChange={setPalette} rows={2} />
          <table className="data-table compact cvd-palette">
            <thead>
              <tr>
                <th>Normal</th>
                {KINDS.map((k) => (
                  <th key={k}>{CVD_INFO[k].name.split(' ')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.map((c) => (
                <tr key={c}>
                  <td>
                    <span className="cvd-chip" style={{ background: c }} /> {c}
                  </td>
                  {KINDS.map((k) => {
                    const s = simulateHex(c, k, severity / 100);
                    return (
                      <td key={k}>
                        <span className="cvd-chip" style={{ background: s }} title={s} /> {s}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {img ? (
        <ul className="cvd-grid" role="list">
          {['original', ...KINDS].map((k) => (
            <li key={k} className="cvd-card">
              <div className="output-head">
                <strong>{k === 'original' ? 'Normal vision' : CVD_INFO[k as Cvd].name}</strong>
                <Button variant="ghost" onClick={() => void save(k)}>
                  PNG
                </Button>
              </div>
              <div className="canvas-wrap">
                <canvas ref={(el) => { refs.current[k] = el; }} aria-label={k === 'original' ? 'Original image' : `Image as seen with ${CVD_INFO[k as Cvd].name}`} />
              </div>
              {k !== 'original' && <p className="field-hint">{CVD_INFO[k as Cvd].about}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">Choose an image (a chart, UI screenshot or poster) to see it through four types of colour vision.</p>
      )}
    </div>
  );
}
