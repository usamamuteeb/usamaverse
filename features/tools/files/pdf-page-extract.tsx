'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { Status, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { copyPages, loadPdf, parsePageRanges } from './pdf';
import { pdfBlob, useSinglePdf } from './usePdf';

export default function PdfPageExtract() {
  const { pdf, picker } = useSinglePdf();
  const [spec, setSpec] = useState('1, 3-4');
  const [out, setOut] = useState<Blob | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && (
          <>
            <TextField label="Pages to keep (in this order)" value={spec} onChange={(v) => { setSpec(v); setOut(null); }} hint="Examples: 2-5 · 1, 3, 8- · last · 5-1 (reversed). Pages can repeat." />
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setError(null);
                setBusy(true);
                try {
                  const idx = parsePageRanges(spec, pdf.info.pageCount);
                  setOut(pdfBlob(await copyPages(await loadPdf(pdf.bytes), idx)));
                  setCount(idx.length);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Extract pages
            </Button>
          </>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {out ? (
          <>
            <Status tone="success">New PDF with {count} page{count === 1 ? '' : 's'} ({formatBytes(out.size)}).</Status>
            <DownloadBlobButton blob={out} filename={`${pdf?.base ?? 'document'}-extract.pdf`} label="Download PDF" />
          </>
        ) : (
          <p className="empty-state">The extracted PDF will appear here.</p>
        )}
      </div>
    </div>
  );
}
