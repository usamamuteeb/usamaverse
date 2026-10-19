/**
 * PDF writing operations built on pdf-lib (MIT), lazily imported.
 *
 * Coordinates: tools work in the *visual* page space the user sees — PDF points,
 * origin at the bottom-left of the page as displayed (after /Rotate and inside the
 * CropBox). `toPagePoint` maps that to the page's own user space, so stamps, crops
 * and overlays land correctly on rotated or cropped pages.
 */
import type { PDFDocument, PDFFont, PDFPage } from 'pdf-lib';
import { loadPdf, parsePageRanges } from '@/features/tools/files/pdf';

const lib = () => import('pdf-lib');

// ---------------------------------------------------------------- geometry

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Rotation = 0 | 90 | 180 | 270;

export function normRotation(deg: number): Rotation {
  return ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as Rotation;
}

/** Size of the page as displayed (rotation swaps width and height). */
export function visualSize(box: Box, rotation: Rotation): { width: number; height: number } {
  return rotation % 180 === 0 ? { width: box.width, height: box.height } : { width: box.height, height: box.width };
}

/** Visual point → page user-space point. */
export function toPagePoint(box: Box, rotation: Rotation, vx: number, vy: number): { x: number; y: number } {
  const { x: x0, y: y0, width: w, height: h } = box;
  switch (rotation) {
    case 0:
      return { x: x0 + vx, y: y0 + vy };
    case 90:
      return { x: x0 + w - vy, y: y0 + vx };
    case 180:
      return { x: x0 + w - vx, y: y0 + h - vy };
    case 270:
      return { x: x0 + vy, y: y0 + h - vx };
  }
}

/** Visual rectangle → page user-space rectangle (rotations are multiples of 90°, so it stays axis-aligned). */
export function toPageRect(box: Box, rotation: Rotation, r: Box): Box {
  const a = toPagePoint(box, rotation, r.x, r.y);
  const b = toPagePoint(box, rotation, r.x + r.width, r.y + r.height);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

/** Visual margins (top/right/bottom/left) → a new visible box in page space. */
export function cropBoxFromMargins(box: Box, rotation: Rotation, m: { top: number; right: number; bottom: number; left: number }): Box {
  const v = visualSize(box, rotation);
  const w = v.width - m.left - m.right;
  const h = v.height - m.top - m.bottom;
  if (w < 1 || h < 1) throw new Error('The margins are larger than the page.');
  return toPageRect(box, rotation, { x: m.left, y: m.bottom, width: w, height: h });
}

function pageGeom(page: PDFPage) {
  const box = page.getCropBox();
  return { box: { x: box.x, y: box.y, width: box.width, height: box.height }, rotation: normRotation(page.getRotation().angle) };
}

export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const m = hex.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) throw new Error(`“${hex}” is not a hex color like #c6283d.`);
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 };
}

async function color(hex: string) {
  const { rgb } = await lib();
  const c = hexToRgb01(hex);
  return rgb(c.r, c.g, c.b);
}

/** Standard PDF fonts only cover Latin (WinAnsi) characters; say so clearly instead of failing deep inside. */
export function assertEncodable(font: PDFFont, text: string) {
  try {
    font.encodeText(text);
  } catch {
    const bad = [...text].find((ch) => {
      try {
        font.encodeText(ch);
        return false;
      } catch {
        return true;
      }
    });
    throw new Error(`The character “${bad}” can’t be written with the built-in PDF fonts, which support Latin text only. Remove it or use a different character.`);
  }
}

export type FontChoice = 'Helvetica' | 'HelveticaBold' | 'TimesRoman' | 'Courier';

async function font(doc: PDFDocument, f: FontChoice = 'Helvetica') {
  const { StandardFonts } = await lib();
  return doc.embedFont(StandardFonts[f]);
}

// ---------------------------------------------------------------- page plans

