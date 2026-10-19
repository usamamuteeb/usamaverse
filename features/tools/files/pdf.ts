/**
 * PDF page operations with pdf-lib (MIT). The library is imported lazily, so it is
 * only downloaded on PDF tool pages. Everything runs in the browser.
 * Limits: password-protected PDFs are refused; pages are copied as-is (no re-rendering).
 */
import type { PDFDocument } from 'pdf-lib';

export const MAX_PDF_BYTES = 200 * 1024 * 1024;

async function lib() {
  return import('pdf-lib');
}

export async function loadPdf(bytes: Uint8Array, label = 'This file'): Promise<PDFDocument> {
  const { PDFDocument } = await lib();
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) throw new Error(`${label} is not a PDF (it does not start with %PDF).`);
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/encrypt/i.test(msg)) throw new Error(`${label} is password-protected or encrypted. Remove the protection first; this tool does not unlock PDFs.`);
    throw new Error(`${label} could not be read as a PDF (${msg.slice(0, 120)}).`);
  }
}

/** "1-3, 5, 8-" → zero-based page indexes. Descending ranges ("5-3") are allowed. */
export function parsePageRanges(spec: string, pageCount: number): number[] {
  const s = spec.trim().toLowerCase();
  if (!s || s === 'all') return Array.from({ length: pageCount }, (_, i) => i);
  const out: number[] = [];
  for (const raw of s.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(\d+|last)?\s*(-)?\s*(\d+|last)?$/);
    if (!m || (!m[1] && !m[3])) throw new Error(`“${part}” is not a page or range. Use forms like 1-3, 5, 8- or last.`);
    const num = (x: string | undefined, dflt: number) => (x === undefined ? dflt : x === 'last' ? pageCount : Number(x));
    const a = num(m[1], 1);
    const b = m[2] ? num(m[3], pageCount) : a;
    for (const p of [a, b]) if (p < 1 || p > pageCount) throw new Error(`Page ${p} does not exist; this PDF has ${pageCount} page${pageCount === 1 ? '' : 's'}.`);
    const step = a <= b ? 1 : -1;
    for (let p = a; step > 0 ? p <= b : p >= b; p += step) out.push(p - 1);
  }
  if (!out.length) throw new Error('No pages selected.');
  return out;
}

export async function copyPages(src: PDFDocument, indices: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await lib();
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

export async function mergePdfs(files: Array<{ name: string; bytes: Uint8Array }>): Promise<Uint8Array> {
  if (files.length < 2) throw new Error('Add at least two PDFs to merge.');
  const { PDFDocument } = await lib();
  const out = await PDFDocument.create();
  for (const f of files) {
    const doc = await loadPdf(f.bytes, `“${f.name}”`);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

export async function splitPdf(bytes: Uint8Array, mode: 'each' | 'ranges' | 'every', spec: string, baseName: string): Promise<Array<{ name: string; bytes: Uint8Array }>> {
  const doc = await loadPdf(bytes);
  const n = doc.getPageCount();
  const every = Number(spec);
  if (mode === 'every' && (!Number.isInteger(every) || every < 1)) throw new Error('Pages per file must be a whole number of at least 1.');
  const groups: number[][] = mode === 'each' ? Array.from({ length: n }, (_, i) => [i]) : mode === 'every' ? Array.from({ length: Math.ceil(n / every) }, (_, g) => Array.from({ length: Math.min(every, n - g * every) }, (_, k) => g * every + k)) : spec.split(/\s*;\s*|\s*\n\s*/).filter(Boolean).map((g) => parsePageRanges(g, n));
  if (!groups.length) throw new Error('Enter at least one group of pages, e.g. “1-3; 4-6”.');
  if (groups.length > 500) throw new Error('That would create more than 500 files.');
  const pad = String(groups.length).length;
  const out: Array<{ name: string; bytes: Uint8Array }> = [];
  for (let i = 0; i < groups.length; i++) out.push({ name: `${baseName}-part${String(i + 1).padStart(pad, '0')}.pdf`, bytes: await copyPages(doc, groups[i]) });
  return out;
}

export async function rotatePdf(bytes: Uint8Array, spec: string, angle: 90 | 180 | 270): Promise<Uint8Array> {
  const { degrees } = await lib();
  const doc = await loadPdf(bytes);
  const idx = new Set(parsePageRanges(spec, doc.getPageCount()));
  doc.getPages().forEach((p, i) => {
    if (idx.has(i)) p.setRotation(degrees((p.getRotation().angle + angle) % 360));
  });
  return doc.save();
}

export interface PdfInfo {
  pageCount: number;
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
  pageSizes: Array<{ w: number; h: number; rotation: number }>;
}

export async function readInfo(bytes: Uint8Array): Promise<PdfInfo> {
  const doc = await loadPdf(bytes);
  const iso = (d: Date | undefined) => (d && !Number.isNaN(d.getTime()) ? d.toISOString() : '');
  return {
    pageCount: doc.getPageCount(),
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: doc.getKeywords() ?? '',
    creator: doc.getCreator() ?? '',
    producer: doc.getProducer() ?? '',
    creationDate: iso(doc.getCreationDate()),
    modificationDate: iso(doc.getModificationDate()),
    pageSizes: doc.getPages().map((p) => ({ w: p.getWidth(), h: p.getHeight(), rotation: p.getRotation().angle })),
  };
}

export async function writeInfo(bytes: Uint8Array, info: { title: string; author: string; subject: string; keywords: string; creator: string; producer: string; updateModified: boolean }): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  doc.setTitle(info.title);
  doc.setAuthor(info.author);
  doc.setSubject(info.subject);
  doc.setKeywords(info.keywords.split(',').map((k) => k.trim()).filter(Boolean));
  doc.setCreator(info.creator);
  doc.setProducer(info.producer);
  if (info.updateModified) doc.setModificationDate(new Date());
  return doc.save({ updateFieldAppearances: false });
}

export const PAGE_SIZES: Record<string, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008], a5: [419.53, 595.28] };

export async function imagesToPdf(images: Array<{ bytes: Uint8Array; mime: 'image/png' | 'image/jpeg'; width: number; height: number }>, o: { size: 'fit' | keyof typeof PAGE_SIZES; marginPt: number; orientation: 'auto' | 'portrait' | 'landscape' }): Promise<Uint8Array> {
  if (!images.length) throw new Error('Add at least one image.');
  const { PDFDocument } = await lib();
  const doc = await PDFDocument.create();
  for (const img of images) {
    const embedded = img.mime === 'image/png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    const iw = embedded.width;
    const ih = embedded.height;
    if (o.size === 'fit') {
      // 1 image pixel = 0.75 pt (96 dpi), plus margins.
      const w = iw * 0.75 + o.marginPt * 2;
      const h = ih * 0.75 + o.marginPt * 2;
      const page = doc.addPage([w, h]);
      page.drawImage(embedded, { x: o.marginPt, y: o.marginPt, width: iw * 0.75, height: ih * 0.75 });
      continue;
    }
    let [pw, ph] = PAGE_SIZES[o.size];
    const landscape = o.orientation === 'landscape' || (o.orientation === 'auto' && iw > ih);
    if (landscape) [pw, ph] = [ph, pw];
    const page = doc.addPage([pw, ph]);
    const aw = pw - o.marginPt * 2;
    const ah = ph - o.marginPt * 2;
    if (aw <= 0 || ah <= 0) throw new Error('The margin is larger than the page.');
    const scale = Math.min(aw / iw, ah / ih);
    const w = iw * scale;
    const h = ih * scale;
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  doc.setProducer('UsamaVerse (pdf-lib)');
  return doc.save();
}
