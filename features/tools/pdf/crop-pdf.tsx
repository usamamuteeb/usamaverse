'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { NumberField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { pdfBlob, useSinglePdf } from '@/features/tools/files/usePdf';
import { cropPdf } from './ops';
import { ResultPreview } from './PageGrid';

const UNIT_PT: Record<string, number> = { mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pt: 1 };

export default function CropPdf() {
  const { pdf, picker } = useSinglePdf();
  const [unit, setUnit] = useState('mm');
  const [m, setM] = useState({ top: '10', right: '10', bottom: '10', left: '10' });
  const [pages, setPages] = useState('all');
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof m, v: string) => {
    setM((p) => ({ ...p, [k]: v }));
    setOut(null);
  };
  const first = pdf?.info.pageSizes[0];
  const vis = first ? (first.rotation % 180 === 0 ? first : { w: first.h, h: first.w }) : null;

  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && (
          <>
            {vis && <p className="field-hint">Page 1 is {(vis.w / UNIT_PT[unit]).toFixed(1)} × {(vis.h / UNIT_PT[unit]).toFixed(1)} {unit}.</p>}
            <div className="form-grid">
              <SelectField label="Units" value={unit} onChange={(v) => { setUnit(v); setOut(null); }} options={[{ value: 'mm', label: 'Millimetres' }, { value: 'cm', label: 'Centimetres' }, { value: 'in', label: 'Inches' }, { value: 'pt', label: 'Points (1/72 in)' }]} />
              <TextField label="Pages" value={pages} onChange={(v) => { setPages(v); setOut(null); }} hint="all, or e.g. 1-3" />
              <NumberField label="Trim top" suffix={unit} value={m.top} onChange={(v) => set('top', v)} />
              <NumberField label="Trim right" suffix={unit} value={m.right} onChange={(v) => set('right', v)} />
              <NumberField label="Trim bottom" suffix={unit} value={m.bottom} onChange={(v) => set('bottom', v)} />
              <NumberField label="Trim left" suffix={unit} value={m.left} onChange={(v) => set('left', v)} />
            </div>
            <Button
              variant="primary"
              onClick={async () => {
                setError(null);
                try {
                  const k = UNIT_PT[unit];
                  const n = (s: string) => {
                    const v = Number(s || 0);
                    if (!Number.isFinite(v) || v < 0) throw new Error('Margins must be zero or positive numbers.');
                    return v * k;
                  };
                  setOut(await cropPdf(pdf.bytes, { pages, top: n(m.top), right: n(m.right), bottom: n(m.bottom), left: n(m.left) }));
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Crop PDF
            </Button>
          </>
        )}
      </div>
      <div className="tool-col">
        <Status tone="warn">Cropping hides the edges of each page; it does not delete them. Hidden text and images stay in the file and can be recovered. To permanently remove content, use Redact PDF.</Status>
        {error && <Status tone="error">{error}</Status>}
        {out && pdf && (
          <>
            <ResultPreview bytes={out} />
            <DownloadBlobButton blob={pdfBlob(out)} filename={`${pdf.base}-cropped.pdf`} label={`Download PDF (${formatBytes(out.length)})`} />
          </>
        )}
      </div>
    </div>
  );
}