export interface PagePlanItem {
  /** 0-based index in the source PDF. */
  src: number;
  /** Extra clockwise rotation to add, in degrees (multiple of 90). */
  rotate: number;
}

/** Builds a new PDF from a list of source pages: reorder, duplicate, remove and rotate in one step. */
export async function buildFromPlan(bytes: Uint8Array, plan: PagePlanItem[]): Promise<Uint8Array> {
  if (plan.length === 0) throw new Error('The result would have no pages. Keep at least one page.');
  const { PDFDocument, degrees } = await lib();
  const src = await loadPdf(bytes);
  const n = src.getPageCount();
  for (const p of plan) if (!Number.isInteger(p.src) || p.src < 0 || p.src >= n) throw new Error(`Page ${p.src + 1} does not exist.`);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, plan.map((p) => p.src));
  copied.forEach((page, i) => {
    const extra = normRotation(plan[i].rotate);
    if (extra) page.setRotation(degrees(normRotation(page.getRotation().angle + extra)));
    out.addPage(page);
  });
  copyInfo(src, out);
  return out.save();
}

function copyInfo(src: PDFDocument, out: PDFDocument) {
  const t = src.getTitle();
  if (t) out.setTitle(t);
  const a = src.getAuthor();
  if (a) out.setAuthor(a);
}

export async function removePages(bytes: Uint8Array, remove: number[]): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const n = src.getPageCount();
  const drop = new Set(remove);
  const keep = Array.from({ length: n }, (_, i) => i).filter((i) => !drop.has(i));
  if (drop.size === 0) throw new Error('Select at least one page to remove.');
  if (keep.length === 0) throw new Error('You selected every page. A PDF needs at least one page.');
  return buildFromPlan(bytes, keep.map((src) => ({ src, rotate: 0 })));
}

/** Split into consecutive chunks of `size` pages. */
export function chunkRanges(pageCount: number, size: number): number[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error('Pages per file must be a whole number of at least 1.');
  const out: number[][] = [];
  for (let i = 0; i < pageCount; i += size) out.push(Array.from({ length: Math.min(size, pageCount - i) }, (_, k) => i + k));
  return out;
}

// ---------------------------------------------------------------- stamps

export type Anchor = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

/** Where a box of size (w,h) goes on a visual page for an anchor and margin. Returns its visual bottom-left. */
export function anchorPosition(page: { width: number; height: number }, w: number, h: number, anchor: Anchor, margin: number): { x: number; y: number } {
  const [v, hz] = anchor === 'center' ? ['middle', 'center'] : (anchor.split('-') as [string, string]);
  const x = hz === 'left' ? margin : hz === 'right' ? page.width - margin - w : (page.width - w) / 2;
  const y = v === 'top' ? page.height - margin - h : v === 'bottom' ? margin : (page.height - h) / 2;
  return { x, y };
}

export type NumberFormat = 'n' | 'page-n' | 'n-of-total' | 'page-n-of-total' | 'dash-n';

export function formatPageLabel(fmt: NumberFormat, n: number, total: number): string {
  switch (fmt) {
    case 'n':
      return String(n);
    case 'page-n':
      return `Page ${n}`;
    case 'n-of-total':
      return `${n} / ${total}`;
    case 'page-n-of-total':
      return `Page ${n} of ${total}`;
    case 'dash-n':
      return `– ${n} –`;
  }
}

export interface PageNumberOptions {
  pages: string;
  startAt: number;
  format: NumberFormat;
  anchor: Anchor;
  margin: number;
  fontSize: number;
  color: string;
  opacity: number;
  font: FontChoice;
  /** Mirror left/right anchors on even pages (for printed books). */
  facing: boolean;
}

