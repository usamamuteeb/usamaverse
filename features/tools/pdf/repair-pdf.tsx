'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { MAX_PDF_BYTES } from '@/features/tools/files/pdf';
import { pdfBlob } from '@/features/tools/files/usePdf';
import { pdfFromImages, repairPdf } from './ops';
import { canvasToBlob, openPdf, releaseCanvas, renderPage } from './pdfjs';
import { ResultPreview } from './PageGrid';

export default function RepairPdf() {
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [out, setOut] = useState<{ bytes: Uint8Array; notes: string[]; lossy: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = file?.name.replace(/\.pdf$/i, '') || 'document';

  const run = async (bytes: Uint8Array) => {
    setBusy(true);
    setError(null);
    setOut(null);
    setFallback(false);
    try {
      const r = await repairPdf(bytes);
      setOut({ bytes: r.bytes, notes: r.notes, lossy: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFallback(!/encrypted|%PDF/.test(String(e)));
    } finally {
      setBusy(false);
    }
  };

  const rasterRecover = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await openPdf(file.bytes);
      const pages: Array<{ data: Uint8Array; mime: 'image/jpeg'; widthPt: number; heightPt: number }> = [];
      const notes: string[] = [];
      try {
        for (let i = 1; i <= doc.numPages; i++) {
          try {
            const c = await renderPage(doc, i, 150 / 72);
            const blob = await canvasToBlob(c, 'image/jpeg', 0.9);
            pages.push({ data: new Uint8Array(await blob.arrayBuffer()), mime: 'image/jpeg' as const, widthPt: (c.width * 72) / 150, heightPt: (c.height * 72) / 150 });
            releaseCanvas(c);
          } catch {
            notes.push(`Page ${i} could not be drawn and was skipped.`);
          }
        }
      } finally {
        await doc.loadingTask.destroy();
      }
      if (!pages.length) throw new Error('No page could be recovered.');
      notes.unshift(`Recovered ${pages.length} page${pages.length === 1 ? '' : 's'} as images (150 DPI).`);
      setOut({ bytes: await pdfFromImages(pages), notes, lossy: true });
      setFallback(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <FileDrop
          accept="application/pdf,.pdf"
          label="Choose damaged PDF"
          onFiles={async ([f]) => {
            if (f.size > MAX_PDF_BYTES) return setError(`This file is ${formatBytes(f.size)}; the limit is ${formatBytes(MAX_PDF_BYTES)}.`);
            const bytes = new Uint8Array(await f.arrayBuffer());
            setFile({ name: f.name, bytes });
            void run(bytes);
          }}
        />
        {file && <p className="summary">{file.name} — {formatBytes(file.bytes.length)}</p>}
        {busy && <p className="summary" role="status">Working…</p>}
        {fallback && file && (
          <div className="stack">
            <Status tone="info">The structure could not be rebuilt. As a last resort, pages that a PDF viewer can still draw can be recovered as images (text will not be selectable).</Status>
            <Button onClick={() => void rasterRecover()} disabled={busy}>
              Recover pages as images
            </Button>
          </div>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {!out && !error && <p className="empty-state">Repair rebuilds a PDF whose internal index or ending is damaged. It cannot restore data that is missing from the file, and it never removes passwords.</p>}
        {out && (
          <>
            <Status tone={out.lossy ? 'warn' : 'success'}>{out.lossy ? 'Recovered as images — check every page.' : 'Rebuilt successfully — check the pages before relying on the file.'}</Status>
            <ul>
              {out.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <ResultPreview bytes={out.bytes} />
            <DownloadBlobButton blob={pdfBlob(out.bytes)} filename={`${base}-repaired.pdf`} label={`Download repaired PDF (${formatBytes(out.bytes.length)})`} />
          </>
        )}
      </div>
    </div>
  );
}
