'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { RangeField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { fitPlan, SOCIAL_PRESETS } from './more';
import { canvasToBlob, useImageFile } from './useImage';

export default function SocialImageCanvas() {
  const { img, picker } = useImageFile();
  const [preset, setPreset] = useState('og');
  const [mode, setMode] = useState<'cover' | 'contain'>('cover');
  const [bg, setBg] = useState('#0b0a0d');
  const [fx, setFx] = useState(50);
  const [fy, setFy] = useState(50);
  const [fmt, setFmt] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [out, setOut] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const p = SOCIAL_PRESETS.find((x) => x.id === preset)!;
  useEffect(() => {
    const c = ref.current;
    setOut(null);
    if (!img || !c) return;
    c.width = p.w;
    c.height = p.h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, p.w, p.h);
    ctx.imageSmoothingQuality = 'high';
    const plan = fitPlan(img.width, img.height, p.w, p.h, mode, fx / 100, fy / 100);
    ctx.drawImage(img.bitmap, plan.sx, plan.sy, plan.sw, plan.sh, plan.dx, plan.dy, plan.dw, plan.dh);
  }, [img, p, mode, bg, fx, fy]);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        <SelectField label="Size" value={preset} onChange={setPreset} options={SOCIAL_PRESETS.map((x) => ({ value: x.id, label: x.label }))} hint="Common sizes; platforms change their guidance, so check theirs if exact fit matters." />
        <SelectField label="Fit" value={mode} onChange={(v) => setMode(v as 'cover')} options={[{ value: 'cover', label: 'Fill (crop to fit)' }, { value: 'contain', label: 'Fit inside (add background)' }]} />
        {mode === 'cover' ? (
          <>
            <RangeField label="Horizontal focus" value={fx} min={0} max={100} onChange={setFx} format={(v) => `${v}%`} />
            <RangeField label="Vertical focus" value={fy} min={0} max={100} onChange={setFy} format={(v) => `${v}%`} />
          </>
        ) : (
          <TextField type="color" label="Background" value={bg} onChange={setBg} />
        )}
        <SelectField label="Format" value={fmt} onChange={(v) => setFmt(v as 'image/jpeg')} options={[{ value: 'image/jpeg', label: 'JPEG (smaller)' }, { value: 'image/png', label: 'PNG (lossless)' }]} />
        {img && (
          <Button
            variant="primary"
            onClick={async () => {
              setError(null);
              try {
                setOut(await canvasToBlob(ref.current!, fmt, 0.9));
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Create image
          </Button>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        <div className="canvas-wrap" hidden={!img}>
          <canvas ref={ref} role="img" aria-label={`Preview at ${p.w} by ${p.h} pixels`} />
        </div>
        {out && (
          <>
            <Status tone="success">{p.w} × {p.h} px, {formatBytes(out.size)}.</Status>
            <DownloadBlobButton blob={out} filename={`social-${p.id}-${p.w}x${p.h}.${fmt === 'image/png' ? 'png' : 'jpg'}`} label="Download" />
          </>
        )}
      </div>
    </div>
  );
}
