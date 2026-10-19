/**
 * Read-only metadata reader for JPEG (APP1 Exif), PNG (eXIf, tEXt/iTXt) and WebP (EXIF chunk).
 * Parses TIFF IFD0, the Exif sub-IFD and the GPS IFD. Unknown tags are listed by number.
 */
export interface MetaEntry {
  group: 'Image' | 'Camera' | 'GPS' | 'Text' | 'File';
  tag: string;
  value: string;
  sensitive?: boolean;
}

const TAGS: Record<number, [string, MetaEntry['group']]> = {
  0x010e: ['Image description', 'Image'], 0x010f: ['Camera make', 'Camera'], 0x0110: ['Camera model', 'Camera'], 0x0112: ['Orientation', 'Image'],
  0x011a: ['X resolution', 'Image'], 0x011b: ['Y resolution', 'Image'], 0x0128: ['Resolution unit', 'Image'], 0x0131: ['Software', 'Image'],
  0x0132: ['Date/time modified', 'Image'], 0x013b: ['Artist', 'Image'], 0x8298: ['Copyright', 'Image'],
  0x829a: ['Exposure time', 'Camera'], 0x829d: ['F-number', 'Camera'], 0x8822: ['Exposure program', 'Camera'], 0x8827: ['ISO', 'Camera'],
  0x9003: ['Date/time original', 'Camera'], 0x9004: ['Date/time digitized', 'Camera'], 0x9010: ['Time zone offset', 'Camera'],
  0x9201: ['Shutter speed (APEX)', 'Camera'], 0x9202: ['Aperture (APEX)', 'Camera'], 0x9204: ['Exposure bias', 'Camera'],
  0x9207: ['Metering mode', 'Camera'], 0x9209: ['Flash', 'Camera'], 0x920a: ['Focal length', 'Camera'], 0xa002: ['Pixel width', 'Image'],
  0xa003: ['Pixel height', 'Image'], 0xa405: ['Focal length (35mm)', 'Camera'], 0xa430: ['Camera owner', 'Camera'],
  0xa431: ['Body serial number', 'Camera'], 0xa433: ['Lens make', 'Camera'], 0xa434: ['Lens model', 'Camera'], 0xa435: ['Lens serial number', 'Camera'],
  0xa001: ['Color space', 'Image'], 0xa403: ['White balance', 'Camera'],
};
const GPS_TAGS: Record<number, string> = { 1: 'Latitude ref', 2: 'Latitude', 3: 'Longitude ref', 4: 'Longitude', 5: 'Altitude ref', 6: 'Altitude', 7: 'Time (UTC)', 29: 'Date', 17: 'Image direction' };
const SENSITIVE = new Set(['Camera owner', 'Body serial number', 'Lens serial number', 'Artist']);
const ORIENT = ['', 'Normal', 'Mirrored horizontally', 'Rotated 180°', 'Mirrored vertically', 'Mirrored + rotated 90° CCW', 'Rotated 90° CW', 'Mirrored + rotated 90° CW', 'Rotated 90° CCW'];

type Raw = number | string | number[] | Array<[number, number]>;

