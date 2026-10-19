/**
 * Turns positioned text runs (from pdf.js) into reading-order lines, plain text
 * and best-effort Markdown. Deterministic heuristics only — no AI, no OCR.
 * Multi-column layouts and complex tables may come out in the wrong order.
 */
import type { TextRun } from './pdfjs';

export interface Line {
  text: string;
  y: number;
  x: number;
  size: number;
}

export function runsToLines(runs: TextRun[]): Line[] {
  const items = runs.filter((r) => r.str.length > 0).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Array<{ y: number; size: number; runs: TextRun[] }> = [];
  for (const r of items) {
    const tol = Math.max(2, r.fontSize * 0.5);
    const line = lines.find((l) => Math.abs(l.y - r.y) <= tol);
    if (line) {
      line.runs.push(r);
      line.size = Math.max(line.size, r.fontSize);
    } else lines.push({ y: r.y, size: r.fontSize, runs: [r] });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines
    .map((l) => {
      const rs = l.runs.sort((a, b) => a.x - b.x);
      let text = '';
      let end = -Infinity;
      for (const r of rs) {
        const gap = r.x - end;
        if (text && gap > r.fontSize * 0.2 && !/\s$/.test(text) && !/^\s/.test(r.str)) text += gap > r.fontSize * 2.5 ? '    ' : ' ';
        text += r.str;
        end = Math.max(end, r.x + r.width);
      }
      return { text: text.replace(/\s+$/, ''), y: l.y, x: rs[0]?.x ?? 0, size: l.size };
    })
    .filter((l) => l.text.trim() !== '');
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = nums.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Lines grouped into paragraphs by vertical gaps. */
export function paragraphs(lines: Line[]): Line[][] {
  if (!lines.length) return [];
  // Normal line spacing ≈ the lower quartile of gaps (paragraph breaks are the larger gaps).
  const gaps = lines.slice(1).map((l, i) => lines[i].y - l.y).filter((g) => g > 0).sort((a, b) => a - b);
  const typical = gaps.length ? gaps[Math.floor(gaps.length / 4)] : lines[0].size * 1.2;
  const out: Line[][] = [[lines[0]]];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y;
    const sizeJump = Math.abs(lines[i].size - lines[i - 1].size) > Math.max(1, lines[i - 1].size * 0.15);
    if (gap > typical * 1.45 || sizeJump) out.push([lines[i]]);
    else out[out.length - 1].push(lines[i]);
  }
  return out;
}

export function linesToText(lines: Line[]): string {
  return paragraphs(lines)
    .map((p) => p.map((l) => l.text).join('\n'))
    .join('\n\n');
}

const BULLET = /^\s*[•●▪◦‣∙·\-–*]\s+/;
const NUMBERED = /^\s*(\d{1,3}|[a-z])[.)]\s+/i;

function escapeMd(s: string): string {
  return s.replace(/^(\s*)([#>])/, '$1\\$2').replace(/([*_`[\]])/g, '\\$1');
}

/** Best-effort Markdown: headings from font size, bullets and numbered lists, paragraphs joined. */
export function linesToMarkdown(lines: Line[], bodySize?: number): string {
  const body = bodySize ?? median(lines.flatMap((l) => Array(Math.min(50, l.text.length)).fill(l.size)));
  const blocks: string[] = [];
  for (const p of paragraphs(lines)) {
    const size = p[0].size;
    const joined = p.map((l) => l.text.trim()).join(' ');
    const short = joined.length <= 120;
    if (short && body && size >= body * 1.6) blocks.push(`# ${escapeMd(joined)}`);
    else if (short && body && size >= body * 1.3) blocks.push(`## ${escapeMd(joined)}`);
    else if (short && body && size >= body * 1.12) blocks.push(`### ${escapeMd(joined)}`);
    else if (p.every((l) => BULLET.test(l.text) || NUMBERED.test(l.text)) || BULLET.test(p[0].text) || NUMBERED.test(p[0].text)) {
      // Each list item may wrap onto continuation lines.
      const items: string[] = [];
      for (const l of p) {
        if (BULLET.test(l.text)) items.push(`- ${escapeMd(l.text.replace(BULLET, ''))}`);
        else if (NUMBERED.test(l.text)) items.push(`${l.text.match(NUMBERED)![1]}. ${escapeMd(l.text.replace(NUMBERED, ''))}`);
        else if (items.length) items[items.length - 1] += ` ${escapeMd(l.text.trim())}`;
        else items.push(escapeMd(l.text.trim()));
      }
      blocks.push(items.join('\n'));
    } else {
      // Re-join words hyphenated across line breaks.
      blocks.push(escapeMd(p.map((l) => l.text.trim()).join('\n').replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2').replace(/\n/g, ' ')));
    }
  }
  return blocks.join('\n\n');
}

export function bodyFontSize(allLines: Line[]): number {
  return median(allLines.flatMap((l) => Array(Math.min(50, l.text.length)).fill(l.size)));
}
