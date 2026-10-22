/** Browser-only conversion engines. Loaded only when a conversion is run. */
import { PDFDocument, rgb } from 'pdf-lib';
import { openPdf, pageTextRuns, renderPage, releaseCanvas } from './pdfjs';
import { runsToLines } from './text';

export type ConversionKind =
  | 'word-to-pdf' | 'powerpoint-to-pdf' | 'excel-to-pdf' | 'html-to-pdf'
  | 'pdf-to-word' | 'pdf-to-powerpoint' | 'pdf-to-excel';

const MAX_PAGES = 100;
const MAX_PIXELS = 40_000_000;

function failLarge(canvas: HTMLCanvasElement) {
  if (canvas.width * canvas.height > MAX_PIXELS) throw new Error('This page is too large to render in this browser. Reduce its size or split the file.');
}

async function jpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  failLarge(canvas);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((v) => v ? resolve(v) : reject(new Error('Could not encode page image.')), 'image/jpeg', 0.9));
  return new Uint8Array(await blob.arrayBuffer());
}

async function imagePagesToPdf(canvases: HTMLCanvasElement[]): Promise<Blob> {
  if (!canvases.length) throw new Error('No printable pages were found.');
  if (canvases.length > MAX_PAGES) throw new Error(`Only the first ${MAX_PAGES} pages can be converted at once. Split the source file.`);
  const pdf = await PDFDocument.create();
  for (const canvas of canvases) {
    const bytes = await jpegBytes(canvas);
    const image = await pdf.embedJpg(bytes);
    const w = canvas.width * 72 / 120;
    const h = canvas.height * 72 / 120;
    const page = pdf.addPage([w, h]);
    page.drawImage(image, { x: 0, y: 0, width: w, height: h });
    releaseCanvas(canvas);
  }
  return new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' });
}

async function htmlElementToPages(element: HTMLElement, width = 816): Promise<HTMLCanvasElement[]> {
  const html2canvas = (await import('html2canvas')).default;
  const full = await html2canvas(element, { backgroundColor: '#ffffff', scale: Math.min(1.5, 1224 / width), useCORS: false, allowTaint: false, logging: false, windowWidth: width });
  failLarge(full);
  const pageHeight = Math.floor(full.width * 297 / 210);
  const pages: HTMLCanvasElement[] = [];
  for (let y = 0; y < full.height; y += pageHeight) {
    const slice = document.createElement('canvas');
    slice.width = full.width;
    slice.height = Math.min(pageHeight, full.height - y);
    slice.getContext('2d')?.drawImage(full, 0, y, full.width, slice.height, 0, 0, full.width, slice.height);
    pages.push(slice);
  }
  releaseCanvas(full);
  return pages;
}

export async function wordToPdf(file: File, progress: (message: string) => void): Promise<Blob> {
  const { renderAsync } = await import('docx-preview');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:816px;background:#fff;z-index:-1';
  document.body.append(host);
  try {
    progress('Laying out Word pages…');
    await renderAsync(file, host, host, { breakPages: true, inWrapper: true, ignoreWidth: false, ignoreHeight: false });
    await document.fonts.ready;
    const sections = Array.from(host.querySelectorAll<HTMLElement>('section.docx'));
    const targets = sections.length ? sections : [host];
    if (targets.length > MAX_PAGES) throw new Error(`This Word file has more than ${MAX_PAGES} pages.`);
    const pages: HTMLCanvasElement[] = [];
    for (let i = 0; i < targets.length; i++) {
      progress(`Rendering Word page ${i + 1} of ${targets.length}…`);
      pages.push(...await htmlElementToPages(targets[i], Math.ceil(targets[i].getBoundingClientRect().width) || 816));
    }
    return await imagePagesToPdf(pages);
  } finally { host.remove(); }
}

export async function powerpointToPdf(file: File, progress: (message: string) => void): Promise<Blob> {
  const { PptxRenderer } = await import('pptx-browser');
  const renderer = new PptxRenderer();
  try {
    progress('Reading PowerPoint slides…');
    await renderer.load(file);
    if (!renderer.slideCount || renderer.slideCount > MAX_PAGES) throw new Error(`A deck must have 1–${MAX_PAGES} slides.`);
    const pages: HTMLCanvasElement[] = [];
    for (let i = 0; i < renderer.slideCount; i++) {
      progress(`Rendering slide ${i + 1} of ${renderer.slideCount}…`);
      const canvas = document.createElement('canvas');
      await renderer.renderSlide(i, canvas, 1280);
      pages.push(canvas);
    }
    return await imagePagesToPdf(pages);
  } finally { renderer.destroy(); }
}

function safeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const v = value as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
    if (v.richText) return v.richText.map((part) => part.text).join('');
    if (v.text !== undefined) return v.text;
    if (v.result !== undefined) return String(v.result);
  }
  return String(value);
}

async function spreadsheetFont(pdf: PDFDocument) {
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  pdf.registerFontkit(fontkit);
  const fontResponse = await fetch('/pdfjs/standard_fonts/LiberationSans-Regular.ttf');
  if (!fontResponse.ok) throw new Error('The local spreadsheet font could not be loaded.');
  return pdf.embedFont(await fontResponse.arrayBuffer(), { subset: true });
}

export async function excelToPdf(file: File, progress: (message: string) => void): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const pdf = await PDFDocument.create();
  const font = await spreadsheetFont(pdf);
  let pageCount = 0;
  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount === 0) continue;
    progress(`Laying out ${sheet.name}…`);
    const columns = Math.min(sheet.columnCount, 20);
    const rows = Math.min(sheet.rowCount, 5000);
    const pageWidth = 842, pageHeight = 595, margin = 34, rowHeight = 22;
    const cellWidth = (pageWidth - margin * 2) / Math.max(1, columns);
    let page = pdf.addPage([pageWidth, pageHeight]); pageCount++;
    let y = pageHeight - margin;
    const drawHeading = () => {
      page.drawText(sheet.name.slice(0, 80), { x: margin, y, size: 14, font, color: rgb(0.15, 0.15, 0.18) });
      y -= 27;
    };
    drawHeading();
    for (let rowNo = 1; rowNo <= rows; rowNo++) {
      if (y < margin + rowHeight) {
        if (pageCount >= MAX_PAGES) throw new Error(`This workbook exceeds ${MAX_PAGES} printed pages. Select smaller sheets.`);
        page = pdf.addPage([pageWidth, pageHeight]); pageCount++; y = pageHeight - margin; drawHeading();
      }
      const row = sheet.getRow(rowNo);
      for (let colNo = 1; colNo <= columns; colNo++) {
        const x = margin + (colNo - 1) * cellWidth;
        const cell = row.getCell(colNo);
        const text = safeText(cell.value).replace(/[\r\n]+/g, ' ');
        page.drawRectangle({ x, y: y - 5, width: cellWidth, height: rowHeight, borderWidth: 0.35, borderColor: rgb(0.75, 0.75, 0.78), color: rowNo === 1 ? rgb(0.94, 0.94, 0.96) : rgb(1, 1, 1) });
        if (text) {
          let cut = text;
          while (cut && font.widthOfTextAtSize(cut, 9) > cellWidth - 9) cut = cut.slice(0, -1);
          if (cut) page.drawText(cut, { x: x + 4, y: y + 2, size: 9, font, color: rgb(0.12, 0.12, 0.14) });
        }
      }
      y -= rowHeight;
    }
  }
  if (!pageCount) throw new Error('This workbook has no printable cells.');
  return new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' });
}

function cleanHtml(input: string): string {
  const doc = new DOMParser().parseFromString(input, 'text/html');
  doc.querySelectorAll('script,iframe,frame,object,embed,form,link,base,meta,video,audio,source').forEach((element) => element.remove());
  doc.querySelectorAll('*').forEach((element) => {
    for (const attr of Array.from(element.attributes)) {
      if (/^on/i.test(attr.name) || attr.name === 'srcset' || /^(src|href)$/i.test(attr.name) && !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(attr.value)) element.removeAttribute(attr.name);
      if (attr.name === 'style' && /url\s*\(|@import/i.test(attr.value)) element.removeAttribute(attr.name);
    }
  });
  doc.querySelectorAll('style').forEach((style) => { style.textContent = (style.textContent || '').replace(/@import[^;]*;?/gi, '').replace(/url\s*\([^)]*\)/gi, 'none'); });
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'"></head><body>' + doc.body.innerHTML + '</body></html>';
}

export async function htmlToPdf(file: File, progress: (message: string) => void): Promise<Blob> {
  const source = await file.text();
  if (!source.trim()) throw new Error('The HTML file is empty.');
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:816px;height:12000px;border:0';
  frame.srcdoc = cleanHtml(source);
  const loaded = new Promise<void>((resolve, reject) => { frame.onload = () => resolve(); frame.onerror = () => reject(new Error('Could not render HTML.')); });
  document.body.append(frame);
  try {
    await loaded;
    const body = frame.contentDocument?.body;
    if (!body) throw new Error('The HTML document could not be opened.');
    progress('Rendering HTML pages…');
    return await imagePagesToPdf(await htmlElementToPages(body));
  } finally { frame.remove(); }
}

