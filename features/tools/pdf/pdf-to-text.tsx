'use client';

import { useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Button } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { OutputPanel } from '@/components/tool-kit/output';
import { parsePageRanges } from '@/features/tools/files/pdf';
import { useSinglePdf } from '@/features/tools/files/usePdf';
import { openPdf, pageTextRuns } from './pdfjs';
import { bodyFontSize, linesToMarkdown, linesToText, runsToLines, type Line } from './text';

export default function PdfToText() {
  const { pdf, picker } = useSinglePdf();
  const [format, setFormat] = useState<'text' | 'markdown'>('markdown');
  const [spec, setSpec] = useState('all');
  const [markers, setMarkers] = useState(true);
  const [output, setOutput] = useState('');
  const [empty, setEmpty] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef(false);

  const run = async () => {
    if (!pdf) return;
    setBusy(true);
    setError(null);
    setOutput('');
    setEmpty([]);
    cancel.current = false;
    let doc: PDFDocumentProxy | null = null;
    try {
      doc = await openPdf(pdf.bytes);
      const pages = parsePageRanges(spec, doc.numPages);
      const perPage: Array<{ n: number; lines: Line[] }> = [];
      for (const p of pages) {
        if (cancel.current) throw new Error('Cancelled.');
        setProgress(`Reading page ${p + 1}…`);
        const { runs } = await pageTextRuns(doc, p + 1);
        perPage.push({ n: p + 1, lines: runsToLines(runs) });
      }
      const body = bodyFontSize(perPage.flatMap((x) => x.lines));
      const parts = perPage.map(({ n, lines }) => {
        const content = format === 'markdown' ? linesToMarkdown(lines, body) : linesToText(lines);
        if (!markers) return content;
        return format === 'markdown' ? `<!-- Page ${n} -->\n\n${content}` : `--- Page ${n} ---\n\n${content}`;
      });
      setEmpty(perPage.filter((x) => x.lines.length === 0).map((x) => x.n));
      setOutput(parts.join('\n\n').trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (doc) await doc.loadingTask.destroy();
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && (
          <>
            <div className="form-grid">
              <SelectField label="Output" value={format} onChange={(v) => { setFormat(v as 'text'); setOutput(''); }} options={[{ value: 'markdown', label: 'Markdown (headings, lists)' }, { value: 'text', label: 'Plain text' }]} />
              <TextField label="Pages" value={spec} onChange={(v) => { setSpec(v); setOutput(''); }} hint="all, or e.g. 1-5" />
            </div>
            <CheckboxField label="Mark where each page starts" checked={markers} onChange={(v) => { setMarkers(v); setOutput(''); }} />
            <div className="actions">
              <Button variant="primary" disabled={busy} onClick={() => void run()}>
                {busy ? 'Extracting…' : 'Extract text'}
              </Button>
              {busy && <Button variant="ghost" onClick={() => (cancel.current = true)}>Cancel</Button>}
            </div>
            {progress && <p className="summary" role="status">{progress}</p>}
          </>
        )}
      </div>
      <div className="tool-col">
        <Status tone="info">Best effort: text is put in reading order from its position on the page. Columns, tables and footnotes may need tidying. For scanned pages, run OCR PDF first.</Status>
        {error && <Status tone="error">{error}</Status>}
        {empty.length > 0 && <Status tone="warn">No text layer on page{empty.length === 1 ? '' : 's'} {empty.slice(0, 20).join(', ')}{empty.length > 20 ? '…' : ''} — probably scanned images.</Status>}
        <OutputPanel label={format === 'markdown' ? 'Markdown' : 'Text'} value={output} filename={`${pdf?.base ?? 'document'}.${format === 'markdown' ? 'md' : 'txt'}`} mime={format === 'markdown' ? 'text/markdown' : 'text/plain'} rows={18} mono={false} />
      </div>
    </div>
  );
}
