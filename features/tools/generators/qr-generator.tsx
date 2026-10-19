'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { RangeField, SelectField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { useObjectUrl } from '@/components/tool-kit/files';
import { contrastRatio, parseColor } from '@/features/tools/color/logic';
import { encodeQr, qrToSvg, type Ecc } from './qr';

async function svgToPng(svg: string, px: number): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, px, px);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG export failed.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function QrGenerator() {
  const [text, setText] = useState('https://example.com');
  const [ecc, setEcc] = useState<Ecc>('M');
  const [size, setSize] = useState(512);
  const [dark, setDark] = useState('#000000');
  const [light, setLight] = useState('#ffffff');
  const [png, setPng] = useState<Blob | null>(null);
  const result = useMemo(() => {
    if (!text) return null;
    try {
      const qr = encodeQr(text, ecc);
      const d = parseColor(dark);
      const l = parseColor(light);
      if (!d || !l) throw new Error('Choose valid colors.');
      return { qr, svg: qrToSvg(qr, { quiet: 4, dark, light }), contrast: contrastRatio(d, l), err: null as string | null };
    } catch (e) {
      return { qr: null, svg: '', contrast: 0, err: e instanceof Error ? e.message : String(e) };
    }
  }, [text, ecc, dark, light]);
  const svgBlob = useMemo(() => (result?.svg ? new Blob([result.svg], { type: 'image/svg+xml' }) : null), [result]);
  const preview = useObjectUrl(svgBlob);
  useEffect(() => {
    let cancel = false;
    setPng(null);
    if (result?.svg) svgToPng(result.svg, size).then((b) => !cancel && setPng(b)).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [result, size]);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField label="Text or URL" value={text} onChange={setText} rows={4} mono={false} />
        <SelectField label="Error correction" value={ecc} onChange={(v) => setEcc(v as Ecc)} options={[{ value: 'L', label: 'L — ~7% damage, most capacity' }, { value: 'M', label: 'M — ~15% (default)' }, { value: 'Q', label: 'Q — ~25%' }, { value: 'H', label: 'H — ~30%, for logos or rough surfaces' }]} />
        <RangeField label="PNG size" value={size} min={128} max={2048} step={64} onChange={setSize} format={(v) => `${v} px`} />
        <div className="form-grid">
          <TextField type="color" label="Dark modules" value={dark} onChange={setDark} />
          <TextField type="color" label="Background" value={light} onChange={setLight} />
        </div>
        <Button variant="ghost" onClick={() => { setText(''); setDark('#000000'); setLight('#ffffff'); }}>Reset</Button>
      </div>
      <div className="tool-col">
        {result?.err && <Status tone="error">{result.err}</Status>}
        {result?.qr && preview && (
          <>
            <div className="qr-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={`QR code for: ${text.slice(0, 80)}`} />
            </div>
            <p className="summary">Version {result.qr.version} ({result.qr.size}×{result.qr.size} modules), {result.qr.mode} mode, mask {result.qr.mask}.</p>
            {result.contrast < 4 && <Status tone="warn">Low contrast between the colors ({result.contrast.toFixed(1)}:1); many scanners need dark modules on a light background.</Status>}
            <div className="actions">
              <DownloadBlobButton blob={png} filename="qr-code.png" label="Download PNG" />
              <DownloadBlobButton blob={svgBlob} filename="qr-code.svg" label="Download SVG" />
            </div>
            <p className="field-hint">Test the code with your phone before printing. It encodes exactly the text above — nothing is tracked or shortened.</p>
          </>
        )}
      </div>
    </div>
  );
}