export async function addPageNumbers(bytes: Uint8Array, o: PageNumberOptions): Promise<Uint8Array> {
  const { degrees } = await lib();
  if (!Number.isInteger(o.startAt) || o.startAt < 0) throw new Error('The first number must be a whole number (0 or more).');
  if (!(o.fontSize >= 4 && o.fontSize <= 96)) throw new Error('Font size must be between 4 and 96 pt.');
  const doc = await loadPdf(bytes);
  const f = await font(doc, o.font);
  const c = await color(o.color);
  const targets = parsePageRanges(o.pages, doc.getPageCount()).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
  const total = o.startAt + targets.length - 1;
  const pages = doc.getPages();
  targets.forEach((idx, k) => {
    const page = pages[idx];
    const label = formatPageLabel(o.format, o.startAt + k, total);
    assertEncodable(f, label);
    const { box, rotation } = pageGeom(page);
    const vs = visualSize(box, rotation);
    const w = f.widthOfTextAtSize(label, o.fontSize);
    const h = f.heightAtSize(o.fontSize, { descender: false });
    let anchor = o.anchor;
    if (o.facing && (o.startAt + k) % 2 === 0) anchor = anchor.replace('left', 'TMP').replace('right', 'left').replace('TMP', 'right') as Anchor;
    const pos = anchorPosition(vs, w, h, anchor, o.margin);
    const p = toPagePoint(box, rotation, pos.x, pos.y);
    page.drawText(label, { x: p.x, y: p.y, size: o.fontSize, font: f, color: c, opacity: o.opacity, rotate: degrees(rotation) });
  });
  return doc.save();
}

export interface TextWatermarkOptions {
  text: string;
  pages: string;
  fontSize: number;
  color: string;
  opacity: number;
  angle: number;
  layout: 'center' | 'tile' | Anchor;
  font: FontChoice;
}

export async function addTextWatermark(bytes: Uint8Array, o: TextWatermarkOptions): Promise<Uint8Array> {
  const { degrees } = await lib();
  const text = o.text.trim();
  if (!text) throw new Error('Enter the watermark text.');
  if (!(o.opacity > 0 && o.opacity <= 1)) throw new Error('Opacity must be between 1% and 100%.');
  const doc = await loadPdf(bytes);
  const f = await font(doc, o.font);
  assertEncodable(f, text);
  const c = await color(o.color);
  const pages = doc.getPages();
  for (const idx of new Set(parsePageRanges(o.pages, pages.length))) {
    const page = pages[idx];
    const { box, rotation } = pageGeom(page);
    const vs = visualSize(box, rotation);
    const w = f.widthOfTextAtSize(text, o.fontSize);
    const h = f.heightAtSize(o.fontSize, { descender: false });
    const draw = (cx: number, cy: number) => {
      // Rotate the text around its own centre (cx, cy) in visual space.
      const rad = (o.angle * Math.PI) / 180;
      const vx = cx - (Math.cos(rad) * w) / 2 + (Math.sin(rad) * h) / 2;
      const vy = cy - (Math.sin(rad) * w) / 2 - (Math.cos(rad) * h) / 2;
      const p = toPagePoint(box, rotation, vx, vy);
      page.drawText(text, { x: p.x, y: p.y, size: o.fontSize, font: f, color: c, opacity: o.opacity, rotate: degrees(rotation + o.angle) });
    };
    if (o.layout === 'tile') {
      const stepX = w + o.fontSize * 3;
      const stepY = o.fontSize * 5;
      for (let y = stepY / 2, row = 0; y < vs.height + stepY; y += stepY, row++) for (let x = (row % 2) * (stepX / 2); x < vs.width + stepX; x += stepX) draw(x, y);
    } else if (o.layout === 'center') draw(vs.width / 2, vs.height / 2);
    else {
      const pos = anchorPosition(vs, w, h, o.layout, 24);
      draw(pos.x + w / 2, pos.y + h / 2);
    }
  }
  return doc.save();
}

export interface ImageWatermarkOptions {
  image: Uint8Array;
  mime: 'image/png' | 'image/jpeg';
  pages: string;
  /** Width as a fraction of the visual page width. */
  widthFraction: number;
  opacity: number;
  anchor: Anchor;
  margin: number;
}