function readIfd(view: DataView, tiff: number, offset: number, le: boolean): Map<number, Raw> {
  const out = new Map<number, Raw>();
  if (offset + 2 > view.byteLength - tiff) return out;
  const count = view.getUint16(tiff + offset, le);
  if (count > 1000) return out;
  for (let i = 0; i < count; i++) {
    const e = tiff + offset + 2 + i * 12;
    if (e + 12 > view.byteLength) break;
    const tag = view.getUint16(e, le);
    const type = view.getUint16(e + 2, le);
    const n = view.getUint32(e + 4, le);
    const size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 } as Record<number, number>)[type];
    if (!size || n > 100_000) continue;
    const ptr = size * n > 4 ? tiff + view.getUint32(e + 8, le) : e + 8;
    if (ptr + size * n > view.byteLength) continue;
    let val: Raw;
    if (type === 2) {
      let s = '';
      for (let k = 0; k < n; k++) {
        const c = view.getUint8(ptr + k);
        if (!c) break;
        s += String.fromCharCode(c);
      }
      val = s.trim();
    } else if (type === 5 || type === 10) {
      const arr: Array<[number, number]> = [];
      for (let k = 0; k < n; k++) arr.push(type === 5 ? [view.getUint32(ptr + k * 8, le), view.getUint32(ptr + k * 8 + 4, le)] : [view.getInt32(ptr + k * 8, le), view.getInt32(ptr + k * 8 + 4, le)]);
      val = arr;
    } else {
      const arr: number[] = [];
      for (let k = 0; k < Math.min(n, 64); k++) {
        const p = ptr + k * size;
        arr.push(type === 3 ? view.getUint16(p, le) : type === 4 ? view.getUint32(p, le) : type === 9 ? view.getInt32(p, le) : view.getUint8(p));
      }
      val = arr.length === 1 ? arr[0] : arr;
    }
    out.set(tag, val);
  }
  return out;
}

const rat = (r: [number, number]) => (r[1] ? r[0] / r[1] : 0);

function fmt(tag: number, v: Raw): string {
  if (tag === 0x0112 && typeof v === 'number') return `${v} — ${ORIENT[v] ?? 'unknown'}`;
  if (tag === 0x829a && Array.isArray(v) && Array.isArray(v[0])) {
    const t = rat(v[0] as [number, number]);
    return t > 0 && t < 1 ? `1/${Math.round(1 / t)} s` : `${t} s`;
  }
  if (tag === 0x829d && Array.isArray(v) && Array.isArray(v[0])) return `f/${rat(v[0] as [number, number]).toFixed(1)}`;
  if (tag === 0x920a && Array.isArray(v) && Array.isArray(v[0])) return `${rat(v[0] as [number, number]).toFixed(1)} mm`;
  if (tag === 0x9209 && typeof v === 'number') return v & 1 ? 'Fired' : 'Did not fire';
  if (Array.isArray(v)) {
    if (Array.isArray(v[0])) return (v as Array<[number, number]>).map((r) => +rat(r).toFixed(4)).join(', ');
    if (v.length > 16) return `${v.length} bytes`;
    return (v as number[]).join(', ');
  }
  return String(v);
}

function dms(v: Raw | undefined, ref: Raw | undefined): number | null {
  if (!Array.isArray(v) || v.length < 3 || !Array.isArray(v[0])) return null;
  const [d, m, s] = (v as Array<[number, number]>).map(rat);
  const sign = ref === 'S' || ref === 'W' ? -1 : 1;
  return sign * (d + m / 60 + s / 3600);
}

export function parseTiff(view: DataView, tiff: number): MetaEntry[] {
  const entries: MetaEntry[] = [];
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return entries;
  const le = order === 0x4949;
  if (view.getUint16(tiff + 2, le) !== 42) return entries;
  const ifd0 = readIfd(view, tiff, view.getUint32(tiff + 4, le), le);
  const push = (map: Map<number, Raw>) =>
    map.forEach((v, tag) => {
      if (tag === 0x8769 || tag === 0x8825 || tag === 0xa005) return;
      const known = TAGS[tag];
      if (!known) return;
      entries.push({ group: known[1], tag: known[0], value: fmt(tag, v), sensitive: SENSITIVE.has(known[0]) });
    });
  push(ifd0);
  const exifPtr = ifd0.get(0x8769);
  if (typeof exifPtr === 'number') push(readIfd(view, tiff, exifPtr, le));
  const gpsPtr = ifd0.get(0x8825);
  if (typeof gpsPtr === 'number') {
    const gps = readIfd(view, tiff, gpsPtr, le);
    const lat = dms(gps.get(2), gps.get(1));
    const lon = dms(gps.get(4), gps.get(3));
    if (lat !== null && lon !== null) entries.push({ group: 'GPS', tag: 'Location', value: `${lat.toFixed(6)}, ${lon.toFixed(6)}`, sensitive: true });
    gps.forEach((v, tag) => {
      if ([1, 2, 3, 4].includes(tag) || !GPS_TAGS[tag]) return;
      entries.push({ group: 'GPS', tag: GPS_TAGS[tag], value: fmt(tag, v), sensitive: true });
    });
  }
  return entries;
}

