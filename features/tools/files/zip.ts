/**
 * Minimal ZIP writer (PKZIP 2.0, no ZIP64): stored or Deflate via the browser's
 * CompressionStream('deflate-raw') when available. UTF-8 file names.
 */
import { crc32 } from '@/features/tools/generators/security';

export interface ZipInput {
  name: string;
  data: Uint8Array;
  date?: Date;
}

export const ZIP_MAX_TOTAL = 1024 * 1024 * 1024; // 1 GiB in memory

export function safeZipName(name: string): string {
  const parts = name.replace(/\\/g, '/').split('/').filter((p) => p && p !== '.' && p !== '..');
  const cleaned = parts.map((p) => p.replace(/[\u0000-\u001f<>:"|?*]/g, '_')).join('/');
  return cleaned || 'file';
}

export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const key = n.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (!count) return n;
    const dot = n.lastIndexOf('.');
    const candidate = dot > 0 ? `${n.slice(0, dot)} (${count + 1})${n.slice(dot)}` : `${n} (${count + 1})`;
    seen.set(candidate.toLowerCase(), 1);
    return candidate;
  });
}

export function canDeflate(): boolean {
  try {
    new CompressionStream('deflate-raw' as CompressionFormat);
    return true;
  } catch {
    return false;
  }
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw' as CompressionFormat);
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function dosDateTime(d: Date): { time: number; date: number } {
  const y = Math.max(1980, Math.min(2107, d.getFullYear()));
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export async function createZip(files: ZipInput[], o: { compress: boolean }): Promise<{ bytes: Uint8Array; stored: number; deflated: number }> {
  if (!files.length) throw new Error('Add at least one file.');
  if (files.length > 65535) throw new Error('A ZIP without ZIP64 can hold at most 65,535 files.');
  const total = files.reduce((n, f) => n + f.data.length, 0);
  if (total > ZIP_MAX_TOTAL) throw new Error('Total size is over 1 GiB, which is too much to build in browser memory.');
  const deflate = o.compress && canDeflate();
  const names = uniqueNames(files.map((f) => safeZipName(f.name)));
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  let stored = 0;
  let deflated = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const nameBytes = enc.encode(names[i]);
    const crc = crc32(f.data);
    let body = f.data;
    let method = 0;
    if (deflate && f.data.length > 0) {
      const c = await deflateRaw(f.data);
      if (c.length < f.data.length) {
        body = c;
        method = 8;
      }
    }
    if (method === 8) deflated++;
    else stored++;
    if (offset + 30 + nameBytes.length + body.length > 0xffffffff) throw new Error('The archive would exceed 4 GiB.');
    const { time, date } = dosDateTime(f.date ?? new Date());
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, method, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, body);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 0x0314, true); // made by: Unix, 2.0
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, method, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, body.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(38, (0o100644 << 16) >>> 0, true); // regular file, rw-r--r--
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const c of parts) {
    out.set(c, p);
    p += c.length;
  }
  return { bytes: out, stored, deflated };
}
