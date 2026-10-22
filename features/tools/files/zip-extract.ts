import { crc32 } from '@/features/tools/generators/security';

export interface ZipEntry { name: string; size: number; packed: number; method: 0 | 8; crc: number; offset: number }
export const ZIP_LIMITS = { archive: 100 * 1024 * 1024, total: 250 * 1024 * 1024, entry: 100 * 1024 * 1024, count: 1000, ratio: 200 };
const decoder = new TextDecoder('utf-8', { fatal: true });

export function inspectZip(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length > ZIP_LIMITS.archive) throw new Error('ZIP exceeds the 100 MB browser limit.');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50 && i + 22 + v.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new Error('Could not find a valid ZIP directory.');
  if (v.getUint16(end + 4, true) || v.getUint16(end + 6, true)) throw new Error('Multi-disk ZIP archives are not supported.');
  const count = v.getUint16(end + 10, true);
  if (count > ZIP_LIMITS.count) throw new Error('ZIP contains more than 1,000 entries.');
  const cdSize = v.getUint32(end + 12, true);
  const cdOffset = v.getUint32(end + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new Error('ZIP64 archives are not supported.');
  if (cdOffset + cdSize > end) throw new Error('ZIP directory is out of bounds.');
  const entries: ZipEntry[] = [];
  let total = 0;
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || v.getUint32(p, true) !== 0x02014b50) throw new Error('Damaged ZIP directory.');
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const packed = v.getUint32(p + 20, true);
    const size = v.getUint32(p + 24, true);
    const crc = v.getUint32(p + 16, true);
    const nameLength = v.getUint16(p + 28, true);
    const extraLength = v.getUint16(p + 30, true);
    const commentLength = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    if (p + 46 + nameLength + extraLength + commentLength > end) throw new Error('Damaged ZIP entry.');
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    p += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    if ((flags & 1) !== 0) throw new Error('Password-encrypted ZIP entries are not supported.');
    if (method !== 0 && method !== 8) throw new Error(`Unsupported compression method ${method}.`);
    if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name) || /(^|[\\/])\.\.([\\/]|$)/.test(name) || /[\u0000-\u001f]/.test(name)) throw new Error('Unsafe ZIP entry path.');
    if (size > ZIP_LIMITS.entry || size > Math.max(1, packed) * ZIP_LIMITS.ratio) throw new Error('ZIP entry exceeds extraction size or compression-ratio limits.');
    total += size;
    if (total > ZIP_LIMITS.total) throw new Error('ZIP would expand beyond the 250 MB limit.');
    entries.push({ name, size, packed, method: method as 0 | 8, crc, offset });
  }
  if (p !== cdOffset + cdSize) throw new Error('ZIP directory length does not match its header.');
  return entries;
}

export async function extractZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const p = entry.offset;
  if (p + 30 > bytes.length || v.getUint32(p, true) !== 0x04034b50) throw new Error('Damaged local file header.');
  const start = p + 30 + v.getUint16(p + 26, true) + v.getUint16(p + 28, true);
  if (start + entry.packed > bytes.length) throw new Error('Compressed data is out of bounds.');
  const data = bytes.subarray(start, start + entry.packed);
  let output: Uint8Array;
  if (entry.method === 0) output = data.slice();
  else {
    let ds: DecompressionStream;
    try { ds = new DecompressionStream('deflate-raw' as CompressionFormat); }
    catch { throw new Error('This browser cannot decompress ZIP files.'); }
    const reader = new Blob([data as BlobPart]).stream().pipeThrough(ds).getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > entry.size || length > ZIP_LIMITS.entry) { await reader.cancel(); throw new Error('ZIP expanded beyond its declared size.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    output = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) { output.set(chunk, at); at += chunk.length; }
  }
  if (output.length !== entry.size || crc32(output) !== entry.crc) throw new Error('Extracted data failed size or CRC verification.');
  return output;
}
