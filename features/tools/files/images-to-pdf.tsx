'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { NumberField, SelectField, Status } from '@/components/tool-kit/fields';
import { FileDrop, nextId, OrderedFileList, type OrderedItem } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { readMetadata } from '@/features/tools/image/exif';
import { detectSignature } from './logic';
import { imagesToPdf, PAGE_SIZES } from './pdf';
import { pdfBlob } from './usePdf';

interface Item extends OrderedItem { file: File }

async function encodeCanvas(bmp: ImageBitmap, mime: 'image/png' | 'image/jpeg'): Promise<Uint8Array> {
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  const b = await new Promise<Blob>((res, rej) => c.toBlob((x) => (x ? res(x) : rej(new Error('Encoding failed.'))), mime, 0.92));
  return new Uint8Array(await b.arrayBuffer());
}

/** PNG and upright JPEG embed byte-for-byte; rotated JPEGs and other formats are re-encoded. */
async function toEmbeddable(f: File): Promise<{ bytes: Uint8Array; mime: 'image/png' | 'image/jpeg'; width: number; height: number }> {
  const bytes = new Uint8Array(await f.arrayBuffer());
  const sig = detectSignature(bytes.subarray(0, 32));
  if (!sig || !sig.mime.startsWith('image/')) throw new Error(`“${f.name}” is not a supported image.`);
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(new Blob([bytes as BlobPart]), { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`“${f.name}” could not be decoded by this browser.`);
  }
  const { width, height } = bmp;
  try {
    if (sig.mime === 'image/png') return { bytes, mime: 'image/png', width, height };
    if (sig.mime === 'image/jpeg') {
      const o = readMetadata(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer).orientation;
      if (!o || o === 1) return { bytes, mime: 'image/jpeg', width, height };
      return { bytes: await encodeCanvas(bmp, 'image/jpeg'), mime: 'image/jpeg', width, height };
    }
    return { bytes: await encodeCanvas(bmp, 'image/png'), mime: 'image/png', width, height };
  } finally {
    bmp.close();
  }
}

export default function ImagesToPdf() {
  const [items, setItems] = useState<Item[]>([]);
  const [size, setSize] = useState<'fit' | keyof typeof PAGE_SIZES>('a4');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [margin, setMargin] = useState('24');
  const [out, setOut] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <FileDrop multiple accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" label="Add images" onFiles={(fs) => { setOut(null); setItems((x) => [...x, ...fs.map((f) => ({ id: nextId(), name: f.name, size: f.size, file: f }))].slice(0, 200)); }} />
        <OrderedFileList items={items} onChange={(x) => { setItems(x); setOut(null); }} label="Images in page order" />
        <div className="form-grid">
          <SelectField label="Page size" value={size} onChange={(v) => { setSize(v as 'a4'); setOut(null); }} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }, { value: 'legal', label: 'US Legal' }, { value: 'a5', label: 'A5' }, { value: 'fit', label: 'Same as each image' }]} />
          {size !== 'fit' && <SelectField label="Orientation" value={orientation} onChange={(v) => { setOrientation(v as 'auto'); setOut(null); }} options={[{ value: 'auto', label: 'Automatic per image' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />}
          <NumberField label="Margin (points, 72 = 1 inch)" value={margin} onChange={(v) => { setMargin(v); setOut(null); }} />
        </div>
        <div className="actions">
          <Button
            variant="primary"
            disabled={!items.length || busy}
            onClick={async () => {
              setError(null);
              setBusy(true);
              try {
                const total = items.reduce((n, i) => n + i.size, 0);
                if (total > 200 * 1024 * 1024) throw new Error(`Total ${formatBytes(total)} is over the 200 MB limit.`);
                const imgs: Array<Awaited<ReturnType<typeof toEmbeddable>>> = [];
                for (const it of items) imgs.push(await toEmbeddable(it.file));
                setOut(pdfBlob(await imagesToPdf(imgs, { size, marginPt: Math.max(0, Number(margin) || 0), orientation })));
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Building PDF…' : 'Create PDF'}
          </Button>
          {items.length > 0 && <Button variant="ghost" onClick={() => { setItems([]); setOut(null); }}>Reset</Button>}
        </div>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {out ? (
          <>
            <Status tone="success">PDF with {items.length} page{items.length === 1 ? '' : 's'} ({formatBytes(out.size)}).</Status>
            <DownloadBlobButton blob={out} filename="images.pdf" label="Download PDF" />
          </>
        ) : (
          <p className="empty-state">Add images (PNG, JPEG, WebP, GIF, BMP), order them, then create the PDF.</p>
        )}
        <p className="field-hint">PNG and upright JPEG images are embedded unchanged. Rotated photos (EXIF) are re-encoded upright, and WebP/GIF/BMP are converted to PNG.</p>
      </div>
    </div>
  );
}
