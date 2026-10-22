/**
 * Reads a CV file chosen by the user into text, in the browser:
 * .tex/.md/.txt/.json as text, .pdf via pdf.js (its text layer), and .docx by
 * unzipping word/document.xml with the browser's own DecompressionStream.
 */
import type { CvInputFormat } from './cv-convert';

export const CV_FILE_ACCEPT = '.pdf,.docx,.tex,.md,.markdown,.txt,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*,application/json';
export const CV_FILE_MAX = 20 * 1024 * 1024;

export interface ImportedText {
  text: string;
  format: CvInputFormat;
  note?: string;
}

export async function readCvFile(file: File): Promise<ImportedText> {
  if (file.size > CV_FILE_MAX) throw new Error(`That file is ${(file.size / 1e6).toFixed(1)} MB; CV files over 20 MB are not supported.`);
  const name = file.name.toLowerCase();
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  const isZip = head[0] === 0x50 && head[1] === 0x4b; // PK
  if (isPdf || name.endsWith('.pdf')) return { text: await pdfText(new Uint8Array(await file.arrayBuffer())), format: 'text', note: 'Text was read from the PDF’s text layer. Check dates and headings — PDF layouts can split lines.' };
  if (isZip || name.endsWith('.docx')) return { text: await docxText(new Uint8Array(await file.arrayBuffer())), format: 'text', note: 'Text was read from the Word document.' };
  const text = await file.text();
  if (name.endsWith('.tex')) return { text, format: 'latex' };
  if (name.endsWith('.json')) return { text, format: 'json' };
  if (name.endsWith('.md') || name.endsWith('.markdown')) return { text, format: 'markdown' };
  return { text, format: 'auto' };
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { openPdf, pageTextRuns } = await import('@/features/tools/pdf/pdfjs');
  const { runsToLines } = await import('@/features/tools/pdf/text');
  const doc = await openPdf(bytes);
  try {
    const pages: string[] = [];
    for (let p = 1; p <= Math.min(doc.numPages, 10); p++) {
      const { runs } = await pageTextRuns(doc, p);
      pages.push(runsToLines(runs).map((l) => l.text).join('\n'));
    }
    const text = pages.join('\n').trim();
    if (!text) throw new Error('This PDF has no text layer (it may be a scan). Run OCR PDF first, then import again.');
    return text;
  } finally {
    void doc.loadingTask.destroy();
  }
}

/** Minimal ZIP reader: finds one entry and inflates it. */
export async function unzipEntry(zip: Uint8Array, wanted: string): Promise<Uint8Array | null> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('This is not a valid .docx (ZIP) file.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count && p + 46 <= zip.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(zip.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name !== wanted) continue;
    const lNameLen = dv.getUint16(local + 26, true);
    const lExtraLen = dv.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = zip.subarray(start, start + csize);
    if (method === 0) return data;
    if (method !== 8) throw new Error('This .docx uses an unsupported compression method.');
    if (csize > 50 * 1024 * 1024) throw new Error('The document text is too large.');
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    if (out.length > 200 * 1024 * 1024) throw new Error('The document expands to an unsafe size.');
    return out;
  }
  return null;
}

const decodeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');

/** Paragraph text of a .docx, with list items marked “• ” and tabs kept as wide gaps. */
export async function docxText(bytes: Uint8Array): Promise<string> {
  const xmlBytes = await unzipEntry(bytes, 'word/document.xml');
  if (!xmlBytes) throw new Error('No word/document.xml was found — is this a Word (.docx) file?');
  const xml = new TextDecoder().decode(xmlBytes);
  const paras = xml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) ?? [];
  const lines: string[] = [];
  for (const p of paras) {
    const isList = /<w:numPr>/.test(p) || /<w:pStyle w:val="List/.test(p);
    let text = '';
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) {
      if (m[0] === '<w:tab/>') text += '    ';
      else if (m[0] === '<w:br/>') text += '\n';
      else text += decodeXml(m[1]);
    }
    lines.push(isList && text.trim() ? `• ${text.trim()}` : text.replace(/\s+$/, ''));
  }
  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new Error('No text was found in that document.');
  return text;
}
