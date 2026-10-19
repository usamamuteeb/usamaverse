'use client';

import { useEffect, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { CheckboxField, LiveRegion, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { pdfBlob, useSinglePdf } from '@/features/tools/files/usePdf';
import { mixPages, type Box } from './ops';
import { canvasToBlob, openPdf, pageTextRuns, releaseCanvas, renderPage } from './pdfjs';
import { usePdfPreview } from './PageGrid';
import { PageNav, PageView, svgY } from './PageView';
import { findTextBoxes, rectFromPoints } from './redact';

type Marks = Record<number, Box[]>; // key: 1-based page

export default function RedactPdf() {
  const { pdf, picker } = useSinglePdf();
  const { doc } = usePdfPreview(pdf?.bytes ?? null);
  const [page, setPage] = useState(1);
  const [marks, setMarks] = useState<Marks>({});
  const [drag, setDrag] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null);
  const [term, setTerm] = useState('');
  const [dpi, setDpi] = useState('200');
  const [flattenAll, setFlattenAll] = useState(false);
  const [out, setOut] = useState<{ bytes: Uint8Array; verified: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMarks({});
    setPage(1);
    setOut(null);
  }, [pdf]);

  const total = Object.values(marks).reduce((n, b) => n + b.length, 0);
  const addBoxes = (p: number, boxes: Box[]) => {
    setMarks((m) => ({ ...m, [p]: [...(m[p] ?? []), ...boxes] }));
    setOut(null);
  };

  const search = async () => {
    if (!doc || !term.trim()) return;
    setBusy(true);
    setError(null);
    let found = 0;
    try {
      const next: Marks = { ...marks };
      for (let p = 1; p <= doc.numPages; p++) {
        const { runs } = await pageTextRuns(doc, p);
        const boxes = findTextBoxes(runs, term);
        if (boxes.length) {
          next[p] = [...(next[p] ?? []), ...boxes];
          found += boxes.length;
        }
      }
      setMarks(next);
      setOut(null);
      setMsg(found ? `Marked ${found} match${found === 1 ? '' : 'es'} of “${term}”. Check each page — matches inside images or scans can’t be found.` : `“${term}” was not found in the text layer.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!pdf || !doc) return;
    setBusy(true);
    setError(null);
    setOut(null);
    try {
      const scale = Number(dpi) / 72;
      const pages: Parameters<typeof mixPages>[1] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const boxes = marks[p] ?? [];
        if (!boxes.length && !flattenAll) {
          pages.push({ src: p - 1 });
          continue;
        }
        setMsg(`Flattening page ${p} of ${doc.numPages}…`);
        const c = await renderPage(doc, p, scale);
        const ctx = c.getContext('2d')!;
        const hPt = c.height / scale;
        ctx.fillStyle = '#000';
        for (const b of boxes) ctx.fillRect(Math.floor(b.x * scale), Math.floor((hPt - b.y - b.height) * scale), Math.ceil(b.width * scale) + 1, Math.ceil(b.height * scale) + 1);
        const blob = await canvasToBlob(c, 'image/jpeg', 0.92);
        pages.push({ data: new Uint8Array(await blob.arrayBuffer()), mime: 'image/jpeg', widthPt: c.width / scale, heightPt: hPt });
        releaseCanvas(c);
      }
      const bytes = await mixPages(pdf.bytes, pages);
      // Verify: the searched term must no longer be in the text layer of redacted pages.
      let verified = '';
      if (term.trim()) {
        const check = await openPdf(bytes);
        let left = 0;
        for (let p = 1; p <= check.numPages; p++) if (marks[p]?.length || flattenAll) left += findTextBoxes((await pageTextRuns(check, p)).runs, term).length;
        await check.loadingTask.destroy();
        verified = left === 0 ? `Checked: “${term}” no longer appears in the text of the redacted pages.` : `Warning: “${term}” still appears ${left} time(s) in the text.`;
      }
      setOut({ bytes, verified });
      setMsg('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pageMarks = marks[page] ?? [];
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && doc && (
          <>
            <div className="form-grid">
              <TextField label="Find and mark text" value={term} onChange={setTerm} placeholder="e.g. a name or account number" />
            </div>
            <div className="actions">
              <Button onClick={() => void search()} disabled={busy || !term.trim()}>
                Mark all matches
              </Button>
              <Button variant="ghost" onClick={() => { setMarks((m) => ({ ...m, [page]: (m[page] ?? []).slice(0, -1) })); setOut(null); }} disabled={!pageMarks.length}>
                Undo last box on this page
              </Button>
              <Button variant="ghost" onClick={() => { setMarks({}); setOut(null); }} disabled={!total}>
                Clear all
              </Button>
            </div>
            <p className="field-hint">Or drag on the page to draw a box over anything — text, images or signatures.</p>
            <PageNav page={page} count={doc.numPages} onChange={setPage} />
            <PageView
              doc={doc}
              pageNumber={page}
              label={`Page ${page}`}
              onPointerDown={(pt) => setDrag({ a: pt, b: pt })}
              onPointerMove={(pt) => setDrag((d) => (d ? { ...d, b: pt } : d))}
              onPointerUp={(pt) => {
                if (drag) {
                  const r = rectFromPoints(drag.a, pt);
                  if (r.width > 2 && r.height > 2) addBoxes(page, [r]);
                }
                setDrag(null);
              }}
              overlay={(m) => (
                <>
                  {pageMarks.map((b, i) => (
                    <rect key={i} x={b.x} y={svgY(m, b.y + b.height)} width={b.width} height={b.height} fill="#000" fillOpacity={0.75} stroke="#f04459" strokeWidth={1} />
                  ))}
                  {drag && (() => {
                    const r = rectFromPoints(drag.a, drag.b);
                    return <rect x={r.x} y={svgY(m, r.y + r.height)} width={r.width} height={r.height} fill="#000" fillOpacity={0.4} stroke="#f04459" strokeDasharray="4 3" />;
                  })()}
                </>
              )}
            />
            <p className="summary">{total} box{total === 1 ? '' : 'es'} in total, {pageMarks.length} on this page.</p>
            <LiveRegion>{msg}</LiveRegion>
            {msg && <p className="summary">{msg}</p>}
          </>
        )}
      </div>
      <div className="tool-col">
        <Status tone="info">How this redaction works: every page you mark is turned into an image with the black boxes burned in, so the hidden text and pictures are really gone. Those pages are no longer selectable or searchable. Other pages are copied unchanged, and the document info is not carried over.</Status>
        {pdf && doc && (
          <>
            <SelectField label="Image quality of redacted pages" value={dpi} onChange={(v) => { setDpi(v); setOut(null); }} options={[['150', '150 DPI — smaller'], ['200', '200 DPI — default'], ['300', '300 DPI — sharp print']].map(([value, label]) => ({ value, label }))} />
            <CheckboxField label="Flatten every page (also removes hidden layers, links and form data from unmarked pages)" checked={flattenAll} onChange={(v) => { setFlattenAll(v); setOut(null); }} />
            <Button variant="primary" onClick={() => void apply()} disabled={busy || (!total && !flattenAll)}>
              {busy ? 'Working…' : 'Apply redactions'}
            </Button>
          </>
        )}
        {error && <Status tone="error">{error}</Status>}
        {out && pdf && (
          <>
            {out.verified && <Status tone={out.verified.startsWith('Checked') ? 'success' : 'error'}>{out.verified}</Status>}
            <Status tone="warn">Review every page of the result before sharing it. Text inside scanned images can only be removed if you box it.</Status>
            <DownloadBlobButton blob={pdfBlob(out.bytes)} filename={`${pdf.base}-redacted.pdf`} label={`Download redacted PDF (${formatBytes(out.bytes.length)})`} />
          </>
        )}
      </div>
    </div>
  );
}
