'use client';

import { useEffect, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { LiveRegion, Status } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { pdfBlob, useSinglePdf } from '@/features/tools/files/usePdf';
import { buildFromPlan } from './ops';
import { PageGrid, initialPages, usePdfPreview, type GridPage } from './PageGrid';

export default function OrganizePdf() {
  const { pdf, picker } = useSinglePdf();
  const { doc, error: previewError } = usePdfPreview(pdf?.bytes ?? null);
  const [pages, setPages] = useState<GridPage[]>([]);
  const [history, setHistory] = useState<GridPage[][]>([]);
  const [msg, setMsg] = useState('');
  const [out, setOut] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPages(pdf ? initialPages(pdf.info.pageCount) : []);
    setHistory([]);
    setOut(null);
  }, [pdf]);

  const change = (next: GridPage[], announcement: string) => {
    setHistory((h) => [...h.slice(-49), pages]);
    setPages(next);
    setMsg(announcement);
    setOut(null);
  };

  return (
    <div className="stack">
      {picker}
      {previewError && <Status tone="error">{previewError}</Status>}
      {pdf && doc && (
        <>
          <div className="actions">
            <Button onClick={() => change(pages.map((p) => ({ ...p, rotate: (p.rotate + 90) % 360 })), 'All pages rotated right.')}>⟳ Rotate all</Button>
            <Button onClick={() => change(pages.slice().reverse(), 'Page order reversed.')}>Reverse order</Button>
            <Button variant="ghost" disabled={!history.length} onClick={() => { setPages(history[history.length - 1]); setHistory((h) => h.slice(0, -1)); setMsg('Undone.'); setOut(null); }}>
              Undo
            </Button>
            <Button variant="ghost" onClick={() => change(initialPages(pdf.info.pageCount), 'Reset to the original pages.')}>Reset</Button>
          </div>
          <p className="field-hint">Use the arrows (or drag) to reorder, ⟲ ⟳ to rotate and ✕ to delete. {pages.length} of {pdf.info.pageCount} pages kept.</p>
          <PageGrid doc={doc} pages={pages} onChange={change} allowReorder allowRotate allowDelete />
          <LiveRegion>{msg}</LiveRegion>
          <div className="actions">
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  setOut(pdfBlob(await buildFromPlan(pdf.bytes, pages.map((p) => ({ src: p.src, rotate: p.rotate })))));
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Saving…' : 'Save organized PDF'}
            </Button>
            {out && <DownloadBlobButton blob={out} filename={`${pdf.base}-organized.pdf`} label={`Download PDF (${formatBytes(out.size)})`} />}
          </div>
          {error && <Status tone="error">{error}</Status>}
          {out && <Status tone="success">Saved {pages.length} pages. Links, bookmarks and form fields may not survive reorganising.</Status>}
        </>
      )}
      {pdf && !doc && !previewError && <p className="summary">Rendering page previews…</p>}
    </div>
  );
}
