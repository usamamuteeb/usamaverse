import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { PDFDocument, degrees } from 'pdf-lib';
import { copyPages, imagesToPdf, loadPdf, mergePdfs, parsePageRanges, readInfo, rotatePdf, splitPdf, writeInfo } from '@/features/tools/files/pdf';
import { createZip, safeZipName, uniqueNames } from '@/features/tools/files/zip';
import { crc32 } from '@/features/tools/generators/security';
import { readMetadata } from '@/features/tools/image/exif';
import { buildIco, centeredCrop, clampCrop, dominantColors, fitPlan } from '@/features/tools/image/more';

async function makePdf(pages: number, title = ''): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage([200 + i, 300]);
  if (title) d.setTitle(title);
  return d.save();
}

test('page range parsing', () => {
  assert.deepEqual(parsePageRanges('1-3, 5, 8-', 9), [0, 1, 2, 4, 7, 8]);
  assert.deepEqual(parsePageRanges('3-1', 5), [2, 1, 0]);
  assert.deepEqual(parsePageRanges('last', 4), [3]);
  assert.deepEqual(parsePageRanges('', 2), [0, 1]);
  assert.deepEqual(parsePageRanges('-2', 5), [0, 1]);
  assert.throws(() => parsePageRanges('7', 5), /does not exist/);
  assert.throws(() => parsePageRanges('a-b', 5), /not a page/);
});

test('PDF merge, extract, split, rotate, metadata', async () => {
  const a = await makePdf(2);
  const b = await makePdf(3);
  const merged = await PDFDocument.load(await mergePdfs([{ name: 'a', bytes: a }, { name: 'b', bytes: b }]));
  assert.equal(merged.getPageCount(), 5);
  assert.deepEqual(merged.getPages().map((p) => p.getWidth()), [200, 201, 200, 201, 202]);
  const src = await loadPdf(b);
  const ex = await PDFDocument.load(await copyPages(src, [2, 0]));
  assert.deepEqual(ex.getPages().map((p) => p.getWidth()), [202, 200]);
  const parts = await splitPdf(b, 'ranges', '1-2; 3', 'doc');
  assert.deepEqual(parts.map((p) => p.name), ['doc-part1.pdf', 'doc-part2.pdf']);
  assert.equal((await splitPdf(b, 'each', '', 'x')).length, 3);
  const rotated = await PDFDocument.load(await rotatePdf(b, '2', 90));
  assert.deepEqual(rotated.getPages().map((p) => p.getRotation().angle), [0, 90, 0]);
  const info = await readInfo(await writeInfo(await makePdf(1, 'Old'), { title: 'New title', author: 'Me', subject: '', keywords: 'a, b', creator: '', producer: 'P', updateModified: true }));
  assert.deepEqual([info.title, info.author, info.keywords, info.producer, info.pageCount], ['New title', 'Me', 'a b', 'P', 1]);
  await assert.rejects(loadPdf(new TextEncoder().encode('hello')), /not a PDF/);
  void degrees;
});

test('images to PDF embeds JPEG at page size', async () => {
  const jpeg = Uint8Array.from(Buffer.from(readFileSync('tests/fixtures/exif-jpeg.b64', 'utf8').trim(), 'base64'));
  const out = await PDFDocument.load(await imagesToPdf([{ bytes: jpeg, mime: 'image/jpeg', width: 8, height: 4 }], { size: 'a4', marginPt: 36, orientation: 'auto' }));
  assert.equal(out.getPageCount(), 1);
  assert.equal(Math.round(out.getPage(0).getWidth()), 842); // landscape A4 for a wide image
});

test('ZIP writer: stored and deflated entries round-trip', async () => {
  const enc = new TextEncoder();
  const big = enc.encode('hello world '.repeat(500));
  const { bytes, deflated } = await createZip([{ name: 'a/../b.txt', data: big, date: new Date(2026, 9, 19, 10, 30, 0) }, { name: 'ünï.txt', data: enc.encode('x') }], { compress: true });
  assert.equal(deflated, 1);
  const v = new DataView(bytes.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  const nameLen = v.getUint16(26, true);
  assert.equal(new TextDecoder().decode(bytes.subarray(30, 30 + nameLen)), 'a/b.txt');
  const compSize = v.getUint32(18, true);
  const data = inflateRawSync(bytes.subarray(30 + nameLen, 30 + nameLen + compSize));
  assert.equal(crc32(new Uint8Array(data)), v.getUint32(14, true));
  assert.equal(new TextDecoder().decode(data), 'hello world '.repeat(500));
  assert.equal(v.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(v.getUint16(bytes.length - 22 + 10, true), 2);
  assert.equal(safeZipName('../../etc/passwd'), 'etc/passwd');
  assert.equal(safeZipName('C:\\x\\y?.txt'), 'C_/x/y_.txt');
  assert.deepEqual(uniqueNames(['a.txt', 'A.txt', 'a.txt']), ['a.txt', 'A (2).txt', 'a (3).txt']);
});

test('EXIF reader: camera, orientation, GPS', () => {
  const buf = Buffer.from(readFileSync('tests/fixtures/exif-jpeg.b64', 'utf8').trim(), 'base64');
  const m = readMetadata(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const get = (t: string) => m.entries.find((e) => e.tag === t)?.value;
  assert.equal(m.format, 'JPEG');
  assert.equal(m.orientation, 6);
  assert.equal(get('Camera make'), 'TestCam');
  assert.equal(get('Exposure time'), '1/250 s');
  assert.equal(get('F-number'), 'f/2.8');
  assert.equal(get('ISO'), '400');
  assert.equal(get('Date/time original'), '2026:10:19 09:30:00');
  assert.equal(get('Location'), '31.521667, 74.350000');
  assert.ok(m.entries.find((e) => e.tag === 'Location')!.sensitive);
});

test('ICO builder and image geometry', () => {
  const ico = buildIco([{ size: 16, bytes: new Uint8Array([1, 2, 3]) }, { size: 256, bytes: new Uint8Array([4]) }]);
  const v = new DataView(ico.buffer);
  assert.deepEqual([v.getUint16(2, true), v.getUint16(4, true), ico[6], ico[22], v.getUint32(6 + 12, true), v.getUint32(22 + 12, true)], [1, 2, 16, 0, 38, 41]);
  assert.deepEqual(centeredCrop(400, 200, 1, 1), { x: 100, y: 0, w: 200, h: 200 });
  assert.deepEqual(clampCrop({ x: -5, y: 10, w: 999, h: 50 }, 100, 40), { x: 0, y: 10, w: 100, h: 30 });
  assert.deepEqual(fitPlan(400, 200, 100, 100, 'contain'), { sx: 0, sy: 0, sw: 400, sh: 200, dx: 0, dy: 25, dw: 100, dh: 50 });
  assert.deepEqual(fitPlan(400, 200, 100, 100, 'cover'), { sx: 100, sy: 0, sw: 200, sh: 200, dx: 0, dy: 0, dw: 100, dh: 100 });
  const px = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255, 250, 2, 2, 255, 0, 0, 255, 255, 0, 0, 0, 0]);
  const dom = dominantColors(px, 4);
  assert.equal(dom.length, 2);
  assert.equal(dom[0].share, 0.75);
});
