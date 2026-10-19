'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { splitPdf } from './pdf';
import { pdfBlob, useSinglePdf } from './usePdf';
import { createZip } from './zip';

export default function PdfSplit() {
  const { pdf, picker } = useSinglePdf();
  const [mode, setMode] = useState<'each' | 'ranges' | 'every'>('ranges');
  const [every, setEvery] = useState('2');
  const [spec, setSpec] = useState('1-3; 4-');
  const [zip, setZip] = useState<Blob | null>(null);
  const [parts, setParts] = useState<Array<{ name: string; blob: Blob }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && (
          <>
            <SelectField label="Split" value={mode} onChange={(v) => { setMode(v as 'each'); setZip(null); setParts([]); }} options={[{ value: 'ranges', label: 'Into groups of pages I choose' }, { value: 'every', label: 'Every N pages' }, { value: 'each', label: 'Every page into its own PDF' }]} />
            {mode === 'every' && <TextField label="Pages per file" value={every} onChange={(v) => { setEvery(v); setZip(null); setParts([]); }} />}
            {mode === 'ranges' && <TextField label="Groups (separate with ;)" value={spec} onChange={(v) => { setSpec(v); setZip(null); setParts([]); }} hint="Example: 1-3; 4-6; 7- creates three files. Use “last” for the final page." />}
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const files = await splitPdf(pdf.bytes, mode, mode === 'every' ? every : spec, pdf.base);
                  setParts(files.map((f) => ({ name: f.name, blob: pdfBlob(f.bytes) })));
                  setZip(new Blob([(await createZip(files.map((f) => ({ name: f.name, data: f.bytes })), { compress: false })).bytes as BlobPart], { type: 'application/zip' }));
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Splitting…' : 'Split PDF'}
            </Button>
          </>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {zip ? (
          <>
            <Status tone="success">{parts.length} files created.</Status>
            <DownloadBlobButton blob={zip} filename={`${pdf?.base ?? 'split'}-parts.zip`} label={`Download all as ZIP (${formatBytes(zip.size)})`} />
            <ul className="file-list">
              {parts.slice(0, 50).map((p) => (
                <li key={p.name}><span className="file-name">{p.name}</span><span className="muted">{formatBytes(p.blob.size)}</span><DownloadBlobButton blob={p.blob} filename={p.name} label="Download" /></li>
              ))}
            </ul>
          </>
        ) : (
          <p className="empty-state">Choose a PDF and how to split it.</p>
        )}
      </div>
    </div>
  );
}
