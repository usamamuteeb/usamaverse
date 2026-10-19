'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { NumberField, SelectField, Status } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { EXT, outputName, type OutputMime } from './logic';
import { centeredCrop, clampCrop } from './more';
import { canvasToBlob, useImageFile } from './useImage';

const RATIOS: Array<[string, number, number]> = [['free', 0, 0], ['1:1', 1, 1], ['4:3', 4, 3], ['3:2', 3, 2], ['16:9', 16, 9], ['9:16', 9, 16], ['4:5', 4, 5], ['2:1', 2, 1]];

export default function ImageCrop() {
  const { img, picker } = useImageFile();
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [ratio, setRatio] = useState('free');
  const [out, setOut] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (img) setCrop({ x: 0, y: 0, w: img.width, h: img.height });
    setOut(null);
  }, [img]);
  const c = useMemo(() => (img ? clampCrop(crop, img.width, img.height) : crop), [crop, img]);
  const applyRatio = (r: string) => {
    setRatio(r);
    setOut(null);
    const def = RATIOS.find((x) => x[0] === r);
    if (img && def && def[1]) setCrop(centeredCrop(img.width, img.height, def[1], def[2]));
  };
  const setField = (k: 'x' | 'y' | 'w' | 'h', v: string) => {
    setOut(null);
    const n = Math.round(Number(v) || 0);
    const def = RATIOS.find((x) => x[0] === ratio);
    setCrop((p) => {
      const next = { ...p, [k]: n };
      if (def && def[1] && (k === 'w' || k === 'h')) {
        if (k === 'w') next.h = Math.round((n * def[2]) / def[1]);
        else next.w = Math.round((n * def[1]) / def[2]);
      }
      return next;
    });
  };
  const outMime: OutputMime = img && (img.mime === 'image/jpeg' || img.mime === 'image/webp') ? (img.mime as OutputMime) : 'image/png';
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {img && (
          <>
            <SelectField label="Aspect ratio" value={ratio} onChange={applyRatio} options={RATIOS.map(([r]) => ({ value: r, label: r === 'free' ? 'Free' : r }))} />
            <div className="form-grid">
              <NumberField label="Left (x)" value={String(crop.x)} onChange={(v) => setField('x', v)} suffix="px" />
              <NumberField label="Top (y)" value={String(crop.y)} onChange={(v) => setField('y', v)} suffix="px" />
              <NumberField label="Width" value={String(crop.w)} onChange={(v) => setField('w', v)} suffix="px" />
              <NumberField label="Height" value={String(crop.h)} onChange={(v) => setField('h', v)} suffix="px" />
            </div>
            <p className="field-hint">Values are clamped to the image: crop {c.w} × {c.h} px from ({c.x}, {c.y}).</p>
            <div className="actions">
              <Button
                variant="primary"
                onClick={async () => {
                  setError(null);
                  try {
                    const canvas = document.createElement('canvas');
                    canvas.width = c.w;
                    canvas.height = c.h;
                    const ctx = canvas.getContext('2d')!;
                    if (outMime === 'image/jpeg') {
                      ctx.fillStyle = '#fff';
                      ctx.fillRect(0, 0, c.w, c.h);
                    }
                    ctx.drawImage(img.bitmap, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
                    setOut(await canvasToBlob(canvas, outMime, 0.92));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Crop
              </Button>
              <Button variant="ghost" onClick={() => { setCrop({ x: 0, y: 0, w: img.width, h: img.height }); setRatio('free'); setOut(null); }}>Reset</Button>
            </div>
          </>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {img && (
          <div className="canvas-wrap" style={{ position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="Image with crop area highlighted" style={{ width: '100%', display: 'block' }} />
            <div className="crop-box" style={{ left: `${(c.x / img.width) * 100}%`, top: `${(c.y / img.height) * 100}%`, width: `${(c.w / img.width) * 100}%`, height: `${(c.h / img.height) * 100}%` }} aria-hidden="true" />
          </div>
        )}
        {out && img && (
          <>
            <Status tone="success">Cropped to {c.w} × {c.h} px ({formatBytes(out.size)}). Metadata such as EXIF/GPS is not copied.</Status>
            <DownloadBlobButton blob={out} filename={outputName(img.file.name, outMime, 'cropped')} label={`Download ${EXT[outMime].toUpperCase()}`} />
          </>
        )}
      </div>
    </div>
  );
}
