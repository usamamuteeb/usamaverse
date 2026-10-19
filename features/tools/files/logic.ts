export interface SignatureMatch {
  label: string;
  mime: string;
  extensions: string[];
  note?: string;
}

const ascii = (b: Uint8Array, off: number, s: string) => s.split('').every((c, i) => b[off + i] === c.charCodeAt(0));
const bytes = (b: Uint8Array, off: number, sig: number[]) => sig.every((x, i) => b[off + i] === x);

export function detectSignature(b: Uint8Array): SignatureMatch | null {
  if (bytes(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { label: 'PNG image', mime: 'image/png', extensions: ['png'] };
  if (bytes(b, 0, [0xff, 0xd8, 0xff])) return { label: 'JPEG image', mime: 'image/jpeg', extensions: ['jpg', 'jpeg', 'jfif'] };
  if (ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a')) return { label: 'GIF image', mime: 'image/gif', extensions: ['gif'] };
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return { label: 'WebP image', mime: 'image/webp', extensions: ['webp'] };
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE')) return { label: 'WAV audio', mime: 'audio/wav', extensions: ['wav'] };
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'AVI ')) return { label: 'AVI video', mime: 'video/x-msvideo', extensions: ['avi'] };
  if (ascii(b, 0, '%PDF-')) return { label: 'PDF document', mime: 'application/pdf', extensions: ['pdf'] };
  if (bytes(b, 0, [0x50, 0x4b, 0x03, 0x04]) || bytes(b, 0, [0x50, 0x4b, 0x05, 0x06]) || bytes(b, 0, [0x50, 0x4b, 0x07, 0x08]))
    return { label: 'ZIP archive', mime: 'application/zip', extensions: ['zip', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'epub', 'jar', 'apk'], note: 'Office documents (DOCX/XLSX/PPTX), EPUB, JAR and APK files are ZIP containers too.' };
  if (bytes(b, 0, [0x1f, 0x8b])) return { label: 'GZIP compressed data', mime: 'application/gzip', extensions: ['gz', 'tgz'] };
  if (bytes(b, 0, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return { label: '7-Zip archive', mime: 'application/x-7z-compressed', extensions: ['7z'] };
  if (ascii(b, 0, 'Rar!\x1a\x07')) return { label: 'RAR archive', mime: 'application/vnd.rar', extensions: ['rar'] };
  if (bytes(b, 0, [0x42, 0x5a, 0x68])) return { label: 'BZIP2 compressed data', mime: 'application/x-bzip2', extensions: ['bz2'] };
  if (bytes(b, 0, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])) return { label: 'XZ compressed data', mime: 'application/x-xz', extensions: ['xz'] };
  if (ascii(b, 4, 'ftyp')) {
    const brand = String.fromCharCode(...b.subarray(8, 12));
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return { label: 'HEIF/HEIC image', mime: 'image/heic', extensions: ['heic', 'heif'] };
    if (brand === 'avif' || brand === 'avis') return { label: 'AVIF image', mime: 'image/avif', extensions: ['avif'] };
    if (brand === 'qt  ') return { label: 'QuickTime video', mime: 'video/quicktime', extensions: ['mov'] };
    if (brand.startsWith('M4A')) return { label: 'MPEG-4 audio', mime: 'audio/mp4', extensions: ['m4a'] };
    if (brand.startsWith('3g')) return { label: '3GPP media', mime: 'video/3gpp', extensions: ['3gp', '3g2'] };
    return { label: 'MPEG-4 media', mime: 'video/mp4', extensions: ['mp4', 'm4v', 'm4a'], note: `Brand “${brand.trim()}”.` };
  }
  if (bytes(b, 0, [0x1a, 0x45, 0xdf, 0xa3])) return { label: 'Matroska / WebM media', mime: 'video/webm', extensions: ['webm', 'mkv', 'mka'] };
  if (ascii(b, 0, 'ID3')) return { label: 'MP3 audio (ID3 tag)', mime: 'audio/mpeg', extensions: ['mp3'] };
  if (b[0] === 0xff && b.length > 1 && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) return { label: 'MPEG audio frame (likely MP3/AAC)', mime: 'audio/mpeg', extensions: ['mp3', 'aac'] };
  if (ascii(b, 0, 'OggS')) return { label: 'Ogg container', mime: 'audio/ogg', extensions: ['ogg', 'oga', 'ogv', 'opus'] };
  if (ascii(b, 0, 'fLaC')) return { label: 'FLAC audio', mime: 'audio/flac', extensions: ['flac'] };
  if (ascii(b, 0, 'MThd')) return { label: 'MIDI file', mime: 'audio/midi', extensions: ['mid', 'midi'] };
  if (ascii(b, 0, 'BM') && b.length >= 14) return { label: 'BMP image', mime: 'image/bmp', extensions: ['bmp'] };
  if (bytes(b, 0, [0x00, 0x00, 0x01, 0x00])) return { label: 'ICO icon', mime: 'image/x-icon', extensions: ['ico'] };
  if (ascii(b, 0, 'II*\0') || ascii(b, 0, 'MM\0*')) return { label: 'TIFF image', mime: 'image/tiff', extensions: ['tif', 'tiff', 'dng', 'nef', 'cr2'], note: 'Many camera RAW formats are TIFF-based.' };
  if (ascii(b, 0, '8BPS')) return { label: 'Photoshop document', mime: 'image/vnd.adobe.photoshop', extensions: ['psd'] };
  if (bytes(b, 0, [0x7f, 0x45, 0x4c, 0x46])) return { label: 'ELF executable (Linux/Unix)', mime: 'application/x-elf', extensions: ['', 'so', 'o', 'elf'] };
  if (ascii(b, 0, 'MZ')) return { label: 'Windows executable (PE/MZ)', mime: 'application/vnd.microsoft.portable-executable', extensions: ['exe', 'dll', 'sys', 'scr', 'msi'] };
  if ([[0xfe, 0xed, 0xfa, 0xce], [0xfe, 0xed, 0xfa, 0xcf], [0xce, 0xfa, 0xed, 0xfe], [0xcf, 0xfa, 0xed, 0xfe]].some((s) => bytes(b, 0, s)))
    return { label: 'Mach-O executable (macOS)', mime: 'application/x-mach-binary', extensions: ['', 'dylib'] };
  if (bytes(b, 0, [0xca, 0xfe, 0xba, 0xbe])) return { label: 'Java class or macOS universal binary', mime: 'application/octet-stream', extensions: ['class', ''] };
  if (ascii(b, 0, 'SQLite format 3\0')) return { label: 'SQLite database', mime: 'application/vnd.sqlite3', extensions: ['sqlite', 'sqlite3', 'db'] };
  if (bytes(b, 0, [0x00, 0x61, 0x73, 0x6d])) return { label: 'WebAssembly module', mime: 'application/wasm', extensions: ['wasm'] };
  if (ascii(b, 0, 'wOFF')) return { label: 'WOFF font', mime: 'font/woff', extensions: ['woff'] };
  if (ascii(b, 0, 'wOF2')) return { label: 'WOFF2 font', mime: 'font/woff2', extensions: ['woff2'] };
  if (ascii(b, 0, 'OTTO')) return { label: 'OpenType font', mime: 'font/otf', extensions: ['otf'] };
  if (bytes(b, 0, [0x00, 0x01, 0x00, 0x00, 0x00])) return { label: 'TrueType font', mime: 'font/ttf', extensions: ['ttf'] };
  if (bytes(b, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return { label: 'Legacy Microsoft Office (OLE2) document', mime: 'application/x-ole-storage', extensions: ['doc', 'xls', 'ppt', 'msg', 'msi'] };
  if (bytes(b, 0, [0xef, 0xbb, 0xbf])) return { label: 'UTF-8 text (with byte-order mark)', mime: 'text/plain', extensions: ['txt', 'csv', 'json', 'xml', 'html', 'md'] };
  if (bytes(b, 0, [0xff, 0xfe]) || bytes(b, 0, [0xfe, 0xff])) return { label: 'UTF-16 text (with byte-order mark)', mime: 'text/plain', extensions: ['txt', 'csv'] };
  return null;
}

/** True when the sample has no NUL bytes and decodes as UTF-8 (a trailing cut multi-byte sequence is allowed). */
export function looksLikeText(sample: Uint8Array): boolean {
  if (sample.includes(0)) return false;
  let end = sample.length;
  // Allow a multi-byte character cut off at the end of the sample.
  for (let k = 1; k <= 3 && end - k >= 0; k++) {
    const byte = sample[end - k];
    if ((byte & 0xc0) === 0xc0) {
      end -= k;
      break;
    }
    if ((byte & 0x80) === 0) break;
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample.subarray(0, end));
    return true;
  } catch {
    return false;
  }
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function hexDump(b: Uint8Array, count = 32): string {
  return Array.from(b.subarray(0, count), (x) => x.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export function asciiPreview(b: Uint8Array, count = 32): string {
  return Array.from(b.subarray(0, count), (x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : '·')).join('');
}
