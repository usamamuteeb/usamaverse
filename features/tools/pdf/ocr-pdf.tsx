'use client';

import { useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { CheckboxField, Status, TextField } from '@/components/tool-kit/fields';
import { parsePageRanges, readInfo } from '@/features/tools/files/pdf';
import { pdfBlob, usePdfWorkspace, useSinglePdf } from '@/features/tools/files/usePdf';
import { formatBytes } from '@/lib/format';
import { addOcrTextLayer, type OcrPage, type OcrWord } from './ocr-layer';
import { openPdf, pageTextRuns, releaseCanvas, renderPage } from './pdfjs';
import { ResultPreview } from './PageGrid';

export default function OcrPdf() {
  const { pdf, picker } = useSinglePdf();
  const shared = usePdfWorkspace();
  const [spec, setSpec] = useState('all');
  const [skipExisting, setSkipExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [out, setOut] = useState<{ source: Uint8Array; bytes: Uint8Array; added: number; unsupported: number; pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef(false);

  const run = async () => {
    if (!pdf) return;
    setBusy(true); setError(null); setOut(null); cancel.current = false;
    let document: PDFDocumentProxy | null = null;
    let worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>> | null = null;
    try {
      document = await openPdf(pdf.bytes);
      const pages = parsePageRanges(spec, document.numPages);
      const { createWorker } = await import('tesseract.js');
      setProgress('Loading local English OCR model…');
      worker = await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr',
      });
      const recognized: OcrPage[] = [];
      for (const pageIndex of pages) {
        if (cancel.current) throw new Error('OCR cancelled.');
        if (skipExisting) {
          const { runs } = await pageTextRuns(document, pageIndex + 1);
          if (runs.some((run) => run.str.trim())) continue;
        }
        setProgress(`Recognizing page ${pageIndex + 1} of ${document.numPages}…`);
        const canvas = await renderPage(document, pageIndex + 1, 2);
        try {
          const result = await worker.recognize(canvas, {}, { blocks: true });
          const words: OcrWord[] = (result.data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words.map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox })))));
          recognized.push({ pageIndex, imageWidth: canvas.width, imageHeight: canvas.height, words });
        } finally { releaseCanvas(canvas); }
      }
      if (!recognized.length) throw new Error('Selected pages already have selectable text. Turn off “Skip pages with text” to OCR them again.');
      setProgress('Writing a searchable text layer…');
      const result = await addOcrTextLayer(pdf.bytes, recognized);
      setOut({ ...result, source: pdf.bytes, pages: recognized.length });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally {
      if (worker) await worker.terminate();
      if (document) await document.loadingTask.destroy();
      setProgress(''); setBusy(false);
    }
  };

  const ready = out?.source === pdf?.bytes ? out : null;
  return <div className="tool-grid">
    <div className="tool-col">
      {picker}
      {pdf && <>
        <TextField label="Pages" value={spec} onChange={setSpec} hint="all, or e.g. 1-5" />
        <CheckboxField label="Skip pages with selectable text" checked={skipExisting} onChange={setSkipExisting} />
        <div className="actions"><Button disabled={busy} onClick={() => void run()}>{busy ? 'Recognizing…' : 'Make PDF searchable'}</Button>{busy && <Button variant="ghost" onClick={() => { cancel.current = true; }}>Cancel</Button>}</div>
        {progress && <p className="summary" role="status">{progress}</p>}
      </>}
      <Status tone="info">English OCR runs on this device. It adds an invisible searchable text layer to the original pages; the visible scan stays intact.</Status>
    </div>
    <div className="tool-col">
      {error && <Status tone="error">{error}</Status>}
      {!ready && !error && <p className="empty-state">Turn scanned pages into searchable, selectable PDFs without uploading them.</p>}
      {ready && pdf && <>
        <Status tone="success">Added {ready.added} recognized words across {ready.pages} page{ready.pages === 1 ? '' : 's'}.</Status>
        {ready.unsupported > 0 && <Status tone="warn">{ready.unsupported} words used characters the embedded Latin font cannot write and were skipped.</Status>}
        <ResultPreview bytes={ready.bytes} />
        <DownloadBlobButton blob={pdfBlob(ready.bytes)} filename={`${pdf.base}-searchable.pdf`} label={`Download searchable PDF (${formatBytes(ready.bytes.length)})`} />
        {shared && <Button onClick={async () => {
          try { shared.setPdf({ name: `${pdf.base}-searchable.pdf`, base: `${pdf.base}-searchable`, bytes: ready.bytes, info: await readInfo(ready.bytes) }); }
          catch (e) { setError(e instanceof Error ? e.message : String(e)); }
        }}>Continue with this version</Button>}
      </>}
    </div>
  </div>;
}
