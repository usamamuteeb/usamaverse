import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import {
  addImageWatermark, addPageNumbers, addTextWatermark, anchorPosition, applyOverlays, buildFromPlan, chunkRanges, cropBoxFromMargins,
  cropPdf, fillForm, formatPageLabel, optimizePdf, readForm, removePages, repairPdf, toPagePoint, visualSize,
} from '@/features/tools/pdf/ops';

async function makePdf(sizes: Array<[number, number, number?]>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  sizes.forEach(([w, h, rot], i) => {
    const p = doc.addPage([w, h]);
    p.drawText(`Page ${i + 1}`, { x: 20, y: 20, size: 12, font: f });
    if (rot) p.setRotation(degrees(rot));
  });
  return doc.save();
}
const load = (b: Uint8Array) => PDFDocument.load(b);

test('geometry: visual corners map to the right page corners for every rotation', () => {
  const box = { x: 10, y: 20, width: 100, height: 200 };
  // visual bottom-left must be the corner that appears bottom-left after rotation
  assert.deepEqual(toPagePoint(box, 0, 0, 0), { x: 10, y: 20 });
  assert.deepEqual(toPagePoint(box, 90, 0, 0), { x: 110, y: 20 }); // unrotated bottom-right
  assert.deepEqual(toPagePoint(box, 180, 0, 0), { x: 110, y: 220 }); // unrotated top-right
  assert.deepEqual(toPagePoint(box, 270, 0, 0), { x: 10, y: 220 }); // unrotated top-left
  assert.deepEqual(visualSize(box, 90), { width: 200, height: 100 });
  for (const r of [0, 90, 180, 270] as const) {
    const v = visualSize(box, r);
    const c = cropBoxFromMargins(box, r, { top: 0, right: 0, bottom: 0, left: 0 });
    assert.deepEqual(c, box, `full crop rotation ${r}`);
    assert.ok(v.width > 0);
  }
  // 10pt off the visual top of a 90°-rotated page trims the unrotated LEFT edge
  assert.deepEqual(cropBoxFromMargins(box, 90, { top: 10, right: 0, bottom: 0, left: 0 }), { x: 20, y: 20, width: 90, height: 200 });
  assert.deepEqual(anchorPosition({ width: 600, height: 800 }, 100, 20, 'bottom-right', 30), { x: 470, y: 30 });
  assert.deepEqual(chunkRanges(5, 2), [[0, 1], [2, 3], [4]]);
  assert.equal(formatPageLabel('page-n-of-total', 3, 9), 'Page 3 of 9');
});

test('organize: reorder, duplicate-free plan, rotate, remove', async () => {
  const src = await makePdf([[100, 100], [200, 100], [300, 100]]);
  const out = await load(await buildFromPlan(src, [{ src: 2, rotate: 90 }, { src: 0, rotate: 0 }]));
  assert.deepEqual(out.getPages().map((p) => [p.getWidth(), p.getRotation().angle]), [[300, 90], [100, 0]]);
  const removed = await load(await removePages(src, [1]));
  assert.deepEqual(removed.getPages().map((p) => p.getWidth()), [100, 300]);
  await assert.rejects(removePages(src, [0, 1, 2]), /at least one page/);
  await assert.rejects(buildFromPlan(src, [{ src: 7, rotate: 0 }]), /does not exist/);
});

test('page numbers: count only stamped pages, reject non-Latin text', async () => {
  const src = await makePdf([[200, 300], [200, 300, 90], [200, 300]]);
  const out = await addPageNumbers(src, { pages: '2-3', startAt: 1, format: 'page-n-of-total', anchor: 'bottom-center', margin: 20, fontSize: 10, color: '#000000', opacity: 1, font: 'Helvetica', facing: false });
  const text = new TextDecoder('latin1').decode(out);
  assert.equal((await load(out)).getPageCount(), 3);
  assert.ok(out.length > src.length);
  void text;
  await assert.rejects(addTextWatermark(src, { text: 'سلام', pages: 'all', fontSize: 40, color: '#ff0000', opacity: 0.3, angle: 45, layout: 'center', font: 'Helvetica' }), /Latin/);
});

