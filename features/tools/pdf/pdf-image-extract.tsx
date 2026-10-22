'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { createZip } from '@/features/tools/files/zip';
import { useSinglePdf } from '@/features/tools/files/usePdf';
import { formatBytes } from '@/lib/format';
import { canvasToBlob, releaseCanvas } from './pdfjs';
import { extractPdfImagePixels } from './content-edit';

export default function PdfImageExtract() {
  const { pdf, picker } = useSinglePdf();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ source: Uint8Array; blob: Blob; filename: string; images: Array<{ page: number; width: number; height: number }> } | null>(null);

  const run = async () => {
    if (!pdf) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const pixels = await extractPdfImagePixels(pdf.bytes);
      if (!pixels.length) throw new Error('No extractable embedded image objects were found. A page may contain vector art or images nested in unsupported formats.');
      const files: Array<{ name: string; data: Uint8Array; date: Date }> = [];
      for (const item of pixels) {
        const canvas = document.createElement('canvas');
        canvas.width = item.width; canvas.height = item.height;
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas is unavailable in this browser.');
          const imageData = new ImageData(item.width, item.height);
          imageData.data.set(item.rgba);
          ctx.putImageData(imageData, 0, 0);
          const blob = await canvasToBlob(canvas, 'image/png');
          files.push({ name: `page-${item.page}-image-${item.ordinal}.png`, data: new Uint8Array(await blob.arrayBuffer()), date: new Date() });
        } finally { releaseCanvas(canvas); }
      }
      if (files.length === 1) setResult({ source: pdf.bytes, blob: new Blob([files[0].data as BlobPart], { type: 'image/png' }), filename: `${pdf.base}-${files[0].name}`, images: pixels });
      else {
        const zip = await createZip(files, { compress: false });
        setResult({ source: pdf.bytes, blob: new Blob([zip.bytes as BlobPart], { type: 'application/zip' }), filename: `${pdf.base}-images.zip`, images: pixels });
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const ready = result?.source === pdf?.bytes ? result : null;
  return <div className="tool-grid">
    <div className="tool-col">
      {picker}
      {pdf && <Button disabled={busy} onClick={() => void run()}>{busy ? 'Extracting…' : 'Extract embedded images'}</Button>}
      <Status tone="info">Downloads embedded image objects at their native pixel size. This differs from converting whole pages to JPG or PNG.</Status>
    </div>
    <div className="tool-col">
      {error && <Status tone="error">{error}</Status>}
      {!ready && !error && <p className="empty-state">Choose a PDF to retrieve its embedded images as PNG files.</p>}
      {ready && <>
        <Status tone="success">Found {ready.images.length} image{ready.images.length === 1 ? '' : 's'} across {new Set(ready.images.map((item) => item.page)).size} page{new Set(ready.images.map((item) => item.page)).size === 1 ? '' : 's'}.</Status>
        <ul className="file-list" aria-label="Extracted images">{ready.images.map((item, index) => <li key={index}><span className="file-name">Page {item.page} · {item.width} × {item.height} px</span></li>)}</ul>
        <DownloadBlobButton blob={ready.blob} filename={ready.filename} label={`Download ${ready.images.length === 1 ? 'PNG' : 'ZIP'} (${formatBytes(ready.blob.size)})`} />
      </>}
    </div>
  </div>;
}
