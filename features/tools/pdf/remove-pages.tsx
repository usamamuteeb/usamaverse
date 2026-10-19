'use client';

import { useEffect, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { LiveRegion, Status, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { parsePageRanges } from '@/features/tools/files/pdf';
import { pdfBlob, useSinglePdf } from '@/features/tools/files/usePdf';
import { removePages } from './ops';
import { PageGrid, initialPages, usePdfPreview } from './PageGrid';

export default function RemovePages() {
  const { pdf, picker } = useSinglePdf();
  const { doc, error: previewError } = usePdfPreview(pdf?.bytes ?? null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [spec, setSpec] = useState('');
  const [out, setOut] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSelected(new Set());
    setOut(null);
    setSpec('');
  }, [pdf]);
  const pages = pdf ? initialPages(pdf.info.pageCount) : [];
  const toggle = (id: string) => {
    setOut(null);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const sorted = [...selected].map((id) => Number(id.slice(1))).sort((a, b) => a - b);

  return (
    <div className="stack">
      {picker}
      {previewError && <Status tone="error">{previewError}</Status>}
      {pdf && doc && (
        <>
          <div className="form-grid">
            <TextField label="Or type pages to remove" value={spec} onChange={setSpec} placeholder="2, 5-7, last" hint="Then press “Select these”." />
          </div>
          <div className="actions">
            <Button
              onClick={() => {
                setError(null);
                try {
                  setSelected(new Set(parsePageRanges(spec, pdf.info.pageCount).map((i) => `p${i}`)));
                  setOut(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
              disabled={!spec.trim()}
            >
              Select these
            </Button>
            <Button variant="ghost" onClick={() => { setSelected(new Set()); setOut(null); }} disabled={!selected.size}>
              Clear selection
            </Button>
          </div>
          <p className="summary" role="status">
            {selected.size ? `${selected.size} page${selected.size === 1 ? '' : 's'} marked for removal: ${sorted.map((i) => i + 1).join(', ')}.` : 'Press pages to mark them for removal.'}
          </p>
          <PageGrid doc={doc} pages={pages} selected={selected} onToggle={toggle} selectedLabel="Remove" />
          <LiveRegion>{`${selected.size} selected`}</LiveRegion>
          <div className="actions">
            <Button
              variant="primary"
              disabled={busy || !selected.size}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  setOut(pdfBlob(await removePages(pdf.bytes, sorted)));
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Removing…' : `Remove ${selected.size || ''} page${selected.size === 1 ? '' : 's'}`}
            </Button>
            {out && <DownloadBlobButton blob={out} filename={`${pdf.base}-pages-removed.pdf`} label={`Download PDF (${formatBytes(out.size)})`} />}
          </div>
          {error && <Status tone="error">{error}</Status>}
          {out && <Status tone="success">{pdf.info.pageCount - selected.size} pages kept. Removing a page deletes it from this copy only; your original file is unchanged.</Status>}
        </>
      )}
    </div>
  );
}
