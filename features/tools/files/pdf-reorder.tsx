'use client';

import { useEffect, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { copyPages, loadPdf } from './pdf';
import { pdfBlob, useSinglePdf } from './usePdf';

export default function PdfReorder() {
  const { pdf, picker } = useSinglePdf();
  const [order, setOrder] = useState<number[]>([]);
  const [out, setOut] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setOrder(pdf ? Array.from({ length: pdf.info.pageCount }, (_, i) => i) : []);
    setOut(null);
  }, [pdf]);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const a = order.slice();
    [a[i], a[j]] = [a[j], a[i]];
    setOrder(a);
    setOut(null);
  };
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && pdf.info.pageCount > 300 && <Status tone="info">Large document: use the Page Extractor with a range like “10-20, 1-9, 21-” instead.</Status>}
        {pdf && pdf.info.pageCount <= 300 && (
          <>
            <ol className="file-list" aria-label="Page order">
              {order.map((p, i) => (
                <li key={`${p}-${i}`}>
                  <span className="file-name">Page {p + 1}</span>
                  <span className="muted">{Math.round(pdf.info.pageSizes[p].w)} × {Math.round(pdf.info.pageSizes[p].h)} pt</span>
                  <span className="actions tight">
                    <Button variant="ghost" ariaLabel={`Move page ${p + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                    <Button variant="ghost" ariaLabel={`Move page ${p + 1} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>↓</Button>
                    <Button variant="ghost" ariaLabel={`Move page ${p + 1} to the top`} disabled={i === 0} onClick={() => { setOrder([p, ...order.filter((_, k) => k !== i)]); setOut(null); }}>⤒</Button>
                    <Button variant="ghost" ariaLabel={`Delete page ${p + 1}`} disabled={order.length <= 1} onClick={() => { setOrder(order.filter((_, k) => k !== i)); setOut(null); }}>✕</Button>
                  </span>
                </li>
              ))}
            </ol>
            <div className="actions">
              <Button
                variant="primary"
                onClick={async () => {
                  setError(null);
                  try {
                    setOut(pdfBlob(await copyPages(await loadPdf(pdf.bytes), order)));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Save new order
              </Button>
              <Button variant="ghost" onClick={() => { setOrder(order.slice().reverse()); setOut(null); }}>Reverse</Button>
              <Button variant="ghost" onClick={() => { setOrder(Array.from({ length: pdf.info.pageCount }, (_, i) => i)); setOut(null); }}>Reset order</Button>
            </div>
          </>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {out ? <DownloadBlobButton blob={out} filename={`${pdf?.base ?? 'document'}-reordered.pdf`} label="Download PDF" /> : <p className="empty-state">Reorder or delete pages, then save.</p>}
        <p className="field-hint">Pages are listed by number and size; thumbnails aren’t rendered so the tool stays fast and private.</p>
      </div>
    </div>
  );
}
