'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CopyButton } from '@/components/tool-kit/actions';
import { parseColor, toHslString, toRgbString } from '@/features/tools/color/logic';
import { Swatches } from '@/features/tools/color/Swatches';
import { dominantColors } from './more';
import { useImageFile } from './useImage';

const MAXW = 1200;

export default function ImageColorPicker() {
  const { img, picker } = useImageFile();
  const ref = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hex, setHex] = useState<string | null>(null);
  const [dominant, setDominant] = useState<Array<{ hex: string; share: number }>>([]);
  useEffect(() => {
    const c = ref.current;
    if (!img || !c) return;
    const scale = Math.min(1, MAXW / img.width);
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img.bitmap, 0, 0, c.width, c.height);
    const s = document.createElement('canvas');
    const k = Math.min(1, 160 / Math.max(img.width, img.height));
    s.width = Math.max(1, Math.round(img.width * k));
    s.height = Math.max(1, Math.round(img.height * k));
    const sctx = s.getContext('2d')!;
    sctx.drawImage(img.bitmap, 0, 0, s.width, s.height);
    setDominant(dominantColors(sctx.getImageData(0, 0, s.width, s.height).data, 8));
    setPos({ x: Math.floor(c.width / 2), y: Math.floor(c.height / 2) });
  }, [img]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !pos) return;
    const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(pos.x, pos.y, 1, 1).data;
    const h = (n: number) => n.toString(16).padStart(2, '0');
    setHex(`#${h(d[0])}${h(d[1])}${h(d[2])}`);
  }, [pos]);
  const onKey = (e: KeyboardEvent) => {
    if (!pos || !ref.current) return;
    const step = e.shiftKey ? 10 : 1;
    const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = m[e.key];
    if (!d) return;
    e.preventDefault();
    setPos({ x: Math.max(0, Math.min(ref.current.width - 1, pos.x + d[0])), y: Math.max(0, Math.min(ref.current.height - 1, pos.y + d[1])) });
  };
  const c = hex ? parseColor(hex) : null;
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        <div className="canvas-wrap" hidden={!img}>
          <canvas
            ref={ref}
            className="pickable"
            tabIndex={0}
            aria-label="Image. Click, or use arrow keys (Shift for bigger steps), to sample a color."
            onKeyDown={onKey}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setPos({ x: Math.floor(((e.clientX - r.left) / r.width) * e.currentTarget.width), y: Math.floor(((e.clientY - r.top) / r.height) * e.currentTarget.height) });
            }}
          />
        </div>
      </div>
      <div className="tool-col">
        {c && hex && pos && (
          <>
            <div className="swatch-large" aria-hidden="true"><span style={{ background: hex }} /></div>
            <dl className="result-rows">
              {[['HEX', hex], ['RGB', toRgbString(c)], ['HSL', toHslString(c)]].map(([k, v]) => (
                <div className="result-row" key={k}><dt>{k}</dt><dd className="mono with-action">{v} <CopyButton text={v} /></dd></div>
              ))}
              <div className="result-row"><dt>Position</dt><dd className="mono">{pos.x}, {pos.y}</dd></div>
            </dl>
          </>
        )}
        {dominant.length > 0 && (
          <>
            <h2 className="field-label">Main colors (approximate)</h2>
            <Swatches colors={dominant.map((d) => d.hex)} />
          </>
        )}
      </div>
    </div>
  );
}
