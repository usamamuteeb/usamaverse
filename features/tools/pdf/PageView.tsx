'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { canvasToBlob, releaseCanvas, renderPage } from './pdfjs';

export interface PageMetrics {
  /** Visual page size in PDF points (after rotation and crop). */
  widthPt: number;
  heightPt: number;
}

/** Converts a pointer event over the page to visual PDF points (origin bottom-left). */
export function pointerToPt(e: ReactPointerEvent<Element>, el: Element, m: PageMetrics): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const px = Math.min(Math.max(e.clientX - r.left, 0), r.width);
  const py = Math.min(Math.max(e.clientY - r.top, 0), r.height);
  return { x: (px / r.width) * m.widthPt, y: m.heightPt - (py / r.height) * m.heightPt };
}

/**
 * One page rendered as an image with an SVG overlay that uses PDF point units
 * (viewBox = page size, y flipped by the caller with `svgY`). Pointer handlers
 * receive coordinates in visual PDF points.
 */
export function PageView({
  doc,
  pageNumber,
  overlay,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onMetrics,
  label,
  cursor = 'crosshair',
  style,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  overlay?: (m: PageMetrics) => ReactNode;
  onPointerDown?: (pt: { x: number; y: number }, m: PageMetrics) => void;
  onPointerMove?: (pt: { x: number; y: number }, m: PageMetrics) => void;
  onPointerUp?: (pt: { x: number; y: number }, m: PageMetrics) => void;
  onMetrics?: (m: PageMetrics) => void;
  label: string;
  cursor?: string;
  style?: CSSProperties;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [m, setM] = useState<PageMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        const vp = page.getViewport({ scale: 1 });
        const metrics = { widthPt: vp.width, heightPt: vp.height };
        const target = Math.min(1600, 900 * Math.min(2, window.devicePixelRatio || 1));
        const scale = target / Math.max(vp.width, vp.height);
        const canvas = await renderPage(doc, pageNumber, scale);
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
        releaseCanvas(canvas);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setM(metrics);
        onMetrics?.(metrics);
        setUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageNumber]);

  if (error) return <p className="status status-error">This page could not be drawn: {error}</p>;
  if (!url || !m) return <div className="page-view loading" role="status">Drawing page {pageNumber}…</div>;
  const handler = (fn?: (pt: { x: number; y: number }, mm: PageMetrics) => void) => (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!fn || !svgRef.current) return;
    fn(pointerToPt(e, svgRef.current, m), m);
  };
  return (
    <div className="page-view" style={{ aspectRatio: `${m.widthPt} / ${m.heightPt}`, ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} draggable={false} />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${m.widthPt} ${m.heightPt}`}
        preserveAspectRatio="none"
        style={{ cursor, touchAction: onPointerDown ? 'none' : 'auto' }}
        onPointerDown={(e) => {
          if (!onPointerDown) return;
          dragging.current = true;
          svgRef.current?.setPointerCapture?.(e.pointerId);
          handler(onPointerDown)(e);
        }}
        onPointerMove={(e) => dragging.current && handler(onPointerMove)(e)}
        onPointerUp={(e) => {
          if (!dragging.current) return;
          dragging.current = false;
          handler(onPointerUp)(e);
        }}
        onPointerCancel={() => { dragging.current = false; }}
        aria-hidden="true"
      >
        {overlay?.(m)}
      </svg>
    </div>
  );
}

/** Convert visual PDF y (from bottom) to SVG y (from top). */
export const svgY = (m: PageMetrics, y: number) => m.heightPt - y;

export function PageNav({ page, count, onChange }: { page: number; count: number; onChange: (p: number) => void }) {
  return (
    <div className="actions" role="group" aria-label="Page navigation">
      <button type="button" className="btn btn-secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        ← Previous
      </button>
      <span className="summary" aria-live="polite">
        Page {page} of {count}
      </span>
      <button type="button" className="btn btn-secondary" onClick={() => onChange(page + 1)} disabled={page >= count}>
        Next →
      </button>
    </div>
  );
}
