'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { useSinglePdf } from '@/features/tools/files/usePdf';

export default function PdfToPdfA() {
  const { pdf, picker } = useSinglePdf();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<Blob | null>(null);
  const run = async () => {
    if (!pdf) return;
    setBusy(true); setOut(null); setError(null);
    try {
      const { convertToPdfA } = await import('./pdfa');
      const result = await convertToPdfA(pdf.bytes, setProgress);
      setOut(result); setProgress('Archival copy ready.');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setProgress(''); }
    finally { setBusy(false); }
  };
  return <div className="tool-grid"><div className="tool-col">
    {picker}
    {pdf && <div className="actions"><Button variant="primary" disabled={busy} onClick={() => void run()}>{busy ? 'Converting…' : 'Create PDF/A-2b'}</Button></div>}
    {progress && <p className="summary" role="status">{progress}</p>}
  </div><div className="tool-col">
    <Status tone="warn">This archival conversion renders every page as an RGB image. It removes selectable text, links, forms, and signatures. Check the output in an independent PDF/A validator before using it for regulated archiving.</Status>
    {error && <Status tone="error">{error}</Status>}
    {out && <><p className="summary">Ready: {formatBytes(out.size)}</p><DownloadBlobButton blob={out} filename={`${pdf?.base ?? 'document'}-pdfa.pdf`} label="Download PDF/A copy" /></>}
  </div></div>;
}