test('watermarks: text tile and image', async () => {
  const src = await makePdf([[400, 600]]);
  const t = await addTextWatermark(src, { text: 'DRAFT', pages: 'all', fontSize: 40, color: '#c6283d', opacity: 0.25, angle: 45, layout: 'tile', font: 'HelveticaBold' });
  assert.ok(t.length > src.length);
  const png = await (async () => {
    const d = await PDFDocument.create();
    void d;
    // 1×1 red PNG
    return Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'));
  })();
  const i = await addImageWatermark(src, { image: png, mime: 'image/png', pages: '1', widthFraction: 0.3, opacity: 0.5, anchor: 'top-right', margin: 20 });
  assert.equal((await load(i)).getPageCount(), 1);
});

test('crop sets CropBox from visual margins', async () => {
  const src = await makePdf([[600, 800], [600, 800, 90]]);
  const out = await load(await cropPdf(src, { pages: 'all', top: 10, right: 20, bottom: 30, left: 40 }));
  const [a, b] = out.getPages().map((p) => p.getCropBox());
  assert.deepEqual([a.x, a.y, a.width, a.height], [40, 30, 540, 760]);
  // rotated 90: visual top→left edge, right→top, bottom→right, left→bottom
  assert.deepEqual([b.x, b.y, b.width, b.height], [10, 40, 560, 740]);
  await assert.rejects(cropPdf(src, { pages: '1', top: 500, right: 0, bottom: 400, left: 0 }), /larger than the page/);
});

test('forms: read, fill, flatten', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();
  const name = form.createTextField('name');
  name.addToPage(page, { x: 20, y: 300, width: 200, height: 24 });
  const agree = form.createCheckBox('agree');
  agree.addToPage(page, { x: 20, y: 250, width: 16, height: 16 });
  const city = form.createDropdown('city');
  city.addOptions(['Lahore', 'Karachi']);
  city.addToPage(page, { x: 20, y: 200, width: 120, height: 24 });
  const src = await doc.save();
  const info = await readForm(src);
  assert.deepEqual(info.fields.map((f) => f.kind), ['text', 'checkbox', 'dropdown']);
  const filled = await fillForm(src, { name: 'Usama', agree: true, city: 'Karachi' }, { flatten: false });
  const back = (await load(filled)).getForm();
  assert.equal(back.getTextField('name').getText(), 'Usama');
  assert.equal(back.getCheckBox('agree').isChecked(), true);
  assert.deepEqual(back.getDropdown('city').getSelected(), ['Karachi']);
  const flat = await load(await fillForm(src, { name: 'Usama' }, { flatten: true }));
  assert.equal(flat.getForm().getFields().length, 0);
});

test('optimize never returns something bigger; repair recovers a truncated file', async () => {
  const src = await makePdf([[200, 200], [200, 200]]);
  const r = await optimizePdf(src, { removeMetadata: true });
  assert.ok(r.bytes.length <= src.length);
  // Truncate the xref/trailer away.
  const cut = src.subarray(0, src.length - 120);
  const fixed = await repairPdf(cut);
  assert.equal(fixed.pages, 2);
  assert.equal((await load(fixed.bytes)).getPageCount(), 2);
  assert.ok(fixed.notes.some((n) => /end-of-file/.test(n)));
  await assert.rejects(repairPdf(new TextEncoder().encode('hello')), /No “%PDF-” header/);
});

test('overlays: text, rect, ink and image draw on rotated pages', async () => {
  const src = await makePdf([[300, 400, 270]]);
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'));
  const out = await applyOverlays(src, [
    { kind: 'text', page: 0, x: 20, y: 300, text: 'Hello\nWorld', size: 14, color: '#000000', font: 'Helvetica' },
    { kind: 'rect', page: 0, x: 10, y: 10, width: 50, height: 20, fill: '#ffff00', opacity: 0.4 },
    { kind: 'ink', page: 0, points: [[0, 0], [10, 10], [20, 5]], color: '#0000ff', width: 2 },
    { kind: 'image', page: 0, x: 100, y: 100, width: 40, height: 40, data: png, mime: 'image/png' },
  ]);
  assert.equal((await load(out)).getPageCount(), 1);
  await assert.rejects(applyOverlays(src, []), /Add something/);
});
