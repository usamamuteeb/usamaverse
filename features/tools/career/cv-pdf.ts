/**
 * CV → PDF with pdf-lib, entirely in the browser. Text stays real text (selectable
 * and readable by applicant-tracking systems). The 14 standard PDF fonts only
 * cover Western European characters, so anything else is reported back; the
 * Print / Save as PDF route handles every script.
 */
import { cleanCv, contactItems, dateRange, type CvData } from './cv-model';

export interface CvStyle {
  font: 'serif' | 'sans';
  accent: string; // #rrggbb
  paper: 'a4' | 'letter';
  density: 'normal' | 'compact';
  align: 'center' | 'left';
}

export const defaultCvStyle: CvStyle = { font: 'serif', accent: '#b3263e', paper: 'a4', density: 'normal', align: 'center' };

const PAPER = { a4: [595.28, 841.89] as const, letter: [612, 792] as const };

/** Common typographic characters outside WinAnsi, mapped to close equivalents. */
const FALLBACK: Record<string, string> = { '−': '-', '‐': '-', '‑': '-', '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '✓': '', '✔': '', '★': '*', '☆': '*', '●': '•', '▪': '•', '◦': '•', '■': '•', ' ': ' ', ' ': ' ', '​': '' };

export interface PdfResult {
  bytes: Uint8Array;
  pages: number;
  /** Characters that could not be drawn with the standard fonts (shown as “?”). */
  missing: string[];
}

type Font = import('pdf-lib').PDFFont;
type Run = { text: string; font: Font; color?: [number, number, number]; link?: string };

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xb3263e;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export async function cvToPdf(input: CvData, style: CvStyle = defaultCvStyle): Promise<PdfResult> {
  const { PDFDocument, StandardFonts, rgb, PDFString } = await import('pdf-lib');
  const cv = cleanCv(input);
  const doc = await PDFDocument.create();
  doc.setTitle(cv.basics.name ? `${cv.basics.name} — CV` : 'CV');
  doc.setAuthor(cv.basics.name || '');
  doc.setCreator('UsamaVerse CV Builder');
  doc.setProducer('UsamaVerse (pdf-lib, in the browser)');
  const serif = style.font === 'serif';
  const F = {
    reg: await doc.embedFont(serif ? StandardFonts.TimesRoman : StandardFonts.Helvetica),
    bold: await doc.embedFont(serif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold),
    ital: await doc.embedFont(serif ? StandardFonts.TimesRomanItalic : StandardFonts.HelveticaOblique),
  };
  const missing = new Set<string>();
  const safe = (s: string, font: Font) => {
    let out = '';
    for (const ch of s.replace(/[\t\r\n]+/g, ' ')) {
      const c = FALLBACK[ch] ?? ch;
      if (!c) continue;
      try {
        font.encodeText(c);
        out += c;
      } catch {
        missing.add(ch);
        out += '?';
      }
    }
    return out;
  };

  const compact = style.density === 'compact';
  const [W, H] = PAPER[style.paper];
  const M = compact ? 40 : 52;
  const body = compact ? 9.6 : 10.4;
  const lead = compact ? 1.28 : 1.34;
  const accent = hexToRgb(style.accent);
  const ink: [number, number, number] = [0.1, 0.1, 0.12];
  const grey: [number, number, number] = [0.32, 0.32, 0.36];
  const maxW = W - 2 * M;

  let page = doc.addPage([W, H]);
  let y = H - M;
  const ensure = (h: number) => {
    if (y - h < M) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };
  const addLink = (x: number, yy: number, w: number, h: number, url: string) => {
    const annot = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, yy - 2, x + w, yy + h],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    });
    page.node.addAnnot(doc.context.register(annot));
  };

  /** Draws runs with word wrapping. Returns nothing; advances y. */
  const paragraph = (runs: Run[], size: number, opts: { x?: number; width?: number; align?: 'left' | 'center'; gapAfter?: number } = {}) => {
    const x0 = opts.x ?? M;
    const width = opts.width ?? maxW - (x0 - M);
    type Word = { text: string; run: Run; w: number; space: number };
    const words: Word[] = [];
    for (const r of runs) {
      const t = safe(r.text, r.font);
      const parts = t.split(/(\s+)/);
      let pendingSpace = false;
      for (const p of parts) {
        if (!p) continue;
        if (/^\s+$/.test(p)) {
          pendingSpace = true;
          if (words.length) words[words.length - 1].space = r.font.widthOfTextAtSize(' ', size);
          continue;
        }
        if (pendingSpace && words.length) words[words.length - 1].space = r.font.widthOfTextAtSize(' ', size);
        pendingSpace = false;
        words.push({ text: p, run: r, w: r.font.widthOfTextAtSize(p, size), space: 0 });
      }
    }
    const lines: Word[][] = [];
    let line: Word[] = [];
    let lw = 0;
    for (const w of words) {
      const prevSpace = line.length ? line[line.length - 1].space : 0;
      if (line.length && lw + prevSpace + w.w > width) {
        lines.push(line);
        line = [];
        lw = 0;
      }
      lw += (line.length ? line[line.length - 1].space : 0) + w.w;
      line.push(w);
    }
    if (line.length) lines.push(line);
    const lh = size * lead;
    for (const ln of lines) {
      ensure(lh);
      const total = ln.reduce((n, w, i) => n + w.w + (i < ln.length - 1 ? w.space : 0), 0);
      let x = opts.align === 'center' ? x0 + (width - total) / 2 : x0;
      y -= size;
      for (let i = 0; i < ln.length; i++) {
        const w = ln[i];
        page.drawText(w.text, { x, y, size, font: w.run.font, color: rgb(...(w.run.color ?? ink)) });
        if (w.run.link) addLink(x, y, w.w + (i < ln.length - 1 ? w.space : 0), size, w.run.link);
        x += w.w + (i < ln.length - 1 ? w.space : 0);
      }
      y -= lh - size;
    }
    y -= opts.gapAfter ?? 0;
  };

  /** Left text and right text on one line (right side never wraps). */
  const twoCol = (left: Run[], right: Run | null, size: number) => {
    const rt = right ? safe(right.text, right.font) : '';
    const rw = right ? right.font.widthOfTextAtSize(rt, size) : 0;
    const gap = rw ? 12 : 0;
    ensure(size * lead);
    const startY = y;
    if (right && rt) {
      page.drawText(rt, { x: M + maxW - rw, y: y - size, size, font: right.font, color: rgb(...(right.color ?? ink)) });
    }
    y = startY;
    paragraph(left, size, { width: maxW - rw - gap });
  };

  const b = cv.basics;
  // Header
  const center = style.align === 'center';
  paragraph([{ text: b.name || 'Your Name', font: F.bold }], compact ? 20 : 23, { align: center ? 'center' : 'left', gapAfter: 3 });
  if (b.label.trim()) paragraph([{ text: b.label.trim(), font: F.reg, color: grey }], compact ? 11 : 12, { align: center ? 'center' : 'left', gapAfter: 2 });
  const contacts = contactItems(b);
  if (contacts.length) {
    const runs: Run[] = [];
    contacts.forEach((c, i) => {
      if (i) runs.push({ text: '  |  ', font: F.reg, color: grey });
      runs.push({ text: c.text, font: F.reg, color: grey, link: c.href });
    });
    paragraph(runs, compact ? 8.8 : 9.4, { align: center ? 'center' : 'left' });
  }
  y -= compact ? 4 : 8;

  const heading = (text: string) => {
    ensure(body * 4); // keep a heading with at least a line of content
    y -= compact ? 5 : 8;
    paragraph([{ text: text.toUpperCase(), font: F.bold, color: accent }], compact ? 10.4 : 11.2);
    y -= 1.5;
    page.drawLine({ start: { x: M, y }, end: { x: M + maxW, y }, thickness: 0.7, color: rgb(...accent) });
    y -= compact ? 4 : 5;
  };

  if (b.summary.trim()) {
    heading('Summary');
    paragraph([{ text: b.summary.trim(), font: F.reg }], body);
  }

  for (const s of cv.sections) {
    heading(s.heading);
    if (s.kind === 'text') for (const p of s.text.split(/\n{2,}/)) paragraph([{ text: p, font: F.reg }], body, { gapAfter: 2 });
    if (s.kind === 'list') for (const item of s.items) bullet(item);
    if (s.kind === 'skills')
      for (const g of s.skills) paragraph(g.name.trim() ? [{ text: `${g.name.trim()}: `, font: F.bold }, { text: g.items.trim(), font: F.reg }] : [{ text: g.items.trim(), font: F.reg }], body, { gapAfter: 1 });
    if (s.kind === 'entries')
      s.entries.forEach((e, i) => {
        if (i) y -= compact ? 3 : 5;
        ensure(body * lead * 3);
        twoCol([{ text: e.title.trim() || e.org.trim(), font: F.bold }], { text: dateRange(e), font: F.reg, color: grey }, body + 0.4);
        if ((e.title.trim() && e.org.trim()) || e.location.trim()) twoCol([{ text: e.title.trim() ? e.org.trim() : '', font: F.ital }], e.location.trim() ? { text: e.location.trim(), font: F.ital, color: grey } : null, body);
        if (e.details.trim()) paragraph([{ text: e.details.trim(), font: F.reg }], body);
        if (e.url.trim()) {
          const href = /^https?:/i.test(e.url) ? e.url : `https://${e.url}`;
          paragraph([{ text: e.url.trim().replace(/^https?:\/\//, ''), font: F.reg, color: accent, link: href }], body - 0.6);
        }
        for (const bl of e.bullets) bullet(bl);
      });
  }

  function bullet(text: string) {
    const size = body;
    ensure(size * lead);
    const by = y;
    page.drawText('•', { x: M + 4, y: by - size, size, font: F.reg, color: rgb(...ink) });
    paragraph([{ text, font: F.reg }], size, { x: M + 15 });
  }

  const bytes = await doc.save();
  return { bytes, pages: doc.getPageCount(), missing: [...missing] };
}
