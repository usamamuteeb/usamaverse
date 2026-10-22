import { PDFDocument, StandardFonts } from 'pdf-lib';

export type OcrWord = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
export type OcrPage = { pageIndex: number; imageWidth: number; imageHeight: number; words: OcrWord[] };

/** Adds invisible searchable text at OCR word positions to the original PDF pages. */
export async function addOcrTextLayer(bytes: Uint8Array, recognized: OcrPage[]): Promise<{ bytes: Uint8Array; added: number; unsupported: number }> {
  if (!recognized.length) throw new Error('No pages were recognized.');
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let added = 0;
  let unsupported = 0;
  for (const result of recognized) {
    const page = doc.getPage(result.pageIndex);
    if (!page) throw new Error(`Page ${result.pageIndex + 1} does not exist.`);
    const { width, height } = page.getSize();
    const scaleX = width / result.imageWidth;
    const scaleY = height / result.imageHeight;
    for (const word of result.words) {
      const value = word.text.normalize('NFKC').replace(/[\r\n\t\0]/g, ' ').trim();
      if (!value || word.confidence < 25 || value.length > 200) continue;
      try { font.encodeText(value); }
      catch { unsupported++; continue; }
      const box = word.bbox;
      const x = Math.max(0, box.x0 * scaleX);
      const y = Math.max(0, height - box.y1 * scaleY);
      const size = Math.max(3, Math.min(72, (box.y1 - box.y0) * scaleY * 0.9));
      if (![x, y, size].every(Number.isFinite) || x > width || y > height) continue;
      page.drawText(value, { x, y, size, font, opacity: 0 });
      added++;
    }
  }
  if (!added) throw new Error('OCR found no text that could be added to the PDF. Try a clearer scan.');
  return { bytes: await doc.save(), added, unsupported };
}