export async function addImageWatermark(bytes: Uint8Array, o: ImageWatermarkOptions): Promise<Uint8Array> {
  const { degrees } = await lib();
  const doc = await loadPdf(bytes);
  const img = o.mime === 'image/png' ? await doc.embedPng(o.image) : await doc.embedJpg(o.image);
  const pages = doc.getPages();
  for (const idx of new Set(parsePageRanges(o.pages, pages.length))) {
    const page = pages[idx];
    const { box, rotation } = pageGeom(page);
    const vs = visualSize(box, rotation);
    const w = vs.width * o.widthFraction;
    const h = (w * img.height) / img.width;
    const pos = anchorPosition(vs, w, h, o.anchor, o.margin);
    const p = toPagePoint(box, rotation, pos.x, pos.y);
    page.drawImage(img, { x: p.x, y: p.y, width: w, height: h, opacity: o.opacity, rotate: degrees(rotation) });
  }
  return doc.save();
}

// ---------------------------------------------------------------- crop

export async function cropPdf(bytes: Uint8Array, o: { pages: string; top: number; right: number; bottom: number; left: number }): Promise<Uint8Array> {
  for (const v of [o.top, o.right, o.bottom, o.left]) if (!(v >= 0)) throw new Error('Margins must be zero or more.');
  const doc = await loadPdf(bytes);
  const pages = doc.getPages();
  for (const idx of new Set(parsePageRanges(o.pages, pages.length))) {
    const page = pages[idx];
    const { box, rotation } = pageGeom(page);
    const r = cropBoxFromMargins(box, rotation, o);
    page.setCropBox(r.x, r.y, r.width, r.height);
    // Keep printing and trimming consistent with what is shown.
    page.setTrimBox(r.x, r.y, r.width, r.height);
  }
  return doc.save();
}

// ---------------------------------------------------------------- optimize / repair

export interface OptimizeResult {
  bytes: Uint8Array;
  method: string;
  original: number;
}

/**
 * Lossless optimisation: re-save with object streams, and rebuild via page copying
 * (drops unreferenced objects). Returns the smallest candidate; may equal the original.
 */
export async function optimizePdf(bytes: Uint8Array, o: { removeMetadata: boolean }): Promise<OptimizeResult> {
  const { PDFDocument } = await lib();
  const candidates: Array<{ bytes: Uint8Array; method: string }> = [{ bytes, method: 'original (no smaller version found)' }];
  const doc = await loadPdf(bytes);
  if (o.removeMetadata) stripInfo(doc);
  candidates.push({ bytes: await doc.save({ useObjectStreams: true }), method: 'compressed object streams' });
  const rebuilt = await PDFDocument.create();
  const pages = await rebuilt.copyPages(doc, doc.getPageIndices());
  pages.forEach((p) => rebuilt.addPage(p));
  if (!o.removeMetadata) copyInfo(doc, rebuilt);
  else stripInfo(rebuilt);
  candidates.push({ bytes: await rebuilt.save({ useObjectStreams: true }), method: 'rebuilt without unused objects' });
  const best = candidates.reduce((a, b) => (b.bytes.length < a.bytes.length ? b : a));
  return { ...best, original: bytes.length };
}

function stripInfo(doc: PDFDocument) {
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setCreator('');
  doc.setProducer('');
  const catalog = doc.catalog;
  // Remove XMP metadata stream reference if present.
  for (const key of catalog.keys()) if (key.asString() === '/Metadata') catalog.delete(key);
}

/**
 * Tries to rebuild a damaged PDF. pdf-lib reads objects sequentially, so it can
 * often recover files with a broken cross-reference table or trailer.
 */
