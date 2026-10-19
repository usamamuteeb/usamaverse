/**
 * Lazy pdf.js (Apache-2.0) loader for rendering pages and reading text.
 * The worker and data files are served from /pdfjs/ (copied from node_modules by
 * scripts/copy-pdfjs-assets.mjs), so no third-party CDN is contacted.
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// The legacy build adds polyfills so pdf.js 6 also works in browsers that are
// a few versions old (the modern build needs very recent JavaScript features).
type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let lib: Promise<PdfJs> | null = null;

export const PDFJS_BASE = '/pdfjs/';

export function pdfjs(): Promise<PdfJs> {
  if (!lib) {
    lib = import('pdfjs-dist/legacy/build/pdf.mjs').then((m) => {
      m.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}pdf.worker.min.mjs`;
      return m;
    });
    lib.catch(() => (lib = null));
  }
  return lib;
}

export class PdfPasswordError extends Error {
  constructor(public readonly wrong: boolean) {
    super(wrong ? 'That password is not correct.' : 'This PDF is password-protected.');
    this.name = 'PdfPasswordError';
  }
}

/** Opens a PDF for viewing. The bytes are copied because pdf.js transfers its buffer to the worker. */
export async function openPdf(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  const m = await pdfjs();
  const task = m.getDocument({
    data: bytes.slice(),
    password,
    cMapUrl: `${PDFJS_BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_BASE}standard_fonts/`,
    wasmUrl: `${PDFJS_BASE}wasm/`,
    iccUrl: `${PDFJS_BASE}iccs/`,
    enableXfa: false,
  });
  try {
    return await task.promise;
  } catch (e) {
    const err = e as { name?: string; code?: number; message?: string };
    if (err?.name === 'PasswordException') throw new PdfPasswordError(err.code === 2);
    throw new Error(`This file could not be opened as a PDF (${String(err?.message ?? e).slice(0, 120)}).`);
  }
}

export const MAX_RENDER_PIXELS = 40_000_000;

/**
 * Renders one page (1-based) to a new canvas. `extraRotation` is added to the page's own rotation.
 * A white background is painted first so JPEG output has no black transparency.
 */
export async function renderPage(doc: PDFDocumentProxy, pageNumber: number, scale: number, extraRotation = 0, background = '#ffffff'): Promise<HTMLCanvasElement> {
  const page: PDFPageProxy = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation: (page.rotate + extraRotation) % 360 });
  const w = Math.max(1, Math.floor(viewport.width));
  const h = Math.max(1, Math.floor(viewport.height));
  if (w * h > MAX_RENDER_PIXELS) throw new Error(`Page ${pageNumber} would be ${(w * h / 1e6).toFixed(0)} megapixels at this resolution; choose a lower DPI.`);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: 'image/png' | 'image/jpeg', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => {
      if (!b) reject(new Error('The browser could not encode the page image (it may be too large for this device).'));
      else if (b.type !== mime) reject(new Error(`The browser produced ${b.type || 'an unknown type'} instead of ${mime}.`));
      else resolve(b);
    }, mime, quality),
  );
}

/** Frees a canvas' backing memory early. */
export function releaseCanvas(c: HTMLCanvasElement) {
  c.width = 0;
  c.height = 0;
}

export interface TextRun {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  hasEOL: boolean;
  /** Unit vector of the reading direction in visual coordinates (y up); (1, 0) for normal text. */
  dir: [number, number];
}

/**
 * Text runs of a page in visual page coordinates (PDF points, origin bottom-left of
 * the rotated, cropped view). Only text that exists in the PDF; scans have none.
 */
export async function pageTextRuns(doc: PDFDocumentProxy, pageNumber: number): Promise<{ runs: TextRun[]; width: number; height: number }> {
  const m = await pdfjs();
  const page = await doc.getPage(pageNumber);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const runs: TextRun[] = [];
  for (const item of tc.items) {
    if (!('str' in item)) continue;
    // Combine the text matrix with the viewport transform (which flips y and applies rotation).
    const tx = m.Util.transform(vp.transform, item.transform);
    const fontSize = Math.hypot(tx[2], tx[3]);
    // Baseline start in visual coordinates with origin at the bottom-left.
    const len = Math.hypot(tx[0], tx[1]) || 1;
    runs.push({ str: item.str, x: tx[4], y: vp.height - tx[5], width: item.width, height: fontSize, fontSize, hasEOL: item.hasEOL, dir: [tx[0] / len, -tx[1] / len] });
  }
  page.cleanup();
  return { runs, width: vp.width, height: vp.height };
}
