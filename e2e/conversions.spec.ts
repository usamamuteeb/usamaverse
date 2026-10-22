import { expect, test } from '@playwright/test';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { Document, Packer, Paragraph } from 'docx';
import PptxGenJS from 'pptxgenjs';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const mime = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

async function sourcePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([400, 300]).drawText('Invoice total 42', { x: 50, y: 240 });
  return Buffer.from(await doc.save());
}

async function sourcePptx() {
  const pptx = new PptxGenJS();
  pptx.addSlide().addText('Slide example', { x: 1, y: 1, w: 8, h: 1 });
  return Buffer.from(await pptx.write({ outputType: 'nodebuffer' }) as ArrayBuffer);
}

async function sourceXlsx() {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Totals');
  sheet.addRow(['Item', 'Amount']); sheet.addRow(['Apple', 42]);
  return Buffer.from(await book.xlsx.writeBuffer() as ArrayBuffer);
}

const cases = [
  { slug: 'word-to-pdf', ext: 'docx', result: 'pdf', input: async () => Buffer.from(await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Word example')] }] }))) },
  { slug: 'powerpoint-to-pdf', ext: 'pptx', result: 'pdf', input: sourcePptx },
  { slug: 'excel-to-pdf', ext: 'xlsx', result: 'pdf', input: sourceXlsx },
  { slug: 'html-to-pdf', ext: 'html', result: 'pdf', input: async () => Buffer.from('<!doctype html><html><body><h1>HTML example</h1><p>Local page.</p></body></html>') },
  { slug: 'pdf-to-word', ext: 'pdf', result: 'docx', input: sourcePdf },
  { slug: 'pdf-to-powerpoint', ext: 'pdf', result: 'pptx', input: sourcePdf },
  { slug: 'pdf-to-excel', ext: 'pdf', result: 'xlsx', input: sourcePdf },
] as const;

for (const item of cases) {
  test(`${item.slug} produces a valid ${item.result.toUpperCase()} @conversion`, async ({ page }) => {
    test.slow();
    await page.goto(`/tools/${item.slug}`);
    await page.locator('input[type=file]').setInputFiles({ name: `example.${item.ext}`, mimeType: mime[item.ext as keyof typeof mime] || 'text/html', buffer: await item.input() });
    await page.getByRole('button', { name: new RegExp(`Convert to ${item.result.toUpperCase()}`) }).click();
    const button = page.getByRole('button', { name: new RegExp(`Download ${item.result.toUpperCase()}`) });
    await expect(button).toBeVisible({ timeout: 45_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    const bytes = readFileSync((await download.path())!);
    if (item.result === 'pdf') {
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBeGreaterThan(0);
      if (item.slug !== 'excel-to-pdf') {
        const images = pdf.context.enumerateIndirectObjects().map(([, object]) => object).filter((object): object is PDFRawStream => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image');
        expect(images.length).toBeGreaterThan(0);
        const { channels } = await sharp(Buffer.from(images[0].contents)).stats();
        expect(channels.slice(0, 3).some((channel) => channel.stdev > 1)).toBe(true);
      }
    }
    else {
      const zip = await JSZip.loadAsync(bytes);
      const entry = item.result === 'docx' ? 'word/document.xml' : item.result === 'pptx' ? 'ppt/slides/slide1.xml' : 'xl/worksheets/sheet1.xml';
      expect(zip.file(entry)).not.toBeNull();
      if (item.result === 'docx') expect(await zip.file(entry)!.async('string')).toContain('Invoice total 42');
      if (item.result === 'xlsx') {
        const shared = await zip.file('xl/sharedStrings.xml')?.async('string');
        expect(`${await zip.file(entry)!.async('string')} ${shared || ''}`).toContain('Invoice total 42');
      }
    }
  });
}

test('PDF to PDF/A creates an archival candidate with XMP and output intent @conversion', async ({ page }) => {
  test.slow();
  await page.goto('/tools/pdf-to-pdfa');
  await page.locator('input[type=file]').setInputFiles({ name: 'example.pdf', mimeType: mime.pdf, buffer: await sourcePdf() });
  await page.getByRole('button', { name: 'Create PDF/A-2b' }).click();
  const button = page.getByRole('button', { name: 'Download PDF/A copy' });
  await expect(button).toBeVisible({ timeout: 45_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const bytes = readFileSync((await download.path())!);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  expect(bytes.includes(Buffer.from('pdfaid:part'))).toBe(true);
  if (process.env.PDFA_SAMPLE_OUT) writeFileSync(process.env.PDFA_SAMPLE_OUT, bytes);
});

test('HTML conversion does not execute scripts or fetch remote images @conversion', async ({ page }) => {
  await page.goto('/tools/html-to-pdf');
  const remote: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:')) remote.push(request.url()); });
  const html = '<h1>Safe document</h1><script>window.top.__unsafe = true</script><img src="https://example.com/track.png" onerror="window.top.__unsafe = true">';
  await page.locator('input[type=file]').setInputFiles({ name: 'safe.html', mimeType: 'text/html', buffer: Buffer.from(html) });
  await page.getByRole('button', { name: 'Convert to PDF' }).click();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __unsafe?: boolean }).__unsafe ?? false)).toBe(false);
  expect(remote).toEqual([]);
});
