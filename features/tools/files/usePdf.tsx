'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { MAX_PDF_BYTES, readInfo, type PdfInfo } from './pdf';

export interface LoadedPdf {
  name: string;
  base: string;
  bytes: Uint8Array;
  info: PdfInfo;
}

const PdfWorkspaceContext = createContext<{ pdf: LoadedPdf | null; setPdf: (value: LoadedPdf | null) => void } | null>(null);

/** Keeps one PDF in memory while a visitor switches actions inside a PDF workspace. */
export function PdfWorkspaceProvider({ children }: { children: ReactNode }) {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  return <PdfWorkspaceContext.Provider value={{ pdf, setPdf }}>{children}</PdfWorkspaceContext.Provider>;
}

export function usePdfWorkspace() { return useContext(PdfWorkspaceContext); }

/** One-PDF picker: validates, reads page count and metadata, shows errors. */
export function useSinglePdf() {
  const shared = usePdfWorkspace();
  const [localPdf, setLocalPdf] = useState<LoadedPdf | null>(null);
  const pdf = shared ? shared.pdf : localPdf;
  const setPdf = shared ? shared.setPdf : setLocalPdf;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const picker = (
    <>
      <FileDrop
        accept="application/pdf,.pdf"
        label="Choose PDF"
        onFiles={async ([f]) => {
          setError(null);
          setPdf(null);
          if (f.size > MAX_PDF_BYTES) return setError(`This PDF is ${formatBytes(f.size)}; the limit is ${formatBytes(MAX_PDF_BYTES)}.`);
          setLoading(true);
          try {
            const bytes = new Uint8Array(await f.arrayBuffer());
            const info = await readInfo(bytes);
            setPdf({ name: f.name, base: f.name.replace(/\.pdf$/i, '') || 'document', bytes, info });
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setLoading(false);
          }
        }}
      />
      {loading && <p className="summary">Reading PDF…</p>}
      {error && <Status tone="error">{error}</Status>}
      {pdf && <p className="summary">{pdf.name} — {pdf.info.pageCount} page{pdf.info.pageCount === 1 ? '' : 's'}, {formatBytes(pdf.bytes.length)}</p>}
    </>
  );
  return { pdf, picker, reset: () => setPdf(null) };
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
