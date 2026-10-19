import type { TextRun } from './pdfjs';
import type { Box } from './ops';

/**
 * Approximate boxes (visual PDF points) around every case-insensitive match of
 * `term` inside text runs. Character widths are estimated proportionally within
 * a run, so boxes are padded slightly to be safe.
 */
export function findTextBoxes(runs: TextRun[], term: string): Box[] {
  const t = term.trim().toLocaleLowerCase();
  if (!t) return [];
  const out: Box[] = [];
  for (const r of runs) {
    const s = r.str.toLocaleLowerCase();
    if (!s || r.width <= 0) continue;
    let from = 0;
    for (;;) {
      const i = s.indexOf(t, from);
      if (i < 0) break;
      const charW = r.width / r.str.length;
      const [ux, uy] = r.dir ?? [1, 0];
      // Perpendicular (towards the top of the glyphs) is the direction rotated 90° counter-clockwise.
      const [px, py] = [-uy, ux];
      const s0 = i * charW;
      const s1 = (i + t.length) * charW;
      const corners: Array<[number, number]> = [];
      for (const along of [s0, s1]) for (const up of [-0.3 * r.fontSize, 1.05 * r.fontSize]) corners.push([r.x + ux * along + px * up, r.y + uy * along + py * up]);
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const pad = r.fontSize * 0.15;
      const x0 = Math.min(...xs) - pad;
      const y0 = Math.min(...ys) - pad;
      out.push({ x: x0, y: y0, width: Math.max(...xs) + pad - x0, height: Math.max(...ys) + pad - y0 });
      from = i + t.length;
    }
  }
  return out;
}

/** Rectangle from two drag corners (any direction). */
export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}
