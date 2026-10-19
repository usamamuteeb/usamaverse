export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
export const MAX_PIXELS = 50_000_000;
export const MAX_SIDE = 16_384;

export type OutputMime = 'image/png' | 'image/jpeg' | 'image/webp';

export const EXT: Record<OutputMime, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Compute target size; if keepAspect, the missing/edited side follows the original ratio. */
export function fitDimensions(origW: number, origH: number, w: number | null, h: number | null, keepAspect: boolean): { width: number; height: number } {
  if (!(origW > 0 && origH > 0)) throw new Error('Image has no size.');
  let width = w ?? 0;
  let height = h ?? 0;
  if (keepAspect) {
    if (w && !h) height = Math.round((w * origH) / origW);
    else if (h && !w) width = Math.round((h * origW) / origH);
    else if (w && h) {
      // Fit inside the box while keeping the ratio.
      const scale = Math.min(w / origW, h / origH);
      width = Math.round(origW * scale);
      height = Math.round(origH * scale);
    }
  }
  if (!width || !height) throw new Error('Enter a width and/or height.');
  width = Math.max(1, width);
  height = Math.max(1, height);
  if (width > MAX_SIDE || height > MAX_SIDE) throw new Error(`Each side is limited to ${MAX_SIDE.toLocaleString()} pixels.`);
  if (width * height > MAX_PIXELS) throw new Error('The output would exceed 50 megapixels.');
  return { width, height };
}

export function outputName(original: string, mime: OutputMime, suffix: string): string {
  const base = original.replace(/\.[^.]+$/, '') || 'image';
  return `${base}${suffix ? `-${suffix}` : ''}.${EXT[mime]}`;
}

export function rotatedSize(w: number, h: number, angle: number): { width: number; height: number } {
  return angle % 180 === 0 ? { width: w, height: h } : { width: h, height: w };
}