export async function repairPdf(bytes: Uint8Array): Promise<{ bytes: Uint8Array; pages: number; notes: string[] }> {
  const { PDFDocument } = await lib();
  const notes: string[] = [];
  const start = Array.from(bytes.subarray(0, 1024)).map((c) => String.fromCharCode(c)).join('').indexOf('%PDF-');
  if (start < 0) throw new Error('No “%PDF-” header was found, so this does not look like a PDF at all.');
  if (start > 0) notes.push(`Removed ${start} unexpected bytes before the PDF header.`);
  const tail = Array.from(bytes.subarray(Math.max(0, bytes.length - 2048))).map((c) => String.fromCharCode(c)).join('');
  if (!tail.includes('%%EOF')) notes.push('The end-of-file marker was missing (the file was probably truncated).');
  const body = bytes.subarray(start);
  const tryLoad = (b: Uint8Array) => PDFDocument.load(b, { ignoreEncryption: false, throwOnInvalidObject: false, updateMetadata: false });
  let doc: PDFDocument | null = null;
  let firstError = '';
  try {
    doc = await tryLoad(body);
  } catch (e) {
    firstError = e instanceof Error ? e.message : String(e);
    if (/encrypt/i.test(firstError)) throw new Error('This PDF is encrypted. Repair does not remove or bypass passwords.');
  }
  if (!doc) {
    // A partially written object at the end usually breaks parsing: cut back to the
    // last complete "endobj" (and then earlier ones) and try again.
    const marker = [101, 110, 100, 111, 98, 106]; // "endobj"
    const ends: number[] = [];
    for (let i = body.length - marker.length; i >= 0 && ends.length < 25; i--) {
      if (marker.every((c, k) => body[i + k] === c)) ends.push(i + marker.length);
    }
    for (const end of ends) {
      try {
        const candidate = new Uint8Array(end + 7);
        candidate.set(body.subarray(0, end));
        candidate.set([10, 37, 37, 69, 79, 70, 10], end); // "\n%%EOF\n"
        doc = await tryLoad(candidate);
        if (doc.getPageCount() > 0) {
          notes.push(`Dropped ${body.length - end} damaged bytes at the end of the file.`);
          break;
        }
        doc = null;
      } catch {
        doc = null;
      }
    }
  }
  if (!doc) throw new Error(`The structure could not be recovered (${firstError.slice(0, 120)}).`);
  const n = doc.getPageCount();
  if (n === 0) throw new Error('No pages could be recovered from this file.');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(doc, doc.getPageIndices());
  copied.forEach((p) => out.addPage(p));
  copyInfo(doc, out);
  notes.push(`Rebuilt the document structure with ${n} page${n === 1 ? '' : 's'}.`);
  return { bytes: await out.save(), pages: n, notes };
}

// ---------------------------------------------------------------- raster PDFs

/** Builds a PDF where each page is one JPEG/PNG image at the given visual size (points). */
export async function pdfFromImages(pages: Array<{ data: Uint8Array; mime: 'image/jpeg' | 'image/png'; widthPt: number; heightPt: number }>, info?: { title?: string }): Promise<Uint8Array> {
  const { PDFDocument } = await lib();
  if (!pages.length) throw new Error('No pages to write.');
  const doc = await PDFDocument.create();
  for (const p of pages) {
    const img = p.mime === 'image/png' ? await doc.embedPng(p.data) : await doc.embedJpg(p.data);
    const page = doc.addPage([p.widthPt, p.heightPt]);
    page.drawImage(img, { x: 0, y: 0, width: p.widthPt, height: p.heightPt });
  }
  if (info?.title) doc.setTitle(info.title);
  doc.setProducer('UsamaVerse');
  doc.setCreator('UsamaVerse');
  return doc.save();
}

