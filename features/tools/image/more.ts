/** Build a .ico file whose entries are PNG images (supported by all modern browsers and Windows Vista+). */
export function buildIco(pngs: Array<{ size: number; bytes: Uint8Array }>): Uint8Array {
  const header = 6 + 16 * pngs.length;
  const total = header + pngs.reduce((n, p) => n + p.bytes.length, 0);
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  v.setUint16(0, 0, true);
  v.setUint16(2, 1, true);
  v.setUint16(4, pngs.length, true);
  let offset = header;
  pngs.forEach((p, i) => {
    if (p.size < 1 || p.size > 256) throw new Error('ICO images must be 1–256 px.');
    const e = 6 + i * 16;
    out[e] = p.size === 256 ? 0 : p.size;
    out[e + 1] = p.size === 256 ? 0 : p.size;
    v.setUint16(e + 4, 1, true);
    v.setUint16(e + 6, 32, true);
    v.setUint32(e + 8, p.bytes.length, true);
    v.setUint32(e + 12, offset, true);
    out.set(p.bytes, offset);
    offset += p.bytes.length;
  });
  return out;
}

/** Dominant colors by coarse histogram (5 bits per channel), then merging similar buckets. */
export function dominantColors(rgba: Uint8ClampedArray, count = 8): Array<{ hex: string; share: number }> {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const key = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
    const b = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    b.r += rgba[i];
    b.g += rgba[i + 1];
    b.b += rgba[i + 2];
    b.n++;
    buckets.set(key, b);
    total++;
  }
  if (!total) return [];
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n).map((b) => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n }));
  const picked: typeof sorted = [];
  for (const c of sorted) {
    const near = picked.find((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) < 40);
    if (near) {
      const n = near.n + c.n;
      near.r = (near.r * near.n + c.r * c.n) / n;
      near.g = (near.g * near.n + c.g * c.n) / n;
      near.b = (near.b * near.n + c.b * c.n) / n;
      near.n = n;
    } else if (picked.length < count * 3) picked.push({ ...c });
  }
  const h = (x: number) => Math.round(x).toString(16).padStart(2, '0');
  return picked
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((c) => ({ hex: `#${h(c.r)}${h(c.g)}${h(c.b)}`, share: c.n / total }));
}

export interface DrawPlan {
  sx: number; sy: number; sw: number; sh: number;
  dx: number; dy: number; dw: number; dh: number;
}

/** cover = fill and crop (centered by focus), contain = fit inside with padding, stretch = distort. */
export function fitPlan(srcW: number, srcH: number, dstW: number, dstH: number, mode: 'cover' | 'contain' | 'stretch', focusX = 0.5, focusY = 0.5): DrawPlan {
  if (mode === 'stretch') return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: 0, dy: 0, dw: dstW, dh: dstH };
  if (mode === 'contain') {
    const s = Math.min(dstW / srcW, dstH / srcH);
    const dw = Math.round(srcW * s);
    const dh = Math.round(srcH * s);
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: Math.round((dstW - dw) / 2), dy: Math.round((dstH - dh) / 2), dw, dh };
  }
  const s = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / s;
  const sh = dstH / s;
  const sx = Math.min(srcW - sw, Math.max(0, (srcW - sw) * focusX));
  const sy = Math.min(srcH - sh, Math.max(0, (srcH - sh) * focusY));
  return { sx, sy, sw, sh, dx: 0, dy: 0, dw: dstW, dh: dstH };
}

/** Largest centered crop with the given aspect ratio. */
export function centeredCrop(w: number, h: number, ratioW: number, ratioH: number): { x: number; y: number; w: number; h: number } {
  const target = ratioW / ratioH;
  if (w / h > target) {
    const cw = Math.round(h * target);
    return { x: Math.round((w - cw) / 2), y: 0, w: cw, h };
  }
  const ch = Math.round(w / target);
  return { x: 0, y: Math.round((h - ch) / 2), w, h: ch };
}

export function clampCrop(c: { x: number; y: number; w: number; h: number }, W: number, H: number) {
  const x = Math.max(0, Math.min(W - 1, Math.round(c.x)));
  const y = Math.max(0, Math.min(H - 1, Math.round(c.y)));
  return { x, y, w: Math.max(1, Math.min(W - x, Math.round(c.w))), h: Math.max(1, Math.min(H - y, Math.round(c.h))) };
}

export const SOCIAL_PRESETS: Array<{ id: string; label: string; w: number; h: number }> = [
  { id: 'og', label: 'Open Graph / link preview (1200 × 630)', w: 1200, h: 630 },
  { id: 'x', label: 'X / Twitter post image (1600 × 900)', w: 1600, h: 900 },
  { id: 'ig-square', label: 'Instagram square (1080 × 1080)', w: 1080, h: 1080 },
  { id: 'ig-portrait', label: 'Instagram portrait (1080 × 1350)', w: 1080, h: 1350 },
  { id: 'story', label: 'Story / Reel / Short (1080 × 1920)', w: 1080, h: 1920 },
  { id: 'yt-thumb', label: 'YouTube thumbnail (1280 × 720)', w: 1280, h: 720 },
  { id: 'yt-banner', label: 'YouTube channel banner (2560 × 1440)', w: 2560, h: 1440 },
  { id: 'li-post', label: 'LinkedIn post (1200 × 627)', w: 1200, h: 627 },
  { id: 'fb-cover', label: 'Facebook cover (1640 × 624)', w: 1640, h: 624 },
];

export const FAVICON_SIZES = [16, 32, 48, 180, 192, 512];