export async function pdfToWord(bytes: Uint8Array, progress: (message: string) => void): Promise<Blob> {
  const { Document, Paragraph, TextRun, Packer } = await import('docx');
  const source = await openPdf(bytes);
  try {
    if (source.numPages > MAX_PAGES) throw new Error(`This PDF exceeds ${MAX_PAGES} pages.`);
    const children: InstanceType<typeof Paragraph>[] = [];
    for (let p = 1; p <= source.numPages; p++) {
      progress(`Reading page ${p} of ${source.numPages}…`);
      const { runs } = await pageTextRuns(source, p);
      const lines = runsToLines(runs);
      if (!lines.length) children.push(new Paragraph({ text: `[Page ${p} has no text layer. Run OCR PDF first.]`, pageBreakBefore: p > 1 }));
      for (let i = 0; i < lines.length; i++) {
        children.push(new Paragraph({ children: [new TextRun({ text: lines[i].text })], pageBreakBefore: p > 1 && i === 0 }));
      }
    }
    const doc = new Document({ sections: [{ children }] });
    return Packer.toBlob(doc);
  } finally { await source.loadingTask.destroy(); }
}

export async function pdfToPowerpoint(bytes: Uint8Array, progress: (message: string) => void): Promise<Blob> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const source = await openPdf(bytes);
  try {
    if (source.numPages > MAX_PAGES) throw new Error(`This PDF exceeds ${MAX_PAGES} pages.`);
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    for (let p = 1; p <= source.numPages; p++) {
      progress(`Rendering page ${p} of ${source.numPages}…`);
      const canvas = await renderPage(source, p, 1.6);
      const data = canvas.toDataURL('image/jpeg', 0.9);
      const ratio = canvas.width / canvas.height;
      const w = Math.min(13.333, 7.5 * ratio);
      const h = w / ratio;
      pptx.addSlide().addImage({ data, x: (13.333 - w) / 2, y: (7.5 - h) / 2, w, h });
      releaseCanvas(canvas);
    }
    const out = await pptx.write({ outputType: 'blob', compression: true });
    if (!(out instanceof Blob)) throw new Error('The presentation writer returned an unexpected result.');
    return out;
  } finally { await source.loadingTask.destroy(); }
}

export async function pdfToExcel(bytes: Uint8Array, progress: (message: string) => void): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const source = await openPdf(bytes);
  try {
    if (source.numPages > MAX_PAGES) throw new Error(`This PDF exceeds ${MAX_PAGES} pages.`);
    const book = new ExcelJS.Workbook();
    for (let p = 1; p <= source.numPages; p++) {
      progress(`Reading page ${p} of ${source.numPages}…`);
      const sheet = book.addWorksheet(`Page ${p}`);
      const { runs } = await pageTextRuns(source, p);
      const lines = runsToLines(runs);
      for (const line of lines) {
        // A large gap between positioned text runs usually separates table cells.
        const cells = line.text.split(/\s{3,}/).map((part) => part.trim()).filter(Boolean);
        sheet.addRow(cells);
      }
      if (!lines.length) sheet.addRow(['No text layer. Run OCR PDF first.']);
      sheet.columns = Array.from({ length: Math.max(1, Math.min(20, sheet.columnCount)) }, () => ({ width: 26 }));
    }
    const out = await book.xlsx.writeBuffer();
    return new Blob([out as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  } finally { await source.loadingTask.destroy(); }
}

export async function convertOffice(kind: ConversionKind, input: File | Uint8Array, progress: (message: string) => void): Promise<Blob> {
  if (kind === 'word-to-pdf') return wordToPdf(input as File, progress);
  if (kind === 'powerpoint-to-pdf') return powerpointToPdf(input as File, progress);
  if (kind === 'excel-to-pdf') return excelToPdf(input as File, progress);
  if (kind === 'html-to-pdf') return htmlToPdf(input as File, progress);
  if (kind === 'pdf-to-word') return pdfToWord(input as Uint8Array, progress);
  if (kind === 'pdf-to-powerpoint') return pdfToPowerpoint(input as Uint8Array, progress);
  return pdfToExcel(input as Uint8Array, progress);
}
