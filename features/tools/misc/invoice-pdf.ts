/** Invoice → PDF with pdf-lib (text stays selectable). */
import { computeTotals, money, num, type Invoice } from './invoice';

export async function invoiceToPdf(inv: Invoice, accentHex = '#b3263e', paper: 'a4' | 'letter' = 'a4'): Promise<{ bytes: Uint8Array; missing: string[] }> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${inv.number}`);
  doc.setCreator('UsamaVerse Invoice Generator');
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [W, H] = paper === 'a4' ? [595.28, 841.89] : [612, 792];
  const M = 48;
  const t = computeTotals(inv);
  const missing = new Set<string>();
  const safe = (s: string, f = reg) => {
    let out = '';
    for (const ch of s.replace(/[\t\r]/g, ' ')) {
      try {
        f.encodeText(ch);
        out += ch;
      } catch {
        missing.add(ch);
        out += '?';
      }
    }
    return out;
  };
  const fmt = (minor: number) => {
    const sym = money(minor, inv.currency, t.digits);
    try {
      reg.encodeText(sym);
      bold.encodeText(sym);
      return sym;
    } catch {
      return money(minor, inv.currency, t.digits, 'code');
    }
  };
  const m = /^#?([0-9a-f]{6})$/i.exec(accentHex);
  const n = m ? parseInt(m[1], 16) : 0xb3263e;
  const accent = rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  const ink = rgb(0.1, 0.1, 0.12);
  const grey = rgb(0.4, 0.4, 0.45);
  const white = rgb(1, 1, 1);

  let page = doc.addPage([W, H]);
  let y = H - M;
  const text = (s: string, x: number, yy: number, size: number, f = reg, color = ink) => page.drawText(safe(s, f), { x, y: yy, size, font: f, color });
  const right = (s: string, xr: number, yy: number, size: number, f = reg, color = ink) => {
    const v = safe(s, f);
    page.drawText(v, { x: xr - f.widthOfTextAtSize(v, size), y: yy, size, font: f, color });
  };
  const wrap = (s: string, width: number, size: number, f = reg) => {
    const out: string[] = [];
    for (const para of safe(s, f).split('\n')) {
      let line = '';
      for (const w of para.split(/\s+/)) {
        const cand = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(cand, size) > width && line) {
          out.push(line);
          line = w;
        } else line = cand;
      }
      out.push(line);
    }
    return out;
  };

  // Header: business on the left, title and meta on the right
  right('INVOICE', W - M, y - 22, 24, bold, accent);
  text(inv.from.name || 'Your business', M, y - 14, 15, bold);
  let fy = y - 30;
  for (const l of [...inv.from.address.split('\n'), inv.from.email, inv.from.phone, inv.from.taxId].filter((x) => x.trim())) {
    text(l, M, fy, 9.5, reg, grey);
    fy -= 12.5;
  }
  let my = y - 44;
  for (const [k, v] of [
    ['Invoice no.', inv.number],
    ['Issued', inv.issued],
    ['Due', inv.due],
  ]) {
    if (!v.trim()) continue;
    right(k, W - M - 96, my, 9.5, reg, grey);
    right(v, W - M, my, 9.5, bold);
    my -= 13;
  }
  y = Math.min(fy, my) - 16;
  text('BILL TO', M, y, 8.5, bold, accent);
  y -= 14;
  text(inv.to.name || '—', M, y, 11, bold);
  y -= 13;
  for (const l of [...inv.to.address.split('\n'), inv.to.email, inv.to.phone, inv.to.taxId].filter((x) => x.trim())) {
    text(l, M, y, 9.5, reg, grey);
    y -= 12.5;
  }
  y -= 14;

  // Line items
  const cols = { desc: M + 6, qty: W - M - 210, price: W - M - 140, tax: W - M - 78, amt: W - M - 6 };
  const head = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: accent });
    text('Description', cols.desc, y, 9, bold, white);
    right('Qty', cols.qty, y, 9, bold, white);
    right('Unit price', cols.price, y, 9, bold, white);
    right('Tax', cols.tax, y, 9, bold, white);
    right('Amount', cols.amt, y, 9, bold, white);
    y -= 22;
  };
  head();
  inv.items.forEach((it, i) => {
    if (!it.description.trim() && !it.price.trim()) return;
    const lines = wrap(it.description || '—', cols.qty - cols.desc - 50, 9.5);
    const h = lines.length * 12 + 8;
    if (y - h < M + 120) {
      page = doc.addPage([W, H]);
      y = H - M;
      head();
    }
    lines.forEach((l, k) => text(l, cols.desc, y - k * 12, 9.5));
    const price = num(it.price || '0');
    right(it.qty || '0', cols.qty, y, 9.5);
    right(Number.isFinite(price) ? fmt(Math.round(price * 10 ** t.digits)) : '?', cols.price, y, 9.5);
    right(`${it.tax || 0}%`, cols.tax, y, 9.5, reg, grey);
    right(fmt(t.lines[i].amount), cols.amt, y, 9.5);
    y -= h;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.4, color: rgb(0.85, 0.85, 0.87) });
  });

  // Totals
  y -= 6;
  const row = (k: string, v: string, strong = false) => {
    right(k, W - M - 110, y, strong ? 11 : 9.5, strong ? bold : reg, strong ? ink : grey);
    right(v, W - M - 6, y, strong ? 11 : 9.5, strong ? bold : reg);
    y -= strong ? 18 : 14;
  };
  row('Subtotal', fmt(t.subtotal));
  if (t.discount) row(`Discount (${inv.discount}%)`, `-${fmt(t.discount)}`);
  if (t.tax) row('Tax', fmt(t.tax));
  if (t.shipping) row('Shipping', fmt(t.shipping));
  page.drawLine({ start: { x: W - M - 220, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 0.8, color: accent });
  y -= 2;
  row(`Total due (${inv.currency})`, fmt(t.total), true);

  // Notes and terms
  y -= 10;
  for (const [label, body] of [
    ['Notes', inv.notes],
    ['Payment terms', inv.terms],
  ]) {
    if (!body.trim()) continue;
    const lines = wrap(body, W - 2 * M, 9.5);
    if (y - lines.length * 12 - 20 < M) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
    text(label.toUpperCase(), M, y, 8.5, bold, accent);
    y -= 13;
    for (const l of lines) {
      text(l, M, y, 9.5, reg, grey);
      y -= 12;
    }
    y -= 8;
  }
  return { bytes: await doc.save(), missing: [...missing] };
}
