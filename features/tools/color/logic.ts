export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', lime: '#00ff00', blue: '#0000ff',
  yellow: '#ffff00', cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff', gray: '#808080',
  grey: '#808080', silver: '#c0c0c0', maroon: '#800000', olive: '#808000', purple: '#800080', teal: '#008080',
  navy: '#000080', orange: '#ffa500', crimson: '#dc143c', transparent: '#00000000',
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function channel(s: string, max: number): number {
  const t = s.trim();
  if (t.endsWith('%')) return clamp((parseFloat(t) / 100) * max, 0, max);
  return clamp(parseFloat(t), 0, max);
}

function alpha(s: string | undefined): number {
  if (s === undefined) return 1;
  const t = s.trim();
  return clamp(t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t), 0, 1);
}

function hue(s: string): number {
  const t = s.trim().toLowerCase();
  let v = parseFloat(t);
  if (t.endsWith('turn')) v *= 360;
  else if (t.endsWith('rad')) v = (v * 180) / Math.PI;
  else if (t.endsWith('grad')) v *= 0.9;
  return ((v % 360) + 360) % 360;
}

export function parseColor(input: string): RGBA | null {
  let s = input.trim().toLowerCase();
  if (NAMED[s]) s = NAMED[s];
  if (/^#?[0-9a-f]{3,8}$/.test(s) && [3, 4, 6, 8].includes(s.replace('#', '').length)) {
    let h = s.replace('#', '');
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1 };
  }
  const fn = s.match(/^(rgba?|hsla?)\(\s*([^)]*)\)$/);
  if (!fn) return null;
  const parts = fn[2].includes(',') ? fn[2].split(',') : fn[2].replace(/\s*\/\s*/, ' / ').split(/\s+/).filter((p) => p !== '/');
  if (parts.length < 3 || parts.length > 4 || parts.some((p) => !/^-?[\d.]+(%|deg|rad|grad|turn)?$/.test(p.trim()))) return null;
  if (fn[1].startsWith('rgb')) return { r: Math.round(channel(parts[0], 255)), g: Math.round(channel(parts[1], 255)), b: Math.round(channel(parts[2], 255)), a: alpha(parts[3]) };
  const h = hue(parts[0]);
  const sat = clamp(parseFloat(parts[1]), 0, 100);
  const l = clamp(parseFloat(parts[2]), 0, 100);
  return { ...hslToRgb(h, sat, l), a: alpha(parts[3]) };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h * 10) / 10, s: Math.round(s * 1000) / 10, l: Math.round(l * 1000) / 10 };
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');

export function toHex(c: RGBA): string {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${c.a < 1 ? hex2(c.a * 255) : ''}`;
}

export function toRgbString(c: RGBA): string {
  return c.a < 1 ? `rgb(${c.r} ${c.g} ${c.b} / ${+c.a.toFixed(3)})` : `rgb(${c.r} ${c.g} ${c.b})`;
}

export function toHslString(c: RGBA): string {
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  return c.a < 1 ? `hsl(${h} ${s}% ${l}% / ${+c.a.toFixed(3)})` : `hsl(${h} ${s}% ${l}%)`;
}

/** Composite a translucent color over an opaque background. */
export function blend(fg: RGBA, bg: RGBA): RGBA {
  const a = fg.a;
  return { r: Math.round(fg.r * a + bg.r * (1 - a)), g: Math.round(fg.g * a + bg.g * (1 - a)), b: Math.round(fg.b * a + bg.b * (1 - a)), a: 1 };
}

export function relativeLuminance(c: RGBA): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

export function contrastRatio(fg: RGBA, bg: RGBA): number {
  const white: RGBA = { r: 255, g: 255, b: 255, a: 1 };
  const B = bg.a < 1 ? blend(bg, white) : bg;
  const F = fg.a < 1 ? blend(fg, B) : fg;
  const l1 = relativeLuminance(F);
  const l2 = relativeLuminance(B);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function wcagResults(ratio: number) {
  return [
    { label: 'Normal text — AA', need: 4.5 },
    { label: 'Large text — AA', need: 3 },
    { label: 'Normal text — AAA', need: 7 },
    { label: 'Large text — AAA', need: 4.5 },
    { label: 'UI components & graphics — AA', need: 3 },
  ].map((r) => ({ ...r, pass: ratio + 1e-9 >= r.need }));
}

export interface GradientStop {
  color: string;
  pos: number;
}

export function gradientCss(o: { type: 'linear' | 'radial'; angle: number; shape: 'circle' | 'ellipse'; stops: GradientStop[] }): string {
  const stops = o.stops
    .slice()
    .sort((a, b) => a.pos - b.pos)
    .map((s) => {
      const c = parseColor(s.color);
      if (!c) throw new Error(`“${s.color}” is not a color this tool understands.`);
      return `${toHex(c)} ${clamp(Math.round(s.pos), 0, 100)}%`;
    })
    .join(', ');
  return o.type === 'linear' ? `linear-gradient(${Math.round(o.angle)}deg, ${stops})` : `radial-gradient(${o.shape}, ${stops})`;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function simplifyRatio(w: number, h: number): [number, number] {
  if (!(w > 0) || !(h > 0)) throw new Error('Width and height must be greater than zero.');
  // Work in integers even for decimals like 2.35 : 1
  const scale = 10 ** Math.min(6, Math.max(decimals(w), decimals(h)));
  const W = Math.round(w * scale);
  const H = Math.round(h * scale);
  const g = gcd(W, H);
  return [W / g, H / g];
}

function decimals(n: number): number {
  const s = String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}
