import { hslToRgb, parseColor, rgbToHsl, toHex, type RGBA } from './logic';

// ---------------------------------------------------------------- Palettes

export type Scheme = 'complementary' | 'analogous' | 'triadic' | 'split' | 'tetradic' | 'monochromatic' | 'shades';

const rot = (h: number, d: number) => (((h + d) % 360) + 360) % 360;

export function palette(base: string, scheme: Scheme): string[] {
  const c = parseColor(base);
  if (!c) throw new Error(`“${base}” is not a color this tool understands.`);
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  const at = (hh: number, ss = s, ll = l) => toHex({ ...hslToRgb(hh, Math.max(0, Math.min(100, ss)), Math.max(0, Math.min(100, ll))), a: 1 });
  switch (scheme) {
    case 'complementary':
      return [at(h), at(rot(h, 180))];
    case 'analogous':
      return [at(rot(h, -30)), at(h), at(rot(h, 30))];
    case 'triadic':
      return [at(h), at(rot(h, 120)), at(rot(h, 240))];
    case 'split':
      return [at(h), at(rot(h, 150)), at(rot(h, 210))];
    case 'tetradic':
      return [at(h), at(rot(h, 90)), at(rot(h, 180)), at(rot(h, 270))];
    case 'monochromatic':
      return [-30, -15, 0, 15, 30].map((dl) => at(h, s, l + dl));
    case 'shades':
      return [95, 85, 70, 55, 45, 35, 25, 15, 8].map((ll) => at(h, s, ll));
  }
}

// ---------------------------------------------------------------- CSS generators

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number; // 0..100
  inset: boolean;
}

export function boxShadowCss(layers: ShadowLayer[]): string {
  return layers
    .map((L) => {
      const c = parseColor(L.color);
      if (!c) throw new Error(`“${L.color}” is not a valid color.`);
      if (L.blur < 0) throw new Error('Blur cannot be negative.');
      const a = Math.round(Math.max(0, Math.min(100, L.opacity))) / 100;
      return `${L.inset ? 'inset ' : ''}${L.x}px ${L.y}px ${L.blur}px ${L.spread}px rgb(${c.r} ${c.g} ${c.b} / ${a})`;
    })
    .join(', ');
}

export function borderRadiusCss(r: { tl: number; tr: number; br: number; bl: number }, unit: 'px' | '%' | 'rem'): string {
  const vals = [r.tl, r.tr, r.br, r.bl];
  if (vals.some((v) => !(v >= 0))) throw new Error('Radii must be zero or positive.');
  const f = (v: number) => (v === 0 ? '0' : `${+v.toFixed(3)}${unit}`);
  if (vals.every((v) => v === vals[0])) return f(vals[0]);
  if (r.tl === r.br && r.tr === r.bl) return `${f(r.tl)} ${f(r.tr)}`;
  if (r.tr === r.bl) return `${f(r.tl)} ${f(r.tr)} ${f(r.br)}`;
  return vals.map(f).join(' ');
}

export const RATIOS: Array<{ value: number; label: string }> = [
  { value: 1.067, label: 'Minor second (1.067)' },
  { value: 1.125, label: 'Major second (1.125)' },
  { value: 1.2, label: 'Minor third (1.2)' },
  { value: 1.25, label: 'Major third (1.25)' },
  { value: 1.333, label: 'Perfect fourth (1.333)' },
  { value: 1.414, label: 'Augmented fourth (1.414)' },
  { value: 1.5, label: 'Perfect fifth (1.5)' },
  { value: 1.618, label: 'Golden ratio (1.618)' },
];

export function typeScale(basePx: number, ratio: number, up: number, down: number, rootPx = 16) {
  if (!(basePx > 0) || !(ratio > 1) || !(rootPx > 0)) throw new Error('Base size, ratio (> 1) and root size must be positive.');
  if (up > 12 || down > 6 || up < 0 || down < 0) throw new Error('Use up to 12 steps up and 6 down.');
  const rows: Array<{ step: number; px: number; rem: number }> = [];
  for (let i = up; i >= -down; i--) {
    const px = basePx * ratio ** i;
    rows.push({ step: i, px, rem: px / rootPx });
  }
  return rows;
}

/** Fluid size: clamp(min, preferred, max) interpolating between two viewport widths. */
export function fluidClamp(o: { minPx: number; maxPx: number; minVw: number; maxVw: number; rootPx: number }) {
  const { minPx, maxPx, minVw, maxVw, rootPx } = o;
  if ([minPx, maxPx, minVw, maxVw, rootPx].some((v) => !(v > 0))) throw new Error('All values must be greater than zero.');
  if (maxVw <= minVw) throw new Error('The maximum viewport must be wider than the minimum viewport.');
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const interceptPx = minPx - slope * minVw;
  const r = (v: number, d = 4) => +v.toFixed(d);
  const lo = Math.min(minPx, maxPx) / rootPx;
  const hi = Math.max(minPx, maxPx) / rootPx;
  const css = `clamp(${r(lo)}rem, ${r(interceptPx / rootPx)}rem + ${r(slope * 100)}vw, ${r(hi)}rem)`;
  return { css, slopeVw: slope * 100, interceptRem: interceptPx / rootPx };
}

export function ppi(widthPx: number, heightPx: number, diagonalIn: number) {
  if (!(widthPx > 0 && heightPx > 0 && diagonalIn > 0)) throw new Error('Enter a positive width, height and diagonal.');
  const diagPx = Math.hypot(widthPx, heightPx);
  const density = diagPx / diagonalIn;
  return {
    ppi: density,
    dotPitchMm: 25.4 / density,
    widthIn: widthPx / density,
    heightIn: heightPx / density,
    megapixels: (widthPx * heightPx) / 1e6,
  };
}

export function cssVariables(colors: string[], prefix = 'color'): string {
  return `:root {\n${colors.map((c, i) => `  --${prefix}-${i + 1}: ${c};`).join('\n')}\n}`;
}

export type { RGBA };
