'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { rotatePdf } from './pdf';
import { pdfBlob, useSinglePdf } from './usePdf';

export default function PdfRotate() {
  const { pdf, picker } = useSinglePdf();
  const [spec, setSpec] = useState('all');
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [out, setOut] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && (
          <>
            <TextField label="Pages to rotate" value={spec} onChange={(v) => { setSpec(v); setOut(null); }} hint="“all”, or e.g. 1, 3-5, last." />
            <SelectField label="Rotate by" value={String(angle)} onChange={(v) => { setAngle(Number(v) as 90); setOut(null); }} options={[{ value: '90', label: '90° clockwise' }, { value: '180', label: '180°' }, { value: '270', label: '90° counter-clockwise' }]} />
            <Button
              variant="primary"
              onClick={async () => {
                setError(null);
                try {
                  setOut(pdfBlob(await rotatePdf(pdf.bytes, spec, angle)));
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Rotate
            </Button>
          </>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {out ? (
          <>
            <Status tone="success">Rotation applied (added to any existing page rotation).</Status>
            <DownloadBlobButton blob={out} filename={`${pdf?.base ?? 'document'}-rotated.pdf`} label="Download PDF" />
          </>
        ) : (
          <p className="empty-state">The rotated PDF will appear here.</p>
        )}
        <p className="field-hint">Sets each page’s rotation flag; content isn’t re-rendered, so quality is unchanged.</p>
      </div>
    </div>
  );
}
