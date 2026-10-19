'use client';

import { useMemo, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextAreaField } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { OutputPanel, ResultRows } from '@/components/tool-kit/output';
import { formatBytes } from '@/lib/format';
import { detectSignature } from '@/features/tools/files/logic';
import { base64ToBytes, bytesToBase64 } from './logic';

const MAX = 25 * 1024 * 1024;

export default function Base64File() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [encoded, setEncoded] = useState('');
  const [info, setInfo] = useState('');
  const [wrap, setWrap] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const decoded = useMemo(() => {
    if (mode !== 'decode' || !input.trim()) return null;
    try {
      const s = input.trim().replace(/^data:[^,]*;base64,/i, '');
      const bytes = base64ToBytes(s);
      const sig = detectSignature(bytes.subarray(0, 64));
      return { bytes, sig, err: null as string | null };
    } catch (e) {
      return { bytes: null, sig: null, err: e instanceof Error ? e.message : String(e) };
    }
  }, [mode, input]);
  const out = wrap ? encoded.replace(/(.{76})/g, '$1\n') : encoded;
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <SelectField label="Mode" value={mode} onChange={(v) => { setMode(v as 'encode'); setError(null); }} options={[{ value: 'encode', label: 'File → Base64' }, { value: 'decode', label: 'Base64 → file' }]} />
        {mode === 'encode' ? (
          <>
            <FileDrop
              onFiles={async ([f]) => {
                setError(null);
                if (f.size > MAX) return setError(`Up to ${formatBytes(MAX)} per file.`);
                setEncoded(bytesToBase64(new Uint8Array(await f.arrayBuffer())));
                setInfo(`${f.name} · ${formatBytes(f.size)}`);
              }}
            />
            <CheckboxField label="Wrap lines at 76 characters (MIME style)" checked={wrap} onChange={setWrap} />
          </>
        ) : (
          <TextAreaField label="Base64 (a data: prefix is allowed)" value={input} onChange={setInput} rows={10} />
        )}
        <Button variant="ghost" onClick={() => { setEncoded(''); setInput(''); setError(null); }}>Reset</Button>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {mode === 'encode' && encoded && (
          <>
            <p className="summary">{info} → {formatBytes(encoded.length)} of Base64 text.</p>
            <OutputPanel label="Base64" value={out} filename="encoded.txt" rows={10} />
          </>
        )}
        {mode === 'decode' && decoded?.err && <Status tone="error">{decoded.err}</Status>}
        {mode === 'decode' && decoded?.bytes && (
          <>
            <ResultRows rows={[{ label: 'Decoded size', value: formatBytes(decoded.bytes.length), emphasis: true }, { label: 'Detected type', value: decoded.sig ? `${decoded.sig.label} (${decoded.sig.mime})` : 'Unknown / plain data' }]} />
            <DownloadBlobButton blob={new Blob([decoded.bytes as BlobPart], { type: decoded.sig?.mime ?? 'application/octet-stream' })} filename={`decoded.${decoded.sig?.extensions[0] || 'bin'}`} label="Download file" />
          </>
        )}
      </div>
    </div>
  );
}
