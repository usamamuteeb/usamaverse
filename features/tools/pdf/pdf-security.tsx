'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { MAX_PDF_BYTES } from '@/features/tools/files/pdf';
import { pdfBlob } from '@/features/tools/files/usePdf';
import { protectPdf, unlockPdf } from './content-edit';
import { ResultPreview } from './PageGrid';

export default function PdfSecurity({ mode }: { mode: 'protect' | 'unlock' }) {
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isProtect = mode === 'protect';

  const run = async () => {
    if (!file) return;
    if (isProtect && password !== confirm) return setError('The passwords do not match.');
    setBusy(true); setError(null); setOut(null);
    try { setOut(isProtect ? await protectPdf(file.bytes, password) : await unlockPdf(file.bytes, password)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return <div className="tool-grid">
    <div className="tool-col">
      <FileDrop accept="application/pdf,.pdf" label={isProtect ? 'Choose PDF to protect' : 'Choose password-protected PDF'} onFiles={async ([selected]) => {
        setOut(null); setError(null);
        if (selected.size > MAX_PDF_BYTES) return setError(`This PDF is ${formatBytes(selected.size)}; the limit is ${formatBytes(MAX_PDF_BYTES)}.`);
        setFile({ name: selected.name, bytes: new Uint8Array(await selected.arrayBuffer()) });
      }} />
      {file && <p className="summary">{file.name} — {formatBytes(file.bytes.length)}</p>}
      <div className="field">
        <label className="field-label" htmlFor="pdf-security-password">{isProtect ? 'New open password' : 'Current PDF password'}</label>
        <input id="pdf-security-password" className="input" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isProtect ? 'new-password' : 'current-password'} />
      </div>
      {isProtect && <div className="field">
        <label className="field-label" htmlFor="pdf-security-confirm">Confirm password</label>
        <input id="pdf-security-confirm" className="input" type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </div>}
      <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password</label>
      <Button disabled={!file || !password || busy} onClick={() => void run()}>{busy ? 'Working…' : isProtect ? 'Protect PDF' : 'Unlock PDF'}</Button>
      {isProtect && <Status tone="info">Keep the password safe. The file is processed in this browser and cannot be recovered here if you forget it.</Status>}
    </div>
    <div className="tool-col">
      {error && <Status tone="error">{error}</Status>}
      {out && file && <>
        <Status tone="success">{isProtect ? 'Password-protected copy created.' : 'Unlocked copy created.'}</Status>
        {!isProtect && <ResultPreview bytes={out} />}
        <DownloadBlobButton blob={pdfBlob(out)} filename={`${file.name.replace(/\.pdf$/i, '')}-${isProtect ? 'protected' : 'unlocked'}.pdf`} label={`Download PDF (${formatBytes(out.length)})`} />
      </>}
      {!out && !error && <p className="empty-state">{isProtect ? 'Add an open password to a PDF. The document stays on your device.' : 'Enter the known password to create a copy that opens without one.'}</p>}
    </div>
  </div>;
}
