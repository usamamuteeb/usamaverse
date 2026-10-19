'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { CheckboxField, NumberField, RangeField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { pdfBlob, useSinglePdf } from '@/features/tools/files/usePdf';
import { addPageNumbers, type Anchor, type FontChoice, type NumberFormat } from './ops';
import { ANCHORS, FONTS } from './choices';
import { ResultPreview } from './PageGrid';

export default function PdfPageNumbers() {
  const { pdf, picker } = useSinglePdf();
  const [pages, setPages] = useState('all');
  const [start, setStart] = useState('1');
  const [format, setFormat] = useState<NumberFormat>('n');
  const [anchor, setAnchor] = useState<Anchor>('bottom-center');
  const [margin, setMargin] = useState('28');
  const [size, setSize] = useState('11');
  const [color, setColor] = useState('#000000');
  const [opacity, setOpacity] = useState(100);
  const [font, setFont] = useState<FontChoice>('Helvetica');
  const [facing, setFacing] = useState(false);
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stale = () => setOut(null);

  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && (
          <>
            <div className="form-grid">
              <TextField label="Pages to number" value={pages} onChange={(v) => { setPages(v); stale(); }} hint="all, or e.g. 2-last to skip a cover" />
              <NumberField label="First number" value={start} onChange={(v) => { setStart(v); stale(); }} />
              <SelectField label="Format" value={format} onChange={(v) => { setFormat(v as NumberFormat); stale(); }} options={[{ value: 'n', label: '1' }, { value: 'page-n', label: 'Page 1' }, { value: 'n-of-total', label: '1 / N' }, { value: 'page-n-of-total', label: 'Page 1 of N' }, { value: 'dash-n', label: '– 1 –' }]} hint="N is the last number printed." />
              <SelectField label="Position" value={anchor} onChange={(v) => { setAnchor(v as Anchor); stale(); }} options={ANCHORS} />
              <NumberField label="Distance from edge" suffix="pt" value={margin} onChange={(v) => { setMargin(v); stale(); }} hint="72 pt = 1 inch" />
              <NumberField label="Font size" suffix="pt" value={size} onChange={(v) => { setSize(v); stale(); }} />
              <SelectField label="Font" value={font} onChange={(v) => { setFont(v as FontChoice); stale(); }} options={FONTS} />
              <TextField type="color" label="Color" value={color} onChange={(v) => { setColor(v); stale(); }} />
            </div>
            <RangeField label="Opacity" value={opacity} min={10} max={100} onChange={(v) => { setOpacity(v); stale(); }} format={(v) => `${v}%`} />
            <CheckboxField label="Facing pages: mirror left/right positions on even numbers" checked={facing} onChange={(v) => { setFacing(v); stale(); }} />
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  setOut(await addPageNumbers(pdf.bytes, { pages, startAt: Number(start), format, anchor, margin: Number(margin), fontSize: Number(size), color, opacity: opacity / 100, font, facing }));
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Numbering…' : 'Add page numbers'}
            </Button>
          </>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {!out && !error && <p className="empty-state">Numbers are drawn on top of each page. Standard PDF fonts support Latin characters.</p>}
        {out && pdf && (
          <>
            <ResultPreview bytes={out} page={pages.trim() === 'all' ? 1 : 2} />
            <DownloadBlobButton blob={pdfBlob(out)} filename={`${pdf.base}-numbered.pdf`} label={`Download PDF (${formatBytes(out.length)})`} />
          </>
        )}
      </div>
    </div>
  );
}
