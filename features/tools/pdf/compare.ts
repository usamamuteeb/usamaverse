/**
 * Pixel comparison of two same-sized RGBA images. A pixel counts as changed when
 * the summed channel difference exceeds `threshold` (filters anti-aliasing noise).
 * Returns an RGBA overlay: changed pixels red, others transparent.
 */
export function pixelDiff(a: Uint8ClampedArray, b: Uint8ClampedArray, width: number, height: number, threshold = 60): { changed: number; total: number; overlay: Uint8ClampedArray } {
  const total = width * height;
  if (a.length !== total * 4 || b.length !== total * 4) throw new Error('Images must have the same size.');
  const overlay = new Uint8ClampedArray(total * 4);
  let changed = 0;
  for (let i = 0; i < total * 4; i += 4) {
    const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    if (d > threshold) {
      changed++;
      overlay[i] = 240;
      overlay[i + 1] = 30;
      overlay[i + 2] = 60;
      overlay[i + 3] = 200;
    }
  }
  return { changed, total, overlay };
}

/** Percentage with sensible precision for tiny changes. */
export function changePercent(changed: number, total: number): string {
  if (!total || !changed) return '0%';
  const p = (changed / total) * 100;
  return p < 0.01 ? '<0.01%' : `${p < 1 ? p.toFixed(2) : p.toFixed(1)}%`;
}
