'use client';

import { useEffect, useRef, useState } from 'react';
import { DownloadBlobButton, Button } from '@/components/tool-kit/actions';
import { CheckboxField, NumberField, RangeField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { ResultRows } from '@/components/tool-kit/output';
import { formatBytes } from '@/lib/format';
import { detectSignature } from '@/features/tools/files/logic';
import { readMetadata } from './exif';
import { EXT, MAX_IMAGE_BYTES, MAX_PIXELS, fitDimensions, outputName, rotatedSize, type OutputMime } from './logic';

export type ImageMode = 'resize' | 'compress' | 'png-to-jpeg' | 'jpeg-to-png' | 'rotate' | 'to-webp' | 'from-webp' | 'orient';

interface Source {
  file: File;
  mime: string;
  url: string;
  bitmap: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
}

interface Output {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  name: string;
}

const DECODABLE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];

function canEncode(mime: OutputMime): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL(mime).startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall back */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sizeOf(b: ImageBitmap | HTMLImageElement) {
  return b instanceof HTMLImageElement ? { width: b.naturalWidth, height: b.naturalHeight } : { width: b.width, height: b.height };
}

function toBlob(canvas: HTMLCanvasElement, mime: OutputMime, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The browser could not encode the image (it may be too large for this device).'))), mime, quality),
  );
}

const TITLES: Record<ImageMode, { run: string; accept: string; allowed: string[] }> = {
  resize: { run: 'Resize image', accept: 'image/png,image/jpeg,image/webp,image/gif,image/bmp', allowed: DECODABLE },
  compress: { run: 'Compress image', accept: 'image/png,image/jpeg,image/webp,image/gif,image/bmp', allowed: DECODABLE },
  'png-to-jpeg': { run: 'Convert to JPEG', accept: 'image/png', allowed: ['image/png'] },
  'jpeg-to-png': { run: 'Convert to PNG', accept: 'image/jpeg', allowed: ['image/jpeg'] },
  rotate: { run: 'Apply', accept: 'image/png,image/jpeg,image/webp,image/gif,image/bmp', allowed: DECODABLE },
  'to-webp': { run: 'Convert to WebP', accept: 'image/png,image/jpeg,image/gif,image/bmp', allowed: ['image/png', 'image/jpeg', 'image/gif', 'image/bmp'] },
  'from-webp': { run: 'Convert', accept: 'image/webp', allowed: ['image/webp'] },
  orient: { run: 'Fix orientation', accept: 'image/jpeg,image/webp,image/png', allowed: ['image/jpeg', 'image/webp', 'image/png'] },
};

