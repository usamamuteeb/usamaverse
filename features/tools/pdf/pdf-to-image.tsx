'use client';

import { useRef, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { RangeField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { parsePageRanges } from '@/features/tools/files/pdf';
import { useSinglePdf } from '@/features/tools/files/usePdf';
import { createZip } from '@/features/tools/files/zip';
import { canvasToBlob, openPdf, releaseCanvas, renderPage } from './pdfjs';

interface Out {
  name: string;
  blob: Blob;
}

export default function PdfToImage() {
  const { pdf, picker } = useSinglePdf();
  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [dpi, setDpi] = useState('150');
  const [quality, setQuality] = useState(85);
  const [spec, setSpec] = useState('all');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [outs, setOuts] = useState<Out[]>([]);
  const [zip, setZip] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef(false);
  const ext = format === 'image/png' ? 'png' : 'jpg';
  const reset = () => {
    setOuts([]);
    setZip(null);
  };

  const run = async () => {
    if (!pdf) return;
    setBusy(true);
    setError(null);
    reset();
    cancel.current = false;
    const doc = await openPdf(pdf.bytes).catch((e) => {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    });
    if (!doc) return setBusy(false);
    try {
      const pages = parsePageRanges(spec, doc.numPages).filter((v, i, a) => a.indexOf(v) === i);
      const pad = String(doc.numPages).length;
      const made: Out[] = [];
      for (let k = 0; k < pages.length; k++) {
        if (cancel.current) throw new Error('Cancelled. Pages finished so far are listed below.');
        setProgress(`Rendering page ${pages[k] + 1} (${k + 1} of ${pages.length})…`);
        const canvas = await renderPage(doc, pages[k] + 1, Number(dpi) / 72);
        const blob = await canvasToBlob(canvas, format, format === 'image/jpeg' ? quality / 100 : undefined);
        releaseCanvas(canvas);
        made.push({ name: `${pdf.base}-page-${String(pages[k] + 1).padStart(pad, '0')}.${ext}`, blob });
        setOuts([...made]);
      }
      if (made.length > 1) {
        setProgress('Packing ZIP…');
        const files = await Promise.all(made.map(async (m) => ({ name: m.name, data: new Uint8Array(await m.blob.arrayBuffer()) })));
        setZip(new Blob([(await createZip(files, { compress: false })).bytes as BlobPart], { type: 'application/zip' }));
      }
      setProgress('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress('');
    } finally {
      await doc.loadingTask.destroy();
      setBusy(false);
    }
  };

  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && (
          <>
            <div className="form-grid">
              <SelectField label="Format" value={format} onChange={(v) => { setFormat(v as 'image/jpeg'); reset(); }} options={[{ value: 'image/jpeg', label: 'JPG (smaller)' }, { value: 'image/png', label: 'PNG (lossless)' }]} />
              <SelectField label="Resolution" value={dpi} onChange={(v) => { setDpi(v); reset(); }} options={[['72', '72 DPI — screen'], ['96', '96 DPI'], ['150', '150 DPI — default'], ['200', '200 DPI'], ['300', '300 DPI — print']].map(([value, label]) => ({ value, label }))} />
              <TextField label="Pages" value={spec} onChange={(v) => { setSpec(v); reset(); }} hint="all, or e.g. 1-3, 8" />
            </div>
            {format === 'image/jpeg' && <RangeField label="JPG quality" value={quality} min={40} max={100} onChange={(v) => { setQuality(v); reset(); }} format={(v) => `${v}%`} />}
            <div className="actions">
              <Button variant="primary" onClick={() => void run()} disabled={busy}>
                {busy ? 'Converting…' : `Convert to ${ext.toUpperCase()}`}
              </Button>
              {busy && <Button variant="ghost" onClick={() => (cancel.current = true)}>Cancel</Button>}
            </div>
            {progress && <p className="summary" role="status">{progress}</p>}
          </>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {outs.length === 0 && !error && <p className="empty-state">Each page is rendered to an image on your device. This makes pictures of pages; it does not extract the original embedded images.</p>}
        {zip && <DownloadBlobButton blob={zip} filename={`${pdf?.base ?? 'pages'}-${ext}.zip`} label={`Download all ${outs.length} as ZIP (${formatBytes(zip.size)})`} />}
        {outs.length > 0 && (
          <ul className="file-list" aria-label="Rendered pages">
            {outs.slice(0, 60).map((o) => (
              <li key={o.name}>
                <span className="file-name">{o.name}</span>
                <span className="muted">{formatBytes(o.blob.size)}</span>
                <DownloadBlobButton blob={o.blob} filename={o.name} label="Download" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
