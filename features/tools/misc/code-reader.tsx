'use client';

import { useEffect, useRef, useState } from 'react';
import { FileDrop } from '@/components/tool-kit/files';
import { Status } from '@/components/tool-kit/fields';
import { OutputPanel } from '@/components/tool-kit/output';

export default function CodeReader({ kind }: { kind: 'qr' | 'barcode' }) {
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState('');
  const [format, setFormat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return <div className="tool-grid">
    <div className="tool-col">
      <FileDrop accept="image/*,.svg" label={kind === 'qr' ? 'Open an image with a QR code' : 'Open an image with a barcode'} onFiles={async (files) => {
        const file = files[0];
        setError(''); setResult(''); setFormat('');
        if (file.size > 20 * 1024 * 1024) { setError('Choose an image under 20 MB.'); return; }
        if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
        const current = ++request.current;
        const url = URL.createObjectURL(file);
        setPreview(url); setBusy(true);
        try {
          const { BrowserQRCodeReader, BrowserMultiFormatOneDReader } = await import('@zxing/browser');
          const reader = kind === 'qr' ? new BrowserQRCodeReader() : new BrowserMultiFormatOneDReader();
          const decoded = await reader.decodeFromImageUrl(url);
          if (current === request.current) { setResult(decoded.getText()); setFormat(String(decoded.getBarcodeFormat())); }
        } catch (e) {
          if (current === request.current) setError(e instanceof Error && /NotFound|No MultiFormat|not found/i.test(e.name + e.message) ? 'No readable code found. Try a sharper image with the whole code visible.' : e instanceof Error ? e.message : String(e));
        } finally { if (current === request.current) setBusy(false); }
      }} />
      {preview && <div className="code-reader-preview"><img src={preview} alt="Selected code image" /></div>}
      <p className="field-hint">Images are decoded locally in your browser. Clear, straight, high-contrast images scan best.</p>
    </div>
    <div className="tool-col">
      {busy && <Status tone="info">Scanning image…</Status>}
      {error && <Status tone="error">{error}</Status>}
      {result && <><p className="summary">Detected format: {format}</p><OutputPanel label="Decoded content" value={result} rows={5} /></>}
    </div>
  </div>;
}
