'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { detectSignature } from '@/features/tools/files/logic';

export interface SignatureImage {
  png: Uint8Array;
  width: number;
  height: number;
  url: string;
}

async function canvasPng(c: HTMLCanvasElement): Promise<SignatureImage | null> {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) return null;
  return { png: new Uint8Array(await blob.arrayBuffer()), width: c.width, height: c.height, url: URL.createObjectURL(blob) };
}

/** Crops transparent margins so the signature box hugs the ink. */
function trimCanvas(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = src.getContext('2d')!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const pad = 6;
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1 + pad * 2;
  out.height = y1 - y0 + 1 + pad * 2;
  out.getContext('2d')!.drawImage(src, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

const FONTS = [
  { value: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive', label: 'Script' },
  { value: '"Lucida Handwriting", "Apple Chancery", cursive', label: 'Handwriting' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Serif italic' },
];

/** Draw / type / upload a signature; returns a trimmed transparent PNG. */
export function SignaturePad({ onReady }: { onReady: (sig: SignatureImage | null) => void }) {
  const [mode, setMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const [color, setColor] = useState('#0b1f6b');
  const [typed, setTyped] = useState('');
  const [font, setFont] = useState(FONTS[0].value);
  const [error, setError] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => onReady(null), [mode, onReady]);

  const pos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };

  const finishDraw = async () => {
    if (!canvas.current || !hasInk) return onReady(null);
    const t = trimCanvas(canvas.current);
    onReady(t ? await canvasPng(t) : null);
  };

  const renderTyped = async () => {
    const text = typed.trim();
    if (!text) return onReady(null);
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const size = 96;
    const family = font.includes('serif') && !font.includes('cursive') ? `italic ${size}px ${font}` : `${size}px ${font}`;
    ctx.font = family;
    c.width = Math.ceil(ctx.measureText(text).width + 40);
    c.height = Math.ceil(size * 1.6);
    ctx.font = family;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 20, c.height / 2);
    const t = trimCanvas(c);
    onReady(t ? await canvasPng(t) : null);
  };

  return (
    <div className="stack">
      <SelectField label="Create signature by" value={mode} onChange={(v) => setMode(v as 'draw')} options={[{ value: 'draw', label: 'Drawing it' }, { value: 'type', label: 'Typing my name' }, { value: 'upload', label: 'Uploading an image' }]} />
      {mode !== 'upload' && <TextField type="color" label="Ink color" value={color} onChange={setColor} />}
      {mode === 'draw' && (
        <>
          <canvas
            ref={canvas}
            width={900}
            height={300}
            className="signature-pad"
            aria-label="Signature drawing area. Draw with a mouse, pen or finger."
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              last.current = pos(e);
            }}
            onPointerMove={(e) => {
              if (!last.current) return;
              const p = pos(e);
              const ctx = e.currentTarget.getContext('2d')!;
              ctx.strokeStyle = color;
              ctx.lineWidth = 5;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.moveTo(last.current.x, last.current.y);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
              last.current = p;
              setHasInk(true);
            }}
            onPointerUp={() => {
              last.current = null;
              void finishDraw();
            }}
          />
          <div className="actions">
            <Button
              variant="ghost"
              onClick={() => {
                const c = canvas.current;
                c?.getContext('2d')!.clearRect(0, 0, c.width, c.height);
                setHasInk(false);
                onReady(null);
              }}
            >
              Clear drawing
            </Button>
          </div>
        </>
      )}
      {mode === 'type' && (
        <>
          <TextField label="Your name" value={typed} onChange={setTyped} />
          <SelectField label="Style" value={font} onChange={setFont} options={FONTS} hint="Uses fonts installed on your device." />
          <Button onClick={() => void renderTyped()} disabled={!typed.trim()}>
            Use this signature
          </Button>
        </>
      )}
      {mode === 'upload' && (
        <FileDrop
          accept="image/png,image/jpeg"
          label="Choose signature image"
          onFiles={async ([f]) => {
            setError(null);
            const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
            const sig = detectSignature(head);
            if (!sig || !['image/png', 'image/jpeg'].includes(sig.mime)) return setError('Choose a PNG or JPEG image.');
            const bmp = await createImageBitmap(f);
            const c = document.createElement('canvas');
            c.width = bmp.width;
            c.height = bmp.height;
            const ctx = c.getContext('2d')!;
            ctx.drawImage(bmp, 0, 0);
            bmp.close();
            // Make near-white paper transparent so the signature sits on the page.
            const img = ctx.getImageData(0, 0, c.width, c.height);
            for (let i = 0; i < img.data.length; i += 4) if (img.data[i] > 225 && img.data[i + 1] > 225 && img.data[i + 2] > 225) img.data[i + 3] = 0;
            ctx.putImageData(img, 0, 0);
            const t = trimCanvas(c);
            onReady(t ? await canvasPng(t) : null);
          }}
        />
      )}
      {error && <Status tone="error">{error}</Status>}
    </div>
  );
}
