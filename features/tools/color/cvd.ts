/**
 * Colour-vision-deficiency simulation with the Machado, Oliveira & Fernandes
 * (2009) matrices, applied in linear RGB. Severity blends from normal vision
 * (0) to dichromacy (1). A simulation for design checks — not a diagnosis.
 */
export type Cvd = 'protan' | 'deutan' | 'tritan' | 'achroma';

export const CVD_INFO: Record<Cvd, { name: string; about: string }> = {
  protan: { name: 'Protanopia (red-weak)', about: 'Reds look darker and are confused with greens. About 1% of men.' },
  deutan: { name: 'Deuteranopia (green-weak)', about: 'The most common form; reds and greens are hard to tell apart. About 5% of men.' },
  tritan: { name: 'Tritanopia (blue-weak)', about: 'Blues and greens, and yellows and pinks, are confused. Rare.' },
  achroma: { name: 'Achromatopsia (no colour)', about: 'Only brightness is seen. Very rare — but a good test of contrast.' },
};

const M: Record<Exclude<Cvd, 'achroma'>, number[]> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

const TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  TO_LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const LUT = 4096;
const TO_SRGB = new Uint8ClampedArray(LUT + 1);
for (let i = 0; i <= LUT; i++) {
  const c = i / LUT;
  TO_SRGB[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
}
const enc = (v: number) => TO_SRGB[Math.round(Math.min(1, Math.max(0, v)) * LUT)];

export function matrixFor(kind: Cvd, severity: number): number[] {
  const s = Math.min(1, Math.max(0, severity));
  const full = kind === 'achroma' ? [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722] : M[kind];
  const id = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return full.map((v, i) => id[i] * (1 - s) + v * s);
}

/** Simulates in place on RGBA pixel data (alpha untouched). */
export function simulate(data: Uint8ClampedArray, kind: Cvd, severity = 1): void {
  const m = matrixFor(kind, severity);
  for (let i = 0; i < data.length; i += 4) {
    const r = TO_LIN[data[i]];
    const g = TO_LIN[data[i + 1]];
    const b = TO_LIN[data[i + 2]];
    data[i] = enc(m[0] * r + m[1] * g + m[2] * b);
    data[i + 1] = enc(m[3] * r + m[4] * g + m[5] * b);
    data[i + 2] = enc(m[6] * r + m[7] * g + m[8] * b);
  }
}

export function simulateHex(hex: string, kind: Cvd, severity = 1): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const px = new Uint8ClampedArray([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]);
  simulate(px, kind, severity);
  return `#${[px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