export function readMetadata(buf: ArrayBuffer): { format: string; entries: MetaEntry[]; orientation: number | null } {
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const entries: MetaEntry[] = [];
  let format = 'unknown';
  if (u8[0] === 0xff && u8[1] === 0xd8) {
    format = 'JPEG';
    let p = 2;
    while (p + 4 < u8.length && u8[p] === 0xff) {
      const marker = u8[p + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const len = view.getUint16(p + 2);
      if (marker === 0xe1 && String.fromCharCode(...u8.subarray(p + 4, p + 10)) === 'Exif\0\0') entries.push(...parseTiff(view, p + 10));
      if (marker === 0xfe) entries.push({ group: 'Text', tag: 'JPEG comment', value: new TextDecoder().decode(u8.subarray(p + 4, p + 2 + len)) });
      if (marker >= 0xc0 && marker <= 0xc3) entries.push({ group: 'File', tag: 'Encoded size', value: `${view.getUint16(p + 7)} × ${view.getUint16(p + 5)} px` });
      p += 2 + len;
    }
  } else if (u8[0] === 0x89 && u8[1] === 0x50) {
    format = 'PNG';
    let p = 8;
    while (p + 8 <= u8.length) {
      const len = view.getUint32(p);
      const type = String.fromCharCode(...u8.subarray(p + 4, p + 8));
      const data = u8.subarray(p + 8, p + 8 + len);
      if (type === 'IHDR') entries.push({ group: 'File', tag: 'Dimensions', value: `${view.getUint32(p + 8)} × ${view.getUint32(p + 12)} px, ${data[8]}-bit, color type ${data[9]}` });
      if (type === 'eXIf') entries.push(...parseTiff(view, p + 8));
      if (type === 'tEXt') {
        const z = data.indexOf(0);
        entries.push({ group: 'Text', tag: new TextDecoder('latin1').decode(data.subarray(0, z)), value: new TextDecoder('latin1').decode(data.subarray(z + 1)).slice(0, 500) });
      }
      if (type === 'iTXt') {
        const z = data.indexOf(0);
        const key = new TextDecoder().decode(data.subarray(0, z));
        const compressed = data[z + 1] === 1;
        let q = z + 3;
        q = data.indexOf(0, q) + 1;
        q = data.indexOf(0, q) + 1;
        entries.push({ group: 'Text', tag: key, value: compressed ? '(compressed text)' : new TextDecoder().decode(data.subarray(q)).slice(0, 500) });
      }
      if (type === 'pHYs' && data[8] === 1) entries.push({ group: 'Image', tag: 'Pixel density', value: `${Math.round(view.getUint32(p + 8) * 0.0254)} DPI` });
      if (type === 'IEND') break;
      p += 12 + len;
    }
  } else if (String.fromCharCode(...u8.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...u8.subarray(8, 12)) === 'WEBP') {
    format = 'WebP';
    let p = 12;
    while (p + 8 <= u8.length) {
      const type = String.fromCharCode(...u8.subarray(p, p + 4));
      const len = view.getUint32(p + 4, true);
      if (type === 'EXIF') {
        const start = String.fromCharCode(...u8.subarray(p + 8, p + 14)) === 'Exif\0\0' ? p + 14 : p + 8;
        entries.push(...parseTiff(view, start));
      }
      if (type === 'XMP ') entries.push({ group: 'Text', tag: 'XMP metadata', value: `${len} bytes` });
      p += 8 + len + (len % 2);
    }
  }
  const o = entries.find((e) => e.tag === 'Orientation');
  return { format, entries, orientation: o ? Number(o.value.split(' ')[0]) : null };
}
