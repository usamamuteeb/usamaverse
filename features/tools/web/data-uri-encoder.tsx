'use client';

import { useMemo, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { OutputPanel, ResultRows } from '@/components/tool-kit/output';
import { formatBytes } from '@/lib/format';
import { bytesToBase64 } from '@/features/tools/developer/logic';
import { detectSignature } from '@/features/tools/files/logic';
import { MIME_TYPES, parseDataUri, textToDataUri } from './more';

const MAX = 10 * 1024 * 1024;

export default function DataUriEncoder() {
  const [mode, setMode] = useState<'text' | 'file' | 'decode'>('text');
  const [text, setText] = useState('');
  const [mime, setMime] = useState('text/plain');
  const [b64, setB64] = useState(true);
  const [fileUri, setFileUri] = useState('');
  const [fileInfo, setFileInfo] = useState('');
  const [uri, setUri] = useState('');
  const [error, setError] = useState<string | null>(null);

  let out = '';
  let outErr: string | null = null;
  if (mode === 'text' && text) {
    try {
      out = textToDataUri(text, mime, b64);
    } catch (e) {
      outErr = e instanceof Error ? e.message : String(e);
    }
  }
  const decoded = useMemo(() => {
    if (mode !== 'decode' || !uri.trim()) return null;
    try {
      const d = parseDataUri(uri);
      const sig = detectSignature(d.bytes.subarray(0, 64));
      const ext = MIME_TYPES.find(([, m]) => m === (sig?.mime ?? d.mime))?.[0] ?? 'bin';
      return { ...d, sig, ext, blob: new Blob([d.bytes as BlobPart], { type: d.mime }), err: null as string | null };
    } catch (e) {
      return { err: e instanceof Error ? e.message : String(e) } as { err: string };
    }
  }, [mode, uri]);

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <SelectField label="Mode" value={mode} onChange={(v) => { setMode(v as 'text'); setError(null); }} options={[{ value: 'text', label: 'Text → data URI' }, { value: 'file', label: 'File → data URI' }, { value: 'decode', label: 'Decode a data URI' }]} />
        {mode === 'text' && (
          <>
            <TextAreaField label="Text" value={text} onChange={setText} rows={6} />
            <TextField label="MIME type" value={mime} onChange={setMime} />
            <CheckboxField label="Base64 encode (otherwise percent-encode)" checked={b64} onChange={setB64} />
          </>
        )}
        {mode === 'file' && (
          <FileDrop
            onFiles={async ([f]) => {
              setError(null);
              setFileUri('');
              if (f.size > MAX) return setError(`Files up to ${formatBytes(MAX)} only; data URIs get large quickly.`);
              const bytes = new Uint8Array(await f.arrayBuffer());
              const sig = detectSignature(bytes.subarray(0, 64));
              const type = sig?.mime ?? (f.type || 'application/octet-stream');
              setFileUri(`data:${type};base64,${bytesToBase64(bytes)}`);
              setFileInfo(`${f.name} · ${type} · ${formatBytes(f.size)}`);
            }}
          />
        )}
        {mode === 'decode' && <TextAreaField label="Data URI" value={uri} onChange={setUri} rows={8} placeholder="data:image/png;base64,iVBORw0…" />}
        <Button variant="ghost" onClick={() => { setText(''); setUri(''); setFileUri(''); setError(null); }}>Reset</Button>
      </div>
      <div className="tool-col">
        {(error || outErr) && <Status tone="error">{error || outErr}</Status>}
        {mode === 'text' && <OutputPanel label="Data URI" value={out} rows={8} />}
        {mode === 'file' && fileUri && (
          <>
            <p className="summary">{fileInfo} → {formatBytes(fileUri.length)} as text (Base64 adds about 33%).</p>
            <OutputPanel label="Data URI" value={fileUri} rows={8} />
          </>
        )}
        {decoded && 'err' in decoded && decoded.err && <Status tone="error">{decoded.err}</Status>}
        {decoded && !decoded.err && 'bytes' in decoded && (
          <>
            <ResultRows rows={[{ label: 'Declared type', value: decoded.mime }, { label: 'Detected content', value: decoded.sig ? `${decoded.sig.label} (${decoded.sig.mime})` : 'No binary signature (text or unknown)' }, { label: 'Encoding', value: decoded.base64 ? 'Base64' : 'Percent-encoded' }, { label: 'Size', value: formatBytes(decoded.bytes.length) }]} />
            {decoded.sig && decoded.sig.mime !== decoded.mime && <Status tone="warn">The declared type and the actual content differ.</Status>}
            <div className="actions"><DownloadBlobButton blob={decoded.blob} filename={`decoded.${decoded.ext}`} label="Download file" /></div>
          </>
        )}
      </div>
    </div>
  );
}
