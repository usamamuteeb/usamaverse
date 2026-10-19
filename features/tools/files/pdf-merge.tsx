'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { FileDrop, nextId, OrderedFileList, type OrderedItem } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { MAX_PDF_BYTES, mergePdfs } from './pdf';
import { pdfBlob } from './usePdf';

interface Item extends OrderedItem { file: File }

export default function PdfMerge() {
  const [items, setItems] = useState<Item[]>([]);
  const [out, setOut] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = items.reduce((n, i) => n + i.size, 0);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <FileDrop
          multiple
          accept="application/pdf,.pdf"
          label="Add PDFs"
          onFiles={(fs) => {
            setOut(null);
            setItems((x) => [...x, ...fs.map((f) => ({ id: nextId(), name: f.name, size: f.size, file: f }))].slice(0, 100));
          }}
        />
        <OrderedFileList items={items} onChange={(x) => { setItems(x); setOut(null); }} label="PDFs in merge order" />
        <div className="actions">
          <Button
            variant="primary"
            disabled={items.length < 2 || busy}
            onClick={async () => {
              setError(null);
              setOut(null);
              if (total > MAX_PDF_BYTES) return setError(`Total size ${formatBytes(total)} is over the ${formatBytes(MAX_PDF_BYTES)} limit.`);
              setBusy(true);
              try {
                const files = await Promise.all(items.map(async (i) => ({ name: i.name, bytes: new Uint8Array(await i.file.arrayBuffer()) })));
                setOut(pdfBlob(await mergePdfs(files)));
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Merging…' : `Merge ${items.length || ''} PDFs`}
          </Button>
          {items.length > 0 && <Button variant="ghost" onClick={() => { setItems([]); setOut(null); }}>Reset</Button>}
        </div>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {out ? (
          <>
            <Status tone="success">Merged into one PDF ({formatBytes(out.size)}).</Status>
            <DownloadBlobButton blob={out} filename="merged.pdf" label="Download merged PDF" />
          </>
        ) : (
          <p className="empty-state">Add two or more PDFs, put them in order, then merge.</p>
        )}
        <p className="field-hint">Pages are copied as they are. Bookmarks, form fields and some interactive features may not carry over. Password-protected PDFs are not supported.</p>
      </div>
    </div>
  );
}
