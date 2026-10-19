'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { CheckboxField, RangeField, Status } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { pdfBlob, useSinglePdf } from '@/features/tools/files/usePdf';
import { applyOverlays, readForm, type Overlay } from './ops';
import { ResultPreview, usePdfPreview } from './PageGrid';
import { PageNav, PageView, svgY } from './PageView';
import { SignaturePad, type SignatureImage } from './SignaturePad';

interface Placement {
  page: number; // 0-based
  x: number;
  y: number;
  width: number;
  height: number;
  date: boolean;
}

export default function SignPdf() {
  const { pdf, picker } = useSinglePdf();
  const { doc } = usePdfPreview(pdf?.bytes ?? null);
  const [sig, setSig] = useState<SignatureImage | null>(null);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(160);
  const [addDate, setAddDate] = useState(true);
  const [places, setPlaces] = useState<Placement[]>([]);
  const [signed, setSigned] = useState(false);
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onReady = useCallback((s: SignatureImage | null) => setSig((old) => {
    if (old && old !== s) URL.revokeObjectURL(old.url);
    return s;
  }), []);

  useEffect(() => {
    setPlaces([]);
    setOut(null);
    setPage(1);
    setSigned(false);
    if (pdf) readForm(pdf.bytes).then((r) => setSigned(r.signed)).catch(() => undefined);
  }, [pdf]);

  const today = new Date().toISOString().slice(0, 10);
  const h = sig ? (width * sig.height) / sig.width : 0;

  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && (
          <>
            <h2 className="h3">1. Create your signature</h2>
            <SignaturePad onReady={onReady} />
            {sig && (
              <div className="signature-sample">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sig.url} alt="Your signature" />
              </div>
            )}
          </>
        )}
      </div>
      <div className="tool-col">
        <Status tone="info">This adds a picture of your signature. It is not a certificate-based digital signature and does not prove identity.</Status>
        {signed && <Status tone="warn">This PDF already has a digital signature. Adding anything will invalidate it.</Status>}
        {pdf && doc && (
          <>
            <h2 className="h3">2. Click the page where it goes</h2>
            <RangeField label="Signature width" value={width} min={60} max={400} onChange={setWidth} format={(v) => `${v} pt`} />
            <CheckboxField label={`Add today’s date under it (${today})`} checked={addDate} onChange={setAddDate} />
            <PageNav page={page} count={doc.numPages} onChange={setPage} />
            <PageView
              doc={doc}
              pageNumber={page}
              label={`Page ${page}. Click to place the signature.`}
              cursor={sig ? 'copy' : 'not-allowed'}
              onPointerUp={(pt, m) => {
                if (!sig) return setError('Create a signature first.');
                setError(null);
                const x = Math.min(Math.max(0, pt.x - width / 2), m.widthPt - width);
                const y = Math.min(Math.max(0, pt.y - h / 2), m.heightPt - h);
                setPlaces((p) => [...p, { page: page - 1, x, y, width, height: h, date: addDate }]);
                setOut(null);
              }}
              onPointerDown={() => undefined}
              overlay={(m) =>
                places
                  .filter((p) => p.page === page - 1)
                  .map((p, i) => (
                    <g key={i}>
                      {sig && <image href={sig.url} x={p.x} y={svgY(m, p.y + p.height)} width={p.width} height={p.height} />}
                      <rect x={p.x} y={svgY(m, p.y + p.height)} width={p.width} height={p.height} fill="none" stroke="#f04459" strokeDasharray="4 3" />
                      {p.date && (
                        <text x={p.x} y={svgY(m, p.y - 12)} fontSize={10} fill="#000">
                          {today}
                        </text>
                      )}
                    </g>
                  ))
              }
            />
            <div className="actions">
              <Button variant="ghost" onClick={() => { setPlaces((p) => p.slice(0, -1)); setOut(null); }} disabled={!places.length}>
                Undo last
              </Button>
              <Button
                variant="primary"
                disabled={!places.length || !sig}
                onClick={async () => {
                  setError(null);
                  try {
                    const overlays: Overlay[] = [];
                    for (const p of places) {
                      overlays.push({ kind: 'image', page: p.page, x: p.x, y: p.y, width: p.width, height: p.height, data: sig!.png, mime: 'image/png' });
                      if (p.date) overlays.push({ kind: 'text', page: p.page, x: p.x, y: Math.max(2, p.y - 12), text: today, size: 10, color: '#000000', font: 'Helvetica' });
                    }
                    setOut(await applyOverlays(pdf.bytes, overlays));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                3. Sign and save
              </Button>
            </div>
            <p className="summary">{places.length} placement{places.length === 1 ? '' : 's'}.</p>
          </>
        )}
        {error && <Status tone="error">{error}</Status>}
        {out && pdf && (
          <>
            <ResultPreview bytes={out} page={(places[0]?.page ?? 0) + 1} />
            <DownloadBlobButton blob={pdfBlob(out)} filename={`${pdf.base}-signed.pdf`} label={`Download signed PDF (${formatBytes(out.length)})`} />
          </>
        )}
      </div>
    </div>
  );
}