export function ImageTool({ mode }: { mode: ImageMode }) {
  const [src, setSrc] = useState<Source | null>(null);
  const [out, setOut] = useState<Output | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [webpOk, setWebpOk] = useState(false);
  // settings
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  const [keep, setKeep] = useState(true);
  const [format, setFormat] = useState<OutputMime>('image/jpeg');
  const [quality, setQuality] = useState(mode === 'compress' ? 70 : 90);
  const [bg, setBg] = useState('#ffffff');
  const [angle, setAngle] = useState(90);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [orientation, setOrientation] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const srcRef = useRef<Source | null>(null);
  const outRef = useRef<Output | null>(null);

  useEffect(() => setWebpOk(canEncode('image/webp')), []);

  // Release object URLs and bitmaps when replaced or unmounted.
  useEffect(() => {
    srcRef.current = src;
  }, [src]);
  useEffect(() => {
    outRef.current = out;
  }, [out]);
  useEffect(
    () => () => {
      if (srcRef.current) {
        URL.revokeObjectURL(srcRef.current.url);
        if ('close' in srcRef.current.bitmap) srcRef.current.bitmap.close();
      }
      if (outRef.current) URL.revokeObjectURL(outRef.current.url);
    },
    [],
  );

  const clearOutput = () => {
    setOut((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  // Any setting change makes an existing result stale.
  useEffect(clearOutput, [w, h, keep, format, quality, bg, angle, flipH, flipV]);

  const load = async (file: File) => {
    setError(null);
    clearOutput();
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`This file is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_IMAGE_BYTES)}.`);
      return;
    }
    const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const sig = detectSignature(head);
    const allowed = TITLES[mode].allowed;
    if (!sig || !allowed.includes(sig.mime)) {
      setError(sig ? `This file is actually ${sig.label}. ${mode === 'png-to-jpeg' ? 'Choose a PNG image.' : mode === 'jpeg-to-png' ? 'Choose a JPEG image.' : 'Choose a PNG, JPEG, WebP, GIF or BMP image.'}` : 'This file is not a recognised image format.');
      return;
    }
    try {
      const bitmap = await decode(file);
      const { width, height } = sizeOf(bitmap);
      if (width * height > MAX_PIXELS) {
        if ('close' in bitmap) bitmap.close();
        setError(`This image is ${(width * height / 1e6).toFixed(1)} megapixels; the limit is 50.`);
        return;
      }
      setSrc((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev.url);
          if ('close' in prev.bitmap) prev.bitmap.close();
        }
        return { file, mime: sig.mime, url: URL.createObjectURL(file), bitmap, width, height };
      });
      setW(String(width));
      setH(String(height));
      if (mode === 'compress') setFormat(sig.mime === 'image/webp' && canEncode('image/webp') ? 'image/webp' : 'image/jpeg');
      if (mode === 'from-webp') setFormat('image/png');
      if (mode === 'to-webp') setQuality(85);
      try {
        setOrientation(readMetadata(await file.slice(0, 256 * 1024).arrayBuffer()).orientation);
      } catch {
        setOrientation(null);
      }
    } catch {
      setError('Your browser could not decode this image. It may be damaged or use an unsupported variant.');
    }
  };

  const process = async () => {
    if (!src) return;
    setBusy(true);
    setError(null);
    clearOutput();
    try {
      let target: OutputMime;
      let suffix: string;
      let width = src.width;
      let height = src.height;
      let rot = 0;
      let fh = false;
      let fv = false;
      let q: number | undefined;
      switch (mode) {
        case 'resize': {
          const dims = fitDimensions(src.width, src.height, Number(w) || null, Number(h) || null, keep);
          width = dims.width;
          height = dims.height;
          target = (['image/png', 'image/jpeg', 'image/webp'].includes(src.mime) ? src.mime : 'image/png') as OutputMime;
          if (target === 'image/webp' && !webpOk) target = 'image/png';
          q = target === 'image/png' ? undefined : quality / 100;
          suffix = `${width}x${height}`;
          break;
        }
        case 'compress':
          target = format;
          q = quality / 100;
          suffix = `q${quality}`;
          break;
        case 'png-to-jpeg':
          target = 'image/jpeg';
          q = quality / 100;
          suffix = '';
          break;
        case 'jpeg-to-png':
          target = 'image/png';
          suffix = '';
          break;
        case 'to-webp':
          target = 'image/webp';
          q = quality / 100;
          suffix = '';
          break;
        case 'from-webp':
          target = format === 'image/jpeg' ? 'image/jpeg' : 'image/png';
          q = target === 'image/jpeg' ? quality / 100 : undefined;
          suffix = '';
          break;
        case 'orient':
          target = (['image/png', 'image/jpeg', 'image/webp'].includes(src.mime) ? src.mime : 'image/png') as OutputMime;
          if (target === 'image/webp' && !webpOk) target = 'image/png';
          q = target === 'image/png' ? undefined : 0.92;
          suffix = 'upright';
          break;
        case 'rotate':
          rot = angle;
          fh = flipH;
          fv = flipV;
          target = (['image/png', 'image/jpeg', 'image/webp'].includes(src.mime) ? src.mime : 'image/png') as OutputMime;
          if (target === 'image/webp' && !webpOk) target = 'image/png';
          q = target === 'image/png' ? undefined : 0.92;
          suffix = 'rotated';
          break;
      }
      if (!canEncode(target)) throw new Error(`This browser cannot create ${EXT[target].toUpperCase()} files.`);
      const box = rotatedSize(width, height, rot);
      const canvas = document.createElement('canvas');
      canvas.width = box.width;
      canvas.height = box.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available in this browser.');
      if (target === 'image/jpeg') {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(fh ? -1 : 1, fv ? -1 : 1);
      ctx.drawImage(src.bitmap, -width / 2, -height / 2, width, height);
      const blob = await toBlob(canvas, target, q);
      canvas.width = canvas.height = 0; // free memory early
      if (blob.type !== target) throw new Error(`The browser produced ${blob.type || 'an unknown type'} instead of ${target}, so nothing was saved.`);
      setOut({ blob, url: URL.createObjectURL(blob), width: box.width, height: box.height, name: outputName(src.file.name, target, suffix) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    clearOutput();
    setSrc((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.url);
        if ('close' in prev.bitmap) prev.bitmap.close();
      }
      return null;
    });
    setError(null);
  };

  const change = out && src ? ((out.blob.size - src.file.size) / src.file.size) * 100 : 0;

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void load(f);
          }}
        >
          <p>Choose an image{mode === 'png-to-jpeg' ? ' (PNG)' : mode === 'jpeg-to-png' ? ' (JPEG)' : ''}, or drop it here. It stays on your device.</p>
          <Button variant="primary" onClick={() => inputRef.current?.click()}>
            Choose image
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={TITLES[mode].accept}
            className="visually-hidden-input"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void load(f);
            }}
          />
        </div>

        {src && (
          <>
            <ResultRows rows={[{ label: 'File', value: src.file.name }, { label: 'Detected type', value: src.mime }, { label: 'Dimensions (as displayed)', value: `${src.width} × ${src.height} px` }, { label: 'Size', value: formatBytes(src.file.size) }, ...(mode === 'orient' ? [{ label: 'EXIF orientation', value: orientation === null ? 'None found (1 = normal)' : `${orientation}${orientation === 1 ? ' (already upright)' : ' (needs rotating)'}`, emphasis: true }] : [])]} />
            {mode === 'to-webp' && !webpOk && <Status tone="error">This browser can’t create WebP files. Try Chrome, Edge, Firefox or Safari 16+.</Status>}
            {mode === 'from-webp' && (
              <SelectField label="Convert to" value={format} onChange={(v) => setFormat(v as OutputMime)} options={[{ value: 'image/png', label: 'PNG (lossless, keeps transparency)' }, { value: 'image/jpeg', label: 'JPEG (smaller, no transparency)' }]} />
            )}

            {mode === 'resize' && (
              <div className="form-grid">
                <NumberField
                  label="Width (px)"
                  value={w}
                  onChange={(v) => {
                    setW(v);
                    if (keep && Number(v) > 0) setH(String(Math.max(1, Math.round((Number(v) * src.height) / src.width))));
                  }}
                />
                <NumberField
                  label="Height (px)"
                  value={h}
                  onChange={(v) => {
                    setH(v);
                    if (keep && Number(v) > 0) setW(String(Math.max(1, Math.round((Number(v) * src.width) / src.height))));
                  }}
                />
                <CheckboxField label="Keep aspect ratio" checked={keep} onChange={setKeep} />
              </div>
            )}
            {mode === 'compress' && (
              <SelectField
                label="Output format"
                value={format}
                onChange={(v) => setFormat(v as OutputMime)}
                options={[{ value: 'image/jpeg', label: 'JPEG' }, ...(webpOk ? [{ value: 'image/webp', label: 'WebP' }] : [])]}
                hint={webpOk ? undefined : 'This browser cannot encode WebP, so only JPEG is offered.'}
              />
            )}
            {(mode === 'compress' || mode === 'png-to-jpeg' || mode === 'to-webp' || (mode === 'from-webp' && format === 'image/jpeg') || (mode === 'resize' && src.mime !== 'image/png')) && (
              <RangeField label="Quality" value={quality} onChange={setQuality} min={10} max={100} step={1} format={(v) => `${v}%`} />
            )}
            {(mode === 'png-to-jpeg' || ((mode === 'compress' || mode === 'from-webp') && format === 'image/jpeg')) && <TextField type="color" label="Background for transparent areas" value={bg} onChange={setBg} />}
            {mode === 'rotate' && (
              <div className="form-grid">
                <SelectField label="Rotate" value={String(angle)} onChange={(v) => setAngle(Number(v))} options={[{ value: '0', label: 'No rotation' }, { value: '90', label: '90° clockwise' }, { value: '180', label: '180°' }, { value: '270', label: '90° counter-clockwise' }]} />
                <CheckboxField label="Flip horizontally" checked={flipH} onChange={setFlipH} />
                <CheckboxField label="Flip vertically" checked={flipV} onChange={setFlipV} />
              </div>
            )}
            <div className="actions">
              <Button variant="primary" onClick={() => void process()} disabled={busy}>
                {busy ? 'Working…' : TITLES[mode].run}
              </Button>
              <Button variant="ghost" onClick={reset}>
                Reset
              </Button>
            </div>
          </>
        )}
        {error && <Status tone="error">{error}</Status>}
      </div>

      <div className="tool-col">
        {!src && <p className="empty-state">Your image preview will appear here.</p>}
        {src && !out && (
          <figure className="preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src.url} alt="Original image preview" />
            <figcaption>Original</figcaption>
          </figure>
        )}
        {out && src && (
          <>
            <figure className="preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={out.url} alt="Processed image preview" />
              <figcaption>Result</figcaption>
            </figure>
            <ResultRows
              rows={[
                { label: 'Output', value: `${out.name} (${out.blob.type})`, emphasis: true },
                { label: 'Dimensions', value: `${out.width} × ${out.height} px` },
                { label: 'Size', value: `${formatBytes(out.blob.size)} (was ${formatBytes(src.file.size)})` },
                { label: 'Change', value: `${change > 0 ? '+' : ''}${change.toFixed(1)}%` },
              ]}
            />
            {change > 0 && mode === 'compress' && <Status tone="warn">The result is larger than the original. Try a lower quality, or keep the original file.</Status>}
            <div className="actions">
              <DownloadBlobButton blob={out.blob} filename={out.name} label={`Download ${EXT[out.blob.type as OutputMime]?.toUpperCase() ?? ''}`} />
            </div>
            <p className="field-hint">Metadata such as EXIF and GPS location is not copied into the new file.</p>
          </>
        )}
      </div>
    </div>
  );
}
