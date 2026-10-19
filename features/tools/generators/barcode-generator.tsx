'use client';

import { useEffect, useMemo, useState } from 'react';
import { DownloadBlobButton } from '@/components/tool-kit/actions';
import { CheckboxField, RangeField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { useObjectUrl } from '@/components/tool-kit/files';
import { barcodeSvg, bitsToWidths, code128Widths, eanBits, normalizeEan } from './barcode';

type Kind = 'code128' | 'ean13' | 'upca';

async function svgToPng(svg: string, scale: number): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth * scale;
    c.height = img.naturalHeight * scale;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG export failed.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function BarcodeGenerator() {
  const [kind, setKind] = useState<Kind>('code128');
  const [value, setValue] = useState('USAMA-2026');
  const [module, setModule] = useState(2);
  const [height, setHeight] = useState(80);
  const [showText, setShowText] = useState(true);
  const [png, setPng] = useState<Blob | null>(null);
  const result = useMemo(() => {
    try {
      let widths: number[];
      let label = value;
      if (kind === 'code128') widths = code128Widths(value);
      else {
        const full = normalizeEan(value, kind);
        widths = bitsToWidths(eanBits(full));
        label = kind === 'upca' ? full.slice(1) : full;
      }
      const quiet = kind === 'code128' ? 10 : 11;
      return { svg: barcodeSvg(widths, { moduleWidth: module, height, quiet, text: label, showText }), label, err: null as string | null };
    } catch (e) {
      return { svg: '', label: '', err: e instanceof Error ? e.message : String(e) };
    }
  }, [kind, value, module, height, showText]);
  const svgBlob = useMemo(() => (result.svg ? new Blob([result.svg], { type: 'image/svg+xml' }) : null), [result]);
  const url = useObjectUrl(svgBlob);
  useEffect(() => {
    let cancel = false;
    setPng(null);
    if (result.svg) svgToPng(result.svg, 2).then((b) => !cancel && setPng(b)).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [result]);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <SelectField label="Type" value={kind} onChange={(v) => { setKind(v as Kind); setValue(v === 'code128' ? 'USAMA-2026' : v === 'ean13' ? '590123412345' : '03600029145'); }} options={[{ value: 'code128', label: 'Code 128 (letters, digits, symbols)' }, { value: 'ean13', label: 'EAN-13 (retail, 12–13 digits)' }, { value: 'upca', label: 'UPC-A (retail, 11–12 digits)' }]} />
        <TextField label={kind === 'code128' ? 'Content (printable ASCII)' : 'Digits (check digit added or verified)'} value={value} onChange={setValue} />
        <RangeField label="Bar width" value={module} min={1} max={5} onChange={setModule} format={(v) => `${v} px per module`} />
        <RangeField label="Height" value={height} min={30} max={200} onChange={setHeight} format={(v) => `${v} px`} />
        <CheckboxField label="Show text below" checked={showText} onChange={setShowText} />
      </div>
      <div className="tool-col">
        {result.err && <Status tone="error">{result.err}</Status>}
        {url && !result.err && (
          <>
            <div className="qr-preview barcode-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Barcode for ${result.label}`} />
            </div>
            <div className="actions">
              <DownloadBlobButton blob={png} filename={`barcode-${kind}.png`} label="Download PNG" />
              <DownloadBlobButton blob={svgBlob} filename={`barcode-${kind}.svg`} label="Download SVG" />
            </div>
            <p className="field-hint">Retail EAN/UPC numbers must be issued by GS1 for real products; generating a barcode doesn’t register a number. Test-scan before printing.</p>
          </>
        )}
      </div>
    </div>
  );
}
