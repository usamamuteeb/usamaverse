import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { addOcrTextLayer } from '../features/tools/pdf/ocr-layer';

test('OCR layer preserves original PDF page and form field', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  const field = doc.getForm().createTextField('reference');
  field.setText('AB-123');
  field.addToPage(page, { x: 20, y: 20, width: 100, height: 20 });
  const original = await doc.save();
  const result = await addOcrTextLayer(original, [{
    pageIndex: 0, imageWidth: 400, imageHeight: 400,
    words: [{ text: 'Scanned', confidence: 95, bbox: { x0: 40, y0: 60, x1: 170, y1: 92 } }],
  }]);
  assert.equal(result.added, 1);
  const reopened = await PDFDocument.load(result.bytes);
  assert.equal(reopened.getPageCount(), 1);
  assert.equal(reopened.getForm().getTextField('reference').getText(), 'AB-123');
  assert.ok(result.bytes.length > original.length);
});
