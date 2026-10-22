import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createZip } from '../features/tools/files/zip';
import { extractZipEntry, inspectZip } from '../features/tools/files/zip-extract';

test('ZIP extractor reads stored and deflated files, then verifies CRC', async () => {
  const enc = new TextEncoder();
  const source = await createZip([{ name: 'notes.txt', data: enc.encode('hello') }, { name: 'repeat.txt', data: enc.encode('a'.repeat(1000)) }], { compress: true });
  const entries = inspectZip(source.bytes);
  assert.equal(entries.length, 2);
  assert.equal(new TextDecoder().decode(await extractZipEntry(source.bytes, entries[0])), 'hello');
  assert.equal(new TextDecoder().decode(await extractZipEntry(source.bytes, entries[1])), 'a'.repeat(1000));
  const damaged = source.bytes.slice();
  damaged[39] ^= 1;
  await assert.rejects(extractZipEntry(damaged, entries[0]), /CRC/);
});

test('ZIP extractor rejects traversal paths before extraction', async () => {
  const zip = await createZip([{ name: 'safe.txt', data: new TextEncoder().encode('a') }], { compress: false });
  const damaged = zip.bytes.slice();
  const offset = damaged.findIndex((_, i) => i > 35 && damaged[i] === 0x50 && damaged[i + 1] === 0x4b && damaged[i + 2] === 1 && damaged[i + 3] === 2);
  assert.ok(offset > 0);
  damaged.set(new TextEncoder().encode('../e.txt'), offset + 46);
  assert.throws(() => inspectZip(damaged), /Unsafe ZIP entry path/);
});
