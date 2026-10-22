import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { editExistingText, extractPdfImagePixels, locateEditableText, protectPdf, unlockPdf } from '../features/tools/pdf/content-edit';

test('edits a PDF text object without rasterizing the page or losing a form field', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (input === '/pdfium/pdfium.wasm') return new Response(readFileSync('public/pdfium/pdfium.wasm'));
    return originalFetch(input, init);
  };
  try {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Original text', { x: 60, y: 700, size: 20, font });
    page.drawText('Untouched', { x: 60, y: 650, size: 20, font });
    const form = doc.getForm();
    const field = form.createTextField('reference');
    field.setText('AB-123');
    field.addToPage(page, { x: 60, y: 560, width: 130, height: 25 });
    const source = await doc.save();

    const target = await locateEditableText(source, 0, { x: 90, y: 705 });
    assert.ok(target);
    assert.equal(target.original, 'Original text');
    const edited = await editExistingText(source, [{ ...target, text: 'Changed text', fontSize: 24, color: '#bb3344' }]);
    const reopened = await PDFDocument.load(edited);
    assert.equal(reopened.getPageCount(), 1);
    assert.equal(reopened.getForm().getTextField('reference').getText(), 'AB-123');
    const changed = await locateEditableText(edited, 0, { x: 90, y: 705 });
    assert.equal(changed?.original, 'Changed text');
    assert.ok(Math.abs((changed?.fontSize ?? 0) - 24) < 0.2);
    assert.equal(changed?.color, '#bb3344');
    const other = await locateEditableText(edited, 0, { x: 90, y: 655 });
    assert.equal(other?.original, 'Untouched');
    await assert.rejects(() => editExistingText(source, [{ ...target, text: '日本語' }]), /font cannot display/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('protects and unlocks a PDF with the correct password', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (input === '/pdfium/pdfium.wasm') return new Response(readFileSync('public/pdfium/pdfium.wasm'));
    return originalFetch(input, init);
  };
  try {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const source = await doc.save();
    const locked = await protectPdf(source, 'sample-password');
    await assert.rejects(() => PDFDocument.load(locked));
    await assert.rejects(() => unlockPdf(locked, 'wrong-password'));
    const unlocked = await unlockPdf(locked, 'sample-password');
    assert.equal((await PDFDocument.load(unlocked)).getPageCount(), 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('extracts an embedded image at native resolution', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => input === '/pdfium/pdfium.wasm'
    ? new Response(readFileSync('public/pdfium/pdfium.wasm')) : originalFetch(input, init);
  try {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const redPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
    const image = await doc.embedPng(redPixel);
    page.drawImage(image, { x: 20, y: 20, width: 100, height: 100 });
    const extracted = await extractPdfImagePixels(await doc.save());
    assert.equal(extracted.length, 1);
    assert.equal(extracted[0].width, 1);
    assert.equal(extracted[0].height, 1);
    assert.deepEqual(Array.from(extracted[0].rgba), [255, 0, 0, 255]);
  } finally { globalThis.fetch = originalFetch; }
});
