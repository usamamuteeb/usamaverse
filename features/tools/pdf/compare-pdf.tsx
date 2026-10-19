'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Button } from '@/components/tool-kit/actions';
import { SelectField, Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { MAX_PDF_BYTES } from '@/features/tools/files/pdf';
import { diffToUnifiedText, lineDiff, type DiffOp } from '@/features/tools/text/logic';
import { changePercent, pixelDiff } from './compare';
import { openPdf, pageTextRuns, releaseCanvas, renderPage } from './pdfjs';
import { linesToText, runsToLines } from './text';
import { CopyButton } from '@/components/tool-kit/actions';

interface Side {
  name: string;
  bytes: Uint8Array;
  doc: PDFDocumentProxy;
}

const THUMB = 360;

async function renderAt(doc: PDFDocumentProxy, n: number, width: number) {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: 1 });
  return renderPage(doc, n, width / vp.width);
}

/** Draws both pages at the same width, compares the common area, returns an image URL + stats. */
async function comparePage(a: PDFDocumentProxy, b: PDFDocumentProxy, n: number, width: number) {
  const ca = await renderAt(a, n, width);
  const cb = await renderAt(b, n, width);
  const h = Math.min(ca.height, cb.height);
  const ia = ca.getContext('2d')!.getImageData(0, 0, width, h);
  const ib = cb.getContext('2d')!.getImageData(0, 0, width, h);
  const d = pixelDiff(ia.data, ib.data, width, h);
  const sizeDiffers = Math.abs(ca.height - cb.height) > 2;
  // Result image: B faded, with changes in red.
  const ctx = cb.getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(0, 0, cb.width, cb.height);
  const tmp = document.createElement('canvas');
  tmp.width = width;
  tmp.height = h;
  tmp.getContext('2d')!.putImageData(new ImageData(d.overlay as Uint8ClampedArray<ArrayBuffer>, width, h), 0, 0);
  ctx.drawImage(tmp, 0, 0);
  const url = await new Promise<string>((res) => cb.toBlob((bl) => res(bl ? URL.createObjectURL(bl) : ''), 'image/png'));
  releaseCanvas(ca);
  releaseCanvas(cb);
  releaseCanvas(tmp);
  return { url, changed: d.changed, total: d.total, sizeDiffers };
}

async function docText(doc: PDFDocumentProxy): Promise<string> {
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) parts.push(`--- Page ${p} ---\n${linesToText(runsToLines((await pageTextRuns(doc, p)).runs))}`);
  return parts.join('\n');
}

