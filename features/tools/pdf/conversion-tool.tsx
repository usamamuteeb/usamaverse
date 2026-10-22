'use client';

import { useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { useSinglePdf } from '@/features/tools/files/usePdf';
import type { ConversionKind } from './conversions';

const config: Record<ConversionKind, { name: string; accept: string; input: string; output: string; note: string }> = {
  'word-to-pdf': { name: 'Word to PDF', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', input: '.docx', output: 'pdf', note: 'Word pages are rendered locally, then saved as PDF page images. The appearance is preserved where the browser renderer supports it; PDF text is not selectable.' },
  'powerpoint-to-pdf': { name: 'PowerPoint to PDF', accept: '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation', input: '.pptx', output: 'pdf', note: 'Slides are rendered locally as PDF page images. Animations and transitions are not exported.' },
  'excel-to-pdf': { name: 'Excel to PDF', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', input: '.xlsx', output: 'pdf', note: 'Each worksheet is printed as a table with selectable text. Charts, merged-cell layouts and print settings may differ from Excel.' },
  'html-to-pdf': { name: 'HTML to PDF', accept: '.html,.htm,text/html', input: '.html', output: 'pdf', note: 'Pasted or uploaded HTML is rendered without scripts or external resources, then saved as PDF page images. Local HTML only; remote URLs are not fetched.' },
  'pdf-to-word': { name: 'PDF to Word', accept: '.pdf,application/pdf', input: '.pdf', output: 'docx', note: 'Extracts editable text into Word paragraphs with page breaks. Complex layout, images and tables are not reconstructed. Scanned pages need OCR first.' },
  'pdf-to-powerpoint': { name: 'PDF to PowerPoint', accept: '.pdf,application/pdf', input: '.pdf', output: 'pptx', note: 'Each PDF page becomes a slide image, preserving its appearance. Individual text and shapes are not editable.' },
  'pdf-to-excel': { name: 'PDF to Excel', accept: '.pdf,application/pdf', input: '.pdf', output: 'xlsx', note: 'Extracts text into editable worksheet cells, one sheet per page. Table and column detection is approximate; scanned pages need OCR first.' },
};

const toPdf = (kind: ConversionKind) => kind.endsWith('-to-pdf');

export function ConversionTool({ kind }: { kind: ConversionKind }) {
  const settings = config[kind];
  const { pdf, picker } = useSinglePdf();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<Blob | null>(null);
  const input = toPdf(kind) ? file : pdf;
  const base = toPdf(kind) ? file?.name.replace(/\.[^.]+$/, '') : pdf?.base;

  const run = async () => {
    if (!input) return;
    setBusy(true); setError(null); setOut(null);
    try {
      const { convertOffice } = await import('./conversions');
      const result = await convertOffice(kind, toPdf(kind) ? file! : pdf!.bytes, setProgress);
      if (result.size < 100) throw new Error('The converter returned an empty file.');
      setOut(result);
      setProgress('Conversion complete.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress('');
    } finally { setBusy(false); }
  };

  return <div className="tool-grid">
    <div className="tool-col">
      {toPdf(kind) ? <>
        <FileDrop accept={settings.accept} label={`Choose ${settings.input.toUpperCase()}`} onFiles={([picked]) => {
          setError(null); setOut(null);
          if (!picked.name.toLowerCase().endsWith(settings.input)) return setError(`Choose a ${settings.input} file.`);
          if (picked.size > 30 * 1024 * 1024) return setError('The file limit is 30 MB.');
          setFile(picked);
        }} />
        {file && <p className="summary">{file.name} · {formatBytes(file.size)}</p>}
      </> : picker}
      {input && <div className="actions"><Button variant="primary" disabled={busy} onClick={() => void run()}>{busy ? 'Converting…' : `Convert to ${settings.output.toUpperCase()}`}</Button></div>}
      {progress && <p className="summary" role="status">{progress}</p>}
    </div>
    <div className="tool-col">
      <Status tone="info">{settings.note}</Status>
      {error && <Status tone="error">{error}</Status>}
      {out && <><p className="summary">Ready: {formatBytes(out.size)}</p><DownloadBlobButton blob={out} filename={`${base || 'converted'}.${settings.output}`} label={`Download ${settings.output.toUpperCase()}`} /></>}
      {!out && !error && <p className="empty-state">Choose a file to start {settings.name.toLowerCase()} on this device.</p>}
    </div>
  </div>;
}
