'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { NumberField, RangeField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { detectSignature } from '@/features/tools/files/logic';
import { pdfBlob, useSinglePdf } from '@/features/tools/files/usePdf';
import { addImageWatermark, addTextWatermark, type Anchor } from './ops';
import { ResultPreview } from './PageGrid';
import { ANCHORS, FONTS } from './choices';
import type { FontChoice } from './ops';

const LAYOUTS = [{ value: 'center', label: 'Centre' }, { value: 'tile', label: 'Tiled across the page' }, ...ANCHORS];

export default function PdfWatermark() {
  const { pdf, picker } = useSinglePdf();
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('CONFIDENTIAL');
  const [size, setSize] = useState('48');
  const [color, setColor] = useState('#c6283d');
  const [opacity, setOpacity] = useState(25);
  const [angle, setAngle] = useState(45);
  const [layout, setLayout] = useState('center');
  const [font, setFont] = useState<FontChoice>('HelveticaBold');
  const [pages, setPages] = useState('all');
  const [img, setImg] = useState<{ data: Uint8Array; mime: 'image/png' | 'image/jpeg'; name: string } | null>(null);
  const [widthPct, setWidthPct] = useState(30);
  const [anchor, setAnchor] = useState<Anchor>('center');
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
            <SelectField label="Watermark type" value={mode} onChange={(v) => { setMode(v as 'text'); stale(); }} options={[{ value: 'text', label: 'Text' }, { value: 'image', label: 'Image (PNG or JPEG)' }]} />
            <TextField label="Pages" value={pages} onChange={(v) => { setPages(v); stale(); }} hint="all, or e.g. 1-3, 5" />
            {mode === 'text' ? (
              <>
                <TextField label="Text" value={text} onChange={(v) => { setText(v); stale(); }} />
                <div className="form-grid">
                  <NumberField label="Font size" suffix="pt" value={size} onChange={(v) => { setSize(v); stale(); }} />
                  <SelectField label="Font" value={font} onChange={(v) => { setFont(v as FontChoice); stale(); }} options={FONTS} />
                  <SelectField label="Placement" value={layout} onChange={(v) => { setLayout(v); stale(); }} options={LAYOUTS} />
                  <TextField type="color" label="Color" value={color} onChange={(v) => { setColor(v); stale(); }} />
                </div>
                <RangeField label="Angle" value={angle} min={-90} max={90} onChange={(v) => { setAngle(v); stale(); }} format={(v) => `${v}°`} />
              </>
            ) : (
              <>
                <FileDrop
                  accept="image/png,image/jpeg"
                  label="Choose watermark image"
                  onFiles={async ([f]) => {
                    setError(null);
                    const data = new Uint8Array(await f.arrayBuffer());
                    const sig = detectSignature(data.subarray(0, 32));
                    if (!sig || !['image/png', 'image/jpeg'].includes(sig.mime)) return setError('Choose a PNG or JPEG image (PNG keeps transparency).');
                    setImg({ data, mime: sig.mime as 'image/png', name: f.name });
                    stale();
                  }}
                />
                {img && <p className="summary">{img.name}</p>}
                <div className="form-grid">
                  <SelectField label="Placement" value={anchor} onChange={(v) => { setAnchor(v as Anchor); stale(); }} options={[{ value: 'center', label: 'Centre' }, ...ANCHORS]} />
                </div>
                <RangeField label="Width" value={widthPct} min={5} max={100} onChange={(v) => { setWidthPct(v); stale(); }} format={(v) => `${v}% of page width`} />
              </>
            )}
            <RangeField label="Opacity" value={opacity} min={5} max={100} onChange={(v) => { setOpacity(v); stale(); }} format={(v) => `${v}%`} />
            <Button
              variant="primary"
              disabled={busy || (mode === 'image' && !img)}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  setOut(
                    mode === 'text'
                      ? await addTextWatermark(pdf.bytes, { text, pages, fontSize: Number(size), color, opacity: opacity / 100, angle, layout: layout as 'center', font })
                      : await addImageWatermark(pdf.bytes, { image: img!.data, mime: img!.mime, pages, widthFraction: widthPct / 100, opacity: opacity / 100, anchor, margin: 24 }),
                  );
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Adding…' : 'Add watermark'}
            </Button>
          </>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {!out && !error && <p className="empty-state">A watermark is a visible mark drawn over the page. It does not protect or encrypt the PDF and can be removed with editing software.</p>}
        {out && pdf && (
          <>
            <ResultPreview bytes={out} />
            <DownloadBlobButton blob={pdfBlob(out)} filename={`${pdf.base}-watermarked.pdf`} label={`Download PDF (${formatBytes(out.length)})`} />
          </>
        )}
      </div>
    </div>
  );
}
