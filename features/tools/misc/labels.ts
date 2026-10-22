export interface LabelOptions { paper: 'a4' | 'letter'; width: number; height: number; marginX: number; marginY: number; gapX: number; gapY: number; repeat: number }
export const PAPER_MM = { a4: [210, 297], letter: [215.9, 279.4] } as const;

export function labelGeometry(o: LabelOptions) {
  const [paperW, paperH] = PAPER_MM[o.paper];
  const values = [o.width, o.height, o.marginX, o.marginY, o.gapX, o.gapY, o.repeat];
  if (values.some((n) => !Number.isFinite(n)) || o.width < 10 || o.height < 8 || o.marginX < 0 || o.marginY < 0 || o.gapX < 0 || o.gapY < 0 || !Number.isInteger(o.repeat) || o.repeat < 1 || o.repeat > 20) throw new Error('Choose valid dimensions and 1–20 copies per line.');
  const cols = Math.floor((paperW - 2 * o.marginX + o.gapX) / (o.width + o.gapX));
  const rows = Math.floor((paperH - 2 * o.marginY + o.gapY) / (o.height + o.gapY));
  if (cols < 1 || rows < 1) throw new Error('Labels and margins do not fit on this paper.');
  return { paperW, paperH, cols, rows, perPage: cols * rows };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function labelPrintContent(lines: string[], o: LabelOptions): { html: string; css: string; count: number; pages: number } {
  const g = labelGeometry(o);
  const labels = lines.map((x) => x.trim()).filter(Boolean).flatMap((line) => Array.from({ length: o.repeat }, () => line));
  if (!labels.length) throw new Error('Add at least one label line.');
  if (labels.length > 500) throw new Error('Limit this print job to 500 labels.');
  const chunks: string[][] = [];
  for (let i = 0; i < labels.length; i += g.perPage) chunks.push(labels.slice(i, i + g.perPage));
  const html = chunks.map((page) => `<section class="sheet">${page.map((item) => `<div class="label">${escapeHtml(item)}</div>`).join('')}</section>`).join('');
  const css = `*{box-sizing:border-box}.sheet{width:${g.paperW}mm;height:${g.paperH}mm;padding:${o.marginY}mm ${o.marginX}mm;display:grid;grid-template-columns:repeat(${g.cols},${o.width}mm);grid-template-rows:repeat(${g.rows},${o.height}mm);column-gap:${o.gapX}mm;row-gap:${o.gapY}mm;break-after:page}.sheet:last-child{break-after:auto}.label{display:flex;align-items:center;justify-content:center;text-align:center;white-space:pre-wrap;overflow:hidden;overflow-wrap:anywhere;font:12pt/1.15 Arial,sans-serif;padding:1.5mm;color:#111}@media screen{.label{outline:1px solid #ccc}}`;
  return { html, css, count: labels.length, pages: chunks.length };
}