/** Copies chosen pages from a source PDF and replaces others with raster images (used by redaction). */
export async function mixPages(bytes: Uint8Array, pages: Array<{ src: number } | { data: Uint8Array; mime: 'image/jpeg' | 'image/png'; widthPt: number; heightPt: number }>): Promise<Uint8Array> {
  const { PDFDocument } = await lib();
  const src = await loadPdf(bytes);
  const out = await PDFDocument.create();
  for (const p of pages) {
    if ('src' in p) {
      const [copied] = await out.copyPages(src, [p.src]);
      out.addPage(copied);
    } else {
      const img = p.mime === 'image/png' ? await out.embedPng(p.data) : await out.embedJpg(p.data);
      out.addPage([p.widthPt, p.heightPt]).drawImage(img, { x: 0, y: 0, width: p.widthPt, height: p.heightPt });
    }
  }
  out.setProducer('UsamaVerse');
  out.setCreator('UsamaVerse');
  return out.save();
}

// ---------------------------------------------------------------- overlays (edit / sign)

export type Overlay =
  | { kind: 'text'; page: number; x: number; y: number; text: string; size: number; color: string; font: FontChoice; opacity?: number }
  | { kind: 'rect'; page: number; x: number; y: number; width: number; height: number; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }
  | { kind: 'ink'; page: number; points: Array<[number, number]>; color: string; width: number; opacity?: number }
  | { kind: 'image'; page: number; x: number; y: number; width: number; height: number; data: Uint8Array; mime: 'image/png' | 'image/jpeg'; opacity?: number };

/** Draws overlays (in visual coordinates, y up from the bottom) on top of page content. */
export async function applyOverlays(bytes: Uint8Array, overlays: Overlay[]): Promise<Uint8Array> {
  const { degrees, rgb, LineCapStyle } = await lib();
  const hexColor = (hex: string) => {
    const c = hexToRgb01(hex);
    return rgb(c.r, c.g, c.b);
  };
  if (!overlays.length) throw new Error('Add something to the page first.');
  const doc = await loadPdf(bytes);
  const pages = doc.getPages();
  const fonts = new Map<FontChoice, PDFFont>();
  const getFont = async (f: FontChoice) => {
    if (!fonts.has(f)) fonts.set(f, await font(doc, f));
    return fonts.get(f)!;
  };
  for (const o of overlays) {
    const page = pages[o.page];
    if (!page) throw new Error(`Page ${o.page + 1} does not exist.`);
    const { box, rotation } = pageGeom(page);
    const opacity = o.opacity ?? 1;
    if (o.kind === 'text') {
      const f = await getFont(o.font);
      const lines = o.text.split(/\r?\n/);
      for (const l of lines) assertEncodable(f, l);
      const lh = o.size * 1.2;
      lines.forEach((line, i) => {
        const p = toPagePoint(box, rotation, o.x, o.y - i * lh);
        page.drawText(line, { x: p.x, y: p.y, size: o.size, font: f, color: hexColor(o.color), opacity, rotate: degrees(rotation) });
      });
    } else if (o.kind === 'rect') {
      const r = toPageRect(box, rotation, o);
      page.drawRectangle({ ...r, color: o.fill ? hexColor(o.fill) : undefined, borderColor: o.stroke ? hexColor(o.stroke) : undefined, borderWidth: o.stroke ? (o.strokeWidth ?? 1) : 0, opacity, borderOpacity: opacity });
    } else if (o.kind === 'ink') {
      for (let i = 1; i < o.points.length; i++) {
        const a = toPagePoint(box, rotation, o.points[i - 1][0], o.points[i - 1][1]);
        const b = toPagePoint(box, rotation, o.points[i][0], o.points[i][1]);
        page.drawLine({ start: a, end: b, thickness: o.width, color: hexColor(o.color), opacity, lineCap: LineCapStyle.Round });
      }
    } else {
      const img = o.mime === 'image/png' ? await doc.embedPng(o.data) : await doc.embedJpg(o.data);
      const p = toPagePoint(box, rotation, o.x, o.y);
      page.drawImage(img, { x: p.x, y: p.y, width: o.width, height: o.height, opacity, rotate: degrees(rotation) });
    }
  }
  return doc.save();
}

