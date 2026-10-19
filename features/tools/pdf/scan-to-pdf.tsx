'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { NumberField, SelectField, Status } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { imagesToPdf } from '@/features/tools/files/pdf';
import { pdfBlob } from '@/features/tools/files/usePdf';

type Filter = 'original' | 'gray' | 'bw';
interface Shot {
  id: number;
  file: File;
  url: string;
  rotate: number;
}
let ids = 1;
const MAX_SIDE = 2480; // ≈ A4 at 300 DPI

/** Decodes (with EXIF orientation), rotates, filters and downsizes a photo into a JPEG. */
async function prepare(s: Shot, filter: Filter): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const bmp = await createImageBitmap(s.file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const swap = s.rotate % 180 !== 0;
  const c = document.createElement('canvas');
  c.width = swap ? h : w;
  c.height = swap ? w : h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((s.rotate * Math.PI) / 180);
  ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
  bmp.close();
  if (filter !== 'original') {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    // Stretch contrast using the 2nd and 98th percentile of brightness.
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) hist[(d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0]++;
    const n = d.length / 4;
    let lo = 0, hi = 255, acc = 0;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) > n * 0.02) { lo = v; break; }
    acc = 0;
    for (let v = 255; v >= 0; v--) if ((acc += hist[v]) > n * 0.02) { hi = v; break; }
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      let y = ((d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 - lo) * (255 / range);
      y = Math.max(0, Math.min(255, y));
      if (filter === 'bw') y = y > 150 ? 255 : y < 90 ? 0 : (y - 90) * (255 / 60);
      d[i] = d[i + 1] = d[i + 2] = y;
    }
    ctx.putImageData(img, 0, 0);
  }
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85));
  if (!blob || blob.type !== 'image/jpeg') throw new Error('This browser could not encode the photo as JPEG.');
  const res = { bytes: new Uint8Array(await blob.arrayBuffer()), width: c.width, height: c.height };
  c.width = c.height = 0;
  return res;
}

export default function ScanToPdf() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [filter, setFilter] = useState<Filter>('gray');
  const [size, setSize] = useState<'a4' | 'letter' | 'fit'>('a4');
  const [margin, setMargin] = useState('0');
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<Shot[]>([]);
  shotsRef.current = shots;
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (imgs.length < list.length) setError('Some files were skipped because they are not images.');
    setShots((s) => [...s, ...imgs.map((file) => ({ id: ids++, file, url: URL.createObjectURL(file), rotate: 0 }))]);
    setOut(null);
  };
  const update = (fn: (s: Shot[]) => Shot[]) => {
    setShots(fn);
    setOut(null);
  };
  const move = (i: number, d: -1 | 1) =>
    update((s) => {
      const j = i + d;
      if (j < 0 || j >= s.length) return s;
      const a = s.slice();
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div className="dropzone">
          <p>Photograph paper pages with your phone camera, or choose photos you already took. Everything stays on this device.</p>
          <div className="actions">
            <Button variant="primary" onClick={() => camRef.current?.click()}>
              Take photo
            </Button>
            <Button onClick={() => pickRef.current?.click()}>Choose photos</Button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="visually-hidden-input" tabIndex={-1} aria-hidden="true" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={pickRef} type="file" accept="image/*" multiple className="visually-hidden-input" tabIndex={-1} aria-hidden="true" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>
        {shots.length > 0 && (
          <ol className="page-grid" aria-label="Scanned pages">
            {shots.map((s, i) => (
              <li key={s.id} className="page-card">
                <div className="page-thumb" style={{ width: 150, height: 150 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={`Page ${i + 1}`} style={{ transform: s.rotate ? `rotate(${s.rotate}deg)` : undefined }} />
                </div>
                <div className="page-meta">
                  <strong>{i + 1}</strong>
                </div>
                <div className="page-actions">
                  <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move page ${i + 1} earlier`}>←</button>
                  <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === shots.length - 1} aria-label={`Move page ${i + 1} later`}>→</button>
                  <button type="button" className="icon-btn" onClick={() => update((x) => x.map((y) => (y.id === s.id ? { ...y, rotate: (y.rotate + 90) % 360 } : y)))} aria-label={`Rotate page ${i + 1}`}>⟳</button>
                  <button type="button" className="icon-btn danger" onClick={() => { URL.revokeObjectURL(s.url); update((x) => x.filter((y) => y.id !== s.id)); }} aria-label={`Remove page ${i + 1}`}>✕</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="tool-col">
        <SelectField label="Look" value={filter} onChange={(v) => { setFilter(v as Filter); setOut(null); }} options={[{ value: 'gray', label: 'Document — grayscale, cleaner contrast' }, { value: 'bw', label: 'Black & white — crisp text' }, { value: 'original', label: 'Original colors' }]} />
        <div className="form-grid">
          <SelectField label="Page size" value={size} onChange={(v) => { setSize(v as 'a4'); setOut(null); }} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }, { value: 'fit', label: 'Same as photo' }]} />
          <NumberField label="Margin" suffix="pt" value={margin} onChange={(v) => { setMargin(v); setOut(null); }} />
        </div>
        <Button
          variant="primary"
          disabled={!shots.length || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const imgs: Array<{ bytes: Uint8Array; mime: 'image/jpeg'; width: number; height: number }> = [];
              for (let i = 0; i < shots.length; i++) {
                setProgress(`Processing photo ${i + 1} of ${shots.length}…`);
                const p = await prepare(shots[i], filter);
                imgs.push({ bytes: p.bytes, mime: 'image/jpeg' as const, width: p.width, height: p.height });
              }
              setProgress('Building PDF…');
              setOut(await imagesToPdf(imgs, { size: size === 'fit' ? 'fit' : size, marginPt: Math.max(0, Number(margin) || 0), orientation: 'auto' }));
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
              setProgress('');
            }
          }}
        >
          {busy ? 'Working…' : `Create PDF (${shots.length} page${shots.length === 1 ? '' : 's'})`}
        </Button>
        {progress && <p className="summary" role="status">{progress}</p>}
        <Status tone="info">Tip: shoot straight from above in good light. This tool doesn’t straighten skewed pages or recognise text (no OCR).</Status>
        {error && <Status tone="error">{error}</Status>}
        {out && <DownloadBlobButton blob={pdfBlob(out)} filename="scan.pdf" label={`Download PDF (${formatBytes(out.length)})`} />}
      </div>
    </div>
  );
}
