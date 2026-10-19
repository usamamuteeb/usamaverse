'use client';

import { useEffect, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { CheckboxField, Status, TextField } from '@/components/tool-kit/fields';
import { ResultRows } from '@/components/tool-kit/output';
import { writeInfo } from './pdf';
import { pdfBlob, useSinglePdf } from './usePdf';

const FIELDS = ['title', 'author', 'subject', 'keywords', 'creator', 'producer'] as const;
type Meta = Record<(typeof FIELDS)[number], string>;

export default function PdfMetadata() {
  const { pdf, picker } = useSinglePdf();
  const [meta, setMeta] = useState<Meta>({ title: '', author: '', subject: '', keywords: '', creator: '', producer: '' });
  const [updateModified, setUpdateModified] = useState(true);
  const [out, setOut] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (pdf) setMeta({ title: pdf.info.title, author: pdf.info.author, subject: pdf.info.subject, keywords: pdf.info.keywords.replace(/\s+/g, ', '), creator: pdf.info.creator, producer: pdf.info.producer });
    setOut(null);
  }, [pdf]);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && (
          <>
            <ResultRows rows={[{ label: 'Created', value: pdf.info.creationDate || '—' }, { label: 'Modified', value: pdf.info.modificationDate || '—' }, { label: 'Pages', value: String(pdf.info.pageCount) }]} />
            {FIELDS.map((f) => (
              <TextField key={f} label={f[0].toUpperCase() + f.slice(1)} value={meta[f]} onChange={(v) => { setMeta((m) => ({ ...m, [f]: v })); setOut(null); }} hint={f === 'keywords' ? 'Comma-separated.' : undefined} />
            ))}
            <CheckboxField label="Set “modified” date to now" checked={updateModified} onChange={setUpdateModified} />
            <div className="actions">
              <Button
                variant="primary"
                onClick={async () => {
                  setError(null);
                  try {
                    setOut(pdfBlob(await writeInfo(pdf.bytes, { ...meta, updateModified })));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Save metadata
              </Button>
              <Button variant="ghost" onClick={() => setMeta({ title: '', author: '', subject: '', keywords: '', creator: '', producer: '' })}>Clear all fields</Button>
            </div>
          </>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {out ? <DownloadBlobButton blob={out} filename={`${pdf?.base ?? 'document'}.pdf`} label="Download updated PDF" /> : <p className="empty-state">Edit the document properties, then save.</p>}
        <p className="field-hint">Edits the document information dictionary. Some PDFs also carry XMP metadata, which this tool leaves unchanged.</p>
      </div>
    </div>
  );
}