// ---------------------------------------------------------------- forms

export type FieldInfo =
  | { kind: 'text'; name: string; value: string; multiline: boolean; maxLength?: number; readOnly: boolean }
  | { kind: 'checkbox'; name: string; checked: boolean; readOnly: boolean }
  | { kind: 'radio'; name: string; value: string; options: string[]; readOnly: boolean }
  | { kind: 'dropdown'; name: string; value: string; options: string[]; editable: boolean; readOnly: boolean }
  | { kind: 'list'; name: string; values: string[]; options: string[]; multi: boolean; readOnly: boolean }
  | { kind: 'other'; name: string; type: string };

export async function readForm(bytes: Uint8Array): Promise<{ fields: FieldInfo[]; hasXfa: boolean; signed: boolean }> {
  const m = await lib();
  const doc = await loadPdf(bytes);
  const form = doc.getForm();
  const hasXfa = form.hasXFA();
  let signed = false;
  const fields: FieldInfo[] = form.getFields().map((f) => {
    const name = f.getName();
    const readOnly = f.isReadOnly();
    if (f instanceof m.PDFTextField) return { kind: 'text', name, value: f.getText() ?? '', multiline: f.isMultiline(), maxLength: f.getMaxLength(), readOnly };
    if (f instanceof m.PDFCheckBox) return { kind: 'checkbox', name, checked: f.isChecked(), readOnly };
    if (f instanceof m.PDFRadioGroup) return { kind: 'radio', name, value: f.getSelected() ?? '', options: f.getOptions(), readOnly };
    if (f instanceof m.PDFDropdown) return { kind: 'dropdown', name, value: f.getSelected()[0] ?? '', options: f.getOptions(), editable: f.isEditable(), readOnly };
    if (f instanceof m.PDFOptionList) return { kind: 'list', name, values: f.getSelected(), options: f.getOptions(), multi: f.isMultiselect(), readOnly };
    if (f instanceof m.PDFSignature) {
      if (f.acroField.dict.get(m.PDFName.of('V'))) signed = true;
      return { kind: 'other', name, type: 'signature' };
    }
    return { kind: 'other', name, type: f.constructor.name.replace(/^PDF/, '') };
  });
  return { fields, hasXfa, signed };
}

export type FieldValue = string | boolean | string[];

export async function fillForm(bytes: Uint8Array, values: Record<string, FieldValue>, o: { flatten: boolean }): Promise<Uint8Array> {
  const m = await lib();
  const doc = await loadPdf(bytes);
  const form = doc.getForm();
  if (form.hasXFA()) form.deleteXFA(); // XFA would override the AcroForm values in some viewers
  const f = await doc.embedFont(m.StandardFonts.Helvetica);
  for (const [name, v] of Object.entries(values)) {
    const field = form.getFieldMaybe(name);
    if (!field || field.isReadOnly()) continue;
    if (field instanceof m.PDFTextField && typeof v === 'string') {
      if (v) assertEncodable(f, v.replace(/\r?\n/g, ''));
      const max = field.getMaxLength();
      if (max !== undefined && v.length > max) throw new Error(`“${name}” allows at most ${max} characters.`);
      field.setText(v || undefined);
    } else if (field instanceof m.PDFCheckBox && typeof v === 'boolean') {
      if (v) field.check();
      else field.uncheck();
    } else if (field instanceof m.PDFRadioGroup && typeof v === 'string') {
      if (v) field.select(v);
      else field.clear();
    } else if (field instanceof m.PDFDropdown && typeof v === 'string') {
      if (v) {
        assertEncodable(f, v);
        field.select(v);
      } else field.clear();
    } else if (field instanceof m.PDFOptionList && Array.isArray(v)) {
      if (v.length) field.select(v);
      else field.clear();
    }
  }
  form.updateFieldAppearances(f);
  if (o.flatten) form.flatten();
  return doc.save();
}
