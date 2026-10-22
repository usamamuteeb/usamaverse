'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { downloadBlob, downloadText } from '@/lib/tools/shared/download';
import { canvasToBlob } from './useImage';

const PRESETS = [
  { value: '', label: 'Custom size' },
  { value: '1200x630', label: 'Link preview 1200×630' },
  { value: '1080x1080', label: 'Square post 1080×1080' },
  { value: '1920x1080', label: 'Full HD 1920×1080' },
  { value: '1280x720', label: 'HD 1280×720' },
  { value: '800x600', label: '800×600' },
  { value: '300x250', label: 'Ad 300×250' },
  { value: '728x90', label: 'Banner 728×90' },
  { value: '150x150', label: 'Avatar 150×150' },
];

const xml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function placeholderSvg(w: number, h: number, bg: string, fg: string, label: string): string {
  const size = Math.max(8, Math.round(Math.min(w / Math.max(4, label.length * 0.62), h * 0.42)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${xml(bg)}"/><text x="50%" y="50%" fill="${xml(fg)}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="700" text-anchor="middle" dominant-baseline="central">${xml(label)}</text></svg>`;
}

export default function PlaceholderImage() {
  const [w, setW] = useState('1200');
  const [h, setH] = useState('630');
  const [bg, setBg] = useState('#d8d4e2');
  const [fg, setFg] = useState('#4b4560');
  const [text, setText] = useState('');
  const [fmt, setFmt] = useState('image/png');
  const [err, setErr] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const W = Math.round(Number(w));
  const H = Math.round(Number(h));
  const valid = Number.isFinite(W) && Number.isFinite(H) && W >= 1 && H >= 1 && W <= 8000 && H <= 8000;
  const label = text.trim() || `${W} × ${H}`;
  const svg = useMemo(() => (valid ? placeholderSvg(W, H, /^#[0-9a-f]{6}$/i.test(bg) ? bg : '#cccccc', /^#[0-9a-f]{6}$/i.test(fg) ? fg : '#333333', label) : ''), [valid, W, H, bg, fg, label]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !valid) return;
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const size = Math.max(8, Math.round(Math.min(W / Math.max(4, label.length * 0.62), H * 0.42)));
    ctx.fillStyle = fg;
    ctx.font = `700 ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, H / 2);
  }, [valid, W, H, bg, fg, label]);

  const save = async () => {
    setErr(null);
    try {
      if (fmt === 'image/svg+xml') return downloadText(svg, `placeholder-${W}x${H}.svg`, 'image/svg+xml');
      const blob = await canvasToBlob(canvas.current!, fmt, 0.92);
      downloadBlob(blob, `placeholder-${W}x${H}.${fmt === 'image/jpeg' ? 'jpg' : fmt.split('/')[1]}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <fieldset className="options">
          <legend>Size and text</legend>
          <SelectField label="Preset" value={valid ? `${W}x${H}` : ''} onChange={(v) => { if (v) { const [a, b] = v.split('x'); setW(a); setH(b); } }} options={PRESETS.some((p) => p.value === `${W}x${H}`) ? PRESETS : [{ value: `${W}x${H}`, label: 'Custom size' }, ...PRESETS.slice(1)]} />
          <TextField label="Width (px)" value={w} onChange={setW} inputMode="numeric" />
          <TextField label="Height (px)" value={h} onChange={setH} inputMode="numeric" />
          <TextField label="Text (optional)" value={text} onChange={setText} placeholder={`${W} × ${H}`} />
          <TextField label="Background" type="color" value={bg} onChange={setBg} />
          <TextField label="Text colour" type="color" value={fg} onChange={setFg} />
          <SelectField label="Format" value={fmt} onChange={setFmt} options={[{ value: 'image/png', label: 'PNG' }, { value: 'image/jpeg', label: 'JPEG' }, { value: 'image/webp', label: 'WebP' }, { value: 'image/svg+xml', label: 'SVG (tiny, scalable)' }]} />
        </fieldset>
        <div className="actions">
          <Button variant="primary" onClick={() => void save()} disabled={!valid}>
            Download
          </Button>
          <Button variant="ghost" onClick={() => { setW('1200'); setH('630'); setText(''); setBg('#d8d4e2'); setFg('#4b4560'); }}>
            Reset
          </Button>
        </div>
        {!valid && <Status tone="error">Width and height must be whole numbers from 1 to 8000.</Status>}
        {err && <Status tone="error">{err}</Status>}
      </div>
      <div className="tool-col">
        <div className="canvas-wrap placeholder-wrap">
          <canvas ref={canvas} aria-label={`Placeholder image preview, ${label}`} />
        </div>
        <p className="field-hint">Made on a canvas in your browser — handy for mock-ups, layouts and tests without loading images from other sites.</p>
      </div>
    </div>
  );
}