export default function ComparePdf() {
  const [a, setA] = useState<Side | null>(null);
  const [b, setB] = useState<Side | null>(null);
  const [mode, setMode] = useState<'visual' | 'text'>('visual');
  const [rows, setRows] = useState<Array<{ n: number; url: string; pct: string; changed: number; note: string }>>([]);
  const [ops, setOps] = useState<DiffOp[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const urls = useRef<string[]>([]);
  const docs = useRef<PDFDocumentProxy[]>([]);

  useEffect(
    () => () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      docs.current.forEach((d) => void d.loadingTask.destroy());
    },
    [],
  );

  const load = async (f: File, set: (s: Side) => void) => {
    setError(null);
    setRows([]);
    setOps(null);
    if (f.size > MAX_PDF_BYTES) return setError(`${f.name} is ${formatBytes(f.size)}; the limit is ${formatBytes(MAX_PDF_BYTES)}.`);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await openPdf(bytes);
      docs.current.push(doc);
      set({ name: f.name, bytes, doc });
    } catch (e) {
      setError(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const run = async () => {
    if (!a || !b) return;
    setBusy(true);
    setError(null);
    setRows([]);
    setOps(null);
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    try {
      if (mode === 'text') {
        setProgress('Reading text…');
        setOps(lineDiff(await docText(a.doc), await docText(b.doc)));
      } else {
        const n = Math.min(a.doc.numPages, b.doc.numPages, 200);
        const out: Array<{ n: number; url: string; pct: string; changed: number; note: string }> = [];
        for (let p = 1; p <= n; p++) {
          setProgress(`Comparing page ${p} of ${n}…`);
          const r = await comparePage(a.doc, b.doc, p, THUMB * 2);
          urls.current.push(r.url);
          out.push({ n: p, url: r.url, pct: changePercent(r.changed, r.total), changed: r.changed, note: r.sizeDiffers ? 'Page sizes differ; only the shared area is compared.' : '' });
          setRows([...out]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const extraA = a && b ? a.doc.numPages - b.doc.numPages : 0;
  const changedPages = rows.filter((r) => r.changed > 0).length;

  return (
    <div className="stack">
      <div className="tool-grid">
        <div className="tool-col">
          <FileDrop accept="application/pdf,.pdf" label="Choose original PDF" onFiles={([f]) => void load(f, setA)}>
            <p>Original (A)</p>
          </FileDrop>
          {a && <p className="summary">A: {a.name} — {a.doc.numPages} pages</p>}
        </div>
        <div className="tool-col">
          <FileDrop accept="application/pdf,.pdf" label="Choose changed PDF" onFiles={([f]) => void load(f, setB)}>
            <p>Changed version (B)</p>
          </FileDrop>
          {b && <p className="summary">B: {b.name} — {b.doc.numPages} pages</p>}
        </div>
      </div>
      <div className="form-grid">
        <SelectField label="Compare" value={mode} onChange={(v) => { setMode(v as 'visual'); setRows([]); setOps(null); }} options={[{ value: 'visual', label: 'Visually — highlight changed pixels' }, { value: 'text', label: 'Text — show added and removed lines' }]} />
      </div>
      <div className="actions">
        <Button variant="primary" disabled={!a || !b || busy} onClick={() => void run()}>
          {busy ? 'Comparing…' : 'Compare PDFs'}
        </Button>
      </div>
      {progress && <p className="summary" role="status">{progress}</p>}
      {error && <Status tone="error">{error}</Status>}
      <Status tone="info">Pages are compared in order (page 1 with page 1, …). An inserted page shifts everything after it, and small layout shifts show up as changes. This is not a legal or semantic review.</Status>
      {extraA !== 0 && (rows.length > 0 || ops) && <Status tone="warn">{extraA > 0 ? `A has ${extraA} more page(s) than B.` : `B has ${-extraA} more page(s) than A.`} Extra pages were not compared visually.</Status>}
      {rows.length > 0 && (
        <>
          <p className="summary" aria-live="polite">{changedPages === 0 ? 'No visual differences found.' : `${changedPages} of ${rows.length} pages differ.`}</p>
          <ul className="compare-grid" role="list">
            {rows.map((r) => (
              <li key={r.n} className={r.changed ? 'compare-card changed' : 'compare-card'}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt={`Page ${r.n}: changes shown in red`} />
                <p>
                  <strong>Page {r.n}</strong> — {r.changed ? `${r.pct} changed` : 'no change'}
                </p>
                {r.note && <p className="field-hint">{r.note}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
      {ops && (
        <>
          <p className="summary">{ops.filter((o) => o.type === 'add').length} lines added, {ops.filter((o) => o.type === 'remove').length} removed.</p>
          <div className="actions">
            <CopyButton text={diffToUnifiedText(ops)} label="Copy diff" />
          </div>
          <div className="diff" role="table" aria-label="Text differences">
            {ops.filter((o) => o.type !== 'equal' || o.text.startsWith('--- Page')).map((op, i) => (
              <div key={i} role="row" className={`diff-line diff-${op.type}`}>
                <span role="cell" className="diff-num">{op.a ?? ''}</span>
                <span role="cell" className="diff-num">{op.b ?? ''}</span>
                <span role="cell" className="diff-sign">{op.type === 'add' ? '+' : op.type === 'remove' ? '−' : ' '}</span>
                <span role="cell" className="diff-text">{op.text || ' '}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
