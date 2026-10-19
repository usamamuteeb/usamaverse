'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Status } from '@/components/tool-kit/fields';
import { canvasToBlob, openPdf, releaseCanvas, renderPage } from './pdfjs';

/** Opens a pdf.js document for previews and destroys it when the bytes change or on unmount. */
export function usePdfPreview(bytes: Uint8Array | null) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    setDoc(null);
    setError(null);
    if (!bytes) return;
    openPdf(bytes)
      .then((d) => {
        if (cancelled) void d.loadingTask.destroy();
        else {
          opened = d;
          setDoc(d);
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      if (opened) void opened.loadingTask.destroy();
    };
  }, [bytes]);
  return { doc, error };
}

/** One lazily rendered page thumbnail (renders when scrolled into view). */
export function PageThumb({ doc, pageNumber, rotate = 0, width = 150, alt }: { doc: PDFDocumentProxy; pageNumber: number; rotate?: number; width?: number; alt: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        try {
          const page = await doc.getPage(pageNumber);
          const base = page.getViewport({ scale: 1 });
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const scale = ((width * dpr) / Math.max(base.width, base.height)) * 1.0;
          const canvas = await renderPage(doc, pageNumber, scale);
          const blob = await canvasToBlob(canvas, 'image/jpeg', 0.82);
          releaseCanvas(canvas);
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        } catch {
          if (!cancelled) setFailed(true);
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc, pageNumber, width]);
  return (
    <div ref={holder} className="page-thumb" style={{ width, height: width }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }} draggable={false} />
      ) : (
        <span className="page-thumb-placeholder" aria-hidden="true">
          {failed ? '!' : pageNumber}
        </span>
      )}
    </div>
  );
}

export interface GridPage {
  id: string;
  /** 0-based index in the source PDF. */
  src: number;
  /** Extra clockwise rotation in degrees. */
  rotate: number;
}

export function initialPages(count: number): GridPage[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, src: i, rotate: 0 }));
}

interface Props {
  doc: PDFDocumentProxy;
  pages: GridPage[];
  onChange?: (pages: GridPage[], announcement: string) => void;
  allowReorder?: boolean;
  allowRotate?: boolean;
  allowDelete?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  /** Label shown on selected pages, e.g. “Remove” or “Selected”. */
  selectedLabel?: string;
}

/**
 * Accessible page grid: every action has a button (keyboard and screen-reader
 * friendly); drag and drop is an optional shortcut for reordering.
 */
export function PageGrid({ doc, pages, onChange, allowReorder, allowRotate, allowDelete, selected, onToggle, selectedLabel = 'Selected' }: Props) {
  const dragFrom = useRef<number | null>(null);
  const move = (from: number, to: number) => {
    if (!onChange || to < 0 || to >= pages.length || from === to) return;
    const next = pages.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next, `Page ${it.src + 1} moved to position ${to + 1}.`);
  };
  return (
    <ol className="page-grid" aria-label="Pages">
      {pages.map((p, i) => {
        const isSel = selected?.has(p.id) ?? false;
        return (
          <li
            key={p.id}
            className={isSel ? 'page-card is-selected' : 'page-card'}
            draggable={allowReorder}
            onDragStart={() => (dragFrom.current = i)}
            onDragOver={(e) => allowReorder && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom.current !== null) move(dragFrom.current, i);
              dragFrom.current = null;
            }}
          >
            {onToggle ? (
              <button type="button" className="page-select" aria-pressed={isSel} onClick={() => onToggle(p.id)} aria-label={`Page ${p.src + 1}${isSel ? `, ${selectedLabel.toLowerCase()}` : ''}. Press to toggle.`}>
                <PageThumb doc={doc} pageNumber={p.src + 1} rotate={p.rotate} alt="" />
              </button>
            ) : (
              <PageThumb doc={doc} pageNumber={p.src + 1} rotate={p.rotate} alt={`Page ${p.src + 1}`} />
            )}
            <div className="page-meta">
              <span>
                <strong>{i + 1}</strong>
                {p.src !== i && <span className="muted"> (was {p.src + 1})</span>}
              </span>
              {isSel && <span className="page-badge">{selectedLabel}</span>}
              {p.rotate % 360 !== 0 && <span className="muted"> ↻{p.rotate % 360}°</span>}
            </div>
            {(allowReorder || allowRotate || allowDelete) && (
              <div className="page-actions">
                {allowReorder && (
                  <>
                    <button type="button" className="icon-btn" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move page ${p.src + 1} earlier`}>
                      ←
                    </button>
                    <button type="button" className="icon-btn" onClick={() => move(i, i + 1)} disabled={i === pages.length - 1} aria-label={`Move page ${p.src + 1} later`}>
                      →
                    </button>
                  </>
                )}
                {allowRotate && (
                  <>
                    <button type="button" className="icon-btn" onClick={() => onChange?.(pages.map((x) => (x.id === p.id ? { ...x, rotate: (x.rotate + 270) % 360 } : x)), `Page ${p.src + 1} rotated left.`)} aria-label={`Rotate page ${p.src + 1} left`}>
                      ⟲
                    </button>
                    <button type="button" className="icon-btn" onClick={() => onChange?.(pages.map((x) => (x.id === p.id ? { ...x, rotate: (x.rotate + 90) % 360 } : x)), `Page ${p.src + 1} rotated right.`)} aria-label={`Rotate page ${p.src + 1} right`}>
                      ⟳
                    </button>
                  </>
                )}
                {allowDelete && (
                  <button type="button" className="icon-btn danger" onClick={() => onChange?.(pages.filter((x) => x.id !== p.id), `Page ${p.src + 1} removed.`)} disabled={pages.length === 1} aria-label={`Delete page ${p.src + 1}`}>
                    ✕
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Renders the first page of a generated PDF so the user can check the result before downloading. */
export function ResultPreview({ bytes, page = 1, label = 'Preview of the result' }: { bytes: Uint8Array | null; page?: number; label?: string }) {
  const { doc, error } = usePdfPreview(bytes);
  if (!bytes) return null;
  if (error) return <Status tone="warn">The preview could not be shown ({error}). The download may still work.</Status>;
  if (!doc) return <p className="summary">Preparing preview…</p>;
  return (
    <figure className="pdf-preview">
      <PageThumb doc={doc} pageNumber={Math.min(page, doc.numPages)} width={320} alt={label} />
      <figcaption>{label} (page {Math.min(page, doc.numPages)} of {doc.numPages})</figcaption>
    </figure>
  );
}
