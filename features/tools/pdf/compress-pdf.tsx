'use client';

import { useRef, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { CheckboxField, RangeField, SelectField, Status } from '@/components/tool-kit/fields';
import { ResultRows } from '@/components/tool-kit/output';
import { formatBytes } from '@/lib/format';
import { pdfBlob, useSinglePdf } from '@/features/tools/files/usePdf';
import { optimizePdf, pdfFromImages } from './ops';
import { canvasToBlob, openPdf, releaseCanvas, renderPage } from './pdfjs';

export default function CompressPdf() {
  const { pdf, picker } = useSinglePdf();
  const [mode, setMode] = useState<'lossless' | 'raster'>('lossless');
  const [stripMeta, setStripMeta] = useState(false);
  const [dpi, setDpi] = useState('120');
  const [quality, setQuality] = useState(70);
  const [result, setResult] = useState<{ bytes: Uint8Array; method: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef(false);
  const stale = () => setResult(null);

  const run = async () => {
    if (!pdf) return;
    setBusy(true);
    setError(null);
    stale();
    cancel.current = false;
    try {
      if (mode === 'lossless') {
        const r = await optimizePdf(pdf.bytes, { removeMetadata: stripMeta });
        setResult({ bytes: r.bytes, method: r.method });
      } else {
        const doc = await openPdf(pdf.bytes);
        try {
          const pages: Array<{ data: Uint8Array; mime: 'image/jpeg'; widthPt: number; heightPt: number }> = [];
          const scale = Number(dpi) / 72;
          for (let i = 1; i <= doc.numPages; i++) {
            if (cancel.current) throw new Error('Cancelled.');
            setProgress(`Re-encoding page ${i} of ${doc.numPages}…`);
            const c = await renderPage(doc, i, scale);
            const blob = await canvasToBlob(c, 'image/jpeg', quality / 100);
            pages.push({ data: new Uint8Array(await blob.arrayBuffer()), mime: 'image/jpeg' as const, widthPt: c.width / scale, heightPt: c.height / scale });
            releaseCanvas(c);
          }
          setResult({ bytes: await pdfFromImages(pages), method: `pages converted to ${dpi} DPI JPEG images (quality ${quality}%)` });
        } finally {
          await doc.loadingTask.destroy();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const saved = result && pdf ? pdf.bytes.length - result.bytes.length : 0;
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && (
          <>
            <SelectField
              label="Method"
              value={mode}
              onChange={(v) => { setMode(v as 'lossless'); stale(); }}
              options={[{ value: 'lossless', label: 'Lossless — keep text, links and quality' }, { value: 'raster', label: 'Strong — turn pages into compressed images (lossy)' }]}
            />
            {mode === 'lossless' ? (
              <CheckboxField label="Also remove document info and XMP metadata" checked={stripMeta} onChange={(v) => { setStripMeta(v); stale(); }} />
            ) : (
              <>
                <Status tone="warn">Strong mode makes every page a picture: text can no longer be selected, searched or read by screen readers, and links and forms are lost. It helps most with scanned or image-heavy PDFs.</Status>
                <SelectField label="Image resolution" value={dpi} onChange={(v) => { setDpi(v); stale(); }} options={[['72', '72 DPI — smallest'], ['100', '100 DPI'], ['120', '120 DPI'], ['150', '150 DPI — readable print'], ['200', '200 DPI']].map(([value, label]) => ({ value, label }))} />
                <RangeField label="JPEG quality" value={quality} min={30} max={95} onChange={(v) => { setQuality(v); stale(); }} format={(v) => `${v}%`} />
              </>
            )}
            <div className="actions">
              <Button variant="primary" disabled={busy} onClick={() => void run()}>
                {busy ? 'Compressing…' : 'Compress PDF'}
              </Button>
              {busy && mode === 'raster' && <Button variant="ghost" onClick={() => (cancel.current = true)}>Cancel</Button>}
            </div>
            {progress && <p className="summary" role="status">{progress}</p>}
          </>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {!result && !error && <p className="empty-state">Lossless mode rebuilds the file and drops unused data. Many PDFs are already compact, so the saving can be small or zero — you’ll see the real numbers.</p>}
        {result && pdf && (
          <>
            <ResultRows
              rows={[
                { label: 'Original', value: formatBytes(pdf.bytes.length) },
                { label: 'Result', value: formatBytes(result.bytes.length), emphasis: true },
                { label: 'Change', value: `${saved >= 0 ? '−' : '+'}${formatBytes(Math.abs(saved))} (${((Math.abs(saved) / pdf.bytes.length) * 100).toFixed(1)}% ${saved >= 0 ? 'smaller' : 'larger'})` },
                { label: 'Method', value: result.method },
              ]}
            />
            {saved <= 0 ? (
              <Status tone="info">This PDF could not be made smaller {mode === 'lossless' ? 'without losing quality. Try Strong mode if it is a scan.' : 'with these settings. Keep your original file.'}</Status>
            ) : (
              <DownloadBlobButton blob={pdfBlob(result.bytes)} filename={`${pdf.base}-compressed.pdf`} label={`Download compressed PDF (${formatBytes(result.bytes.length)})`} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
