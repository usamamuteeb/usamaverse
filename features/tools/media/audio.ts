/**
 * Pure audio helpers on decoded PCM (one Float32Array per channel, -1…1).
 * Used by the trimmer, volume adjuster, joiner and audio extractor; the
 * browser does the decoding, everything else happens here, in memory.
 */

export interface Pcm {
  sampleRate: number;
  channels: Float32Array[];
}

export const duration = (p: Pcm) => (p.channels[0]?.length ?? 0) / p.sampleRate;

export type WavDepth = 16 | 24 | 32;

/** Encodes PCM as a RIFF/WAVE file: 16- or 24-bit integer, or 32-bit float. */
export function encodeWav(p: Pcm, depth: WavDepth = 16): Uint8Array {
  const ch = p.channels.length;
  const n = p.channels[0]?.length ?? 0;
  const bytes = depth / 8;
  const float = depth === 32;
  const dataLen = n * ch * bytes;
  if (44 + dataLen > 0xffffffff) throw new Error('The result is larger than 4 GB, the WAV limit. Use a shorter selection or mono.');
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataLen, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, float ? 3 : 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, p.sampleRate, true);
  v.setUint32(28, p.sampleRate * ch * bytes, true);
  v.setUint16(32, ch * bytes, true);
  v.setUint16(34, depth, true);
  str(36, 'data');
  v.setUint32(40, dataLen, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, p.channels[c][i] || 0));
      if (float) v.setFloat32(o, p.channels[c][i] || 0, true);
      else if (depth === 16) v.setInt16(o, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
      else {
        const x = s < 0 ? Math.round(s * 0x800000) : Math.round(s * 0x7fffff);
        v.setUint8(o, x & 0xff);
        v.setUint8(o + 1, (x >> 8) & 0xff);
        v.setUint8(o + 2, (x >> 16) & 0xff);
      }
      o += bytes;
    }
  }
  return new Uint8Array(buf);
}

/** Reads PCM WAV (8/16/24/32-bit int, 32/64-bit float). Mainly for tests and as a decoder fallback. */
export function decodeWav(b: Uint8Array): Pcm {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file.');
  let o = 12;
  let fmt: { format: number; ch: number; sr: number; bits: number } | null = null;
  while (o + 8 <= b.length) {
    const id = tag(o);
    const len = v.getUint32(o + 4, true);
    if (id === 'fmt ') {
      let format = v.getUint16(o + 8, true);
      if (format === 0xfffe && len >= 40) format = v.getUint16(o + 32, true);
      fmt = { format, ch: v.getUint16(o + 10, true), sr: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
    } else if (id === 'data' && fmt) {
      const bytes = fmt.bits / 8;
      const end = Math.min(b.length, o + 8 + len);
      const n = Math.floor((end - o - 8) / (bytes * fmt.ch));
      const channels = Array.from({ length: fmt.ch }, () => new Float32Array(n));
      let p = o + 8;
      for (let i = 0; i < n; i++)
        for (let c = 0; c < fmt.ch; c++, p += bytes) {
          let s = 0;
          if (fmt.format === 3) s = bytes === 8 ? v.getFloat64(p, true) : v.getFloat32(p, true);
          else if (bytes === 1) s = (b[p] - 128) / 128;
          else if (bytes === 2) s = v.getInt16(p, true) / 0x8000;
          else if (bytes === 3) s = (((b[p + 2] << 24) | (b[p + 1] << 16) | (b[p] << 8)) >> 8) / 0x800000;
          else if (bytes === 4) s = v.getInt32(p, true) / 0x80000000;
          channels[c][i] = s;
        }
      return { sampleRate: fmt.sr, channels };
    }
    o += 8 + len + (len & 1);
  }
  throw new Error('No audio data found in this WAV file.');
}

export function slice(p: Pcm, startSec: number, endSec: number): Pcm {
  const a = Math.max(0, Math.round(startSec * p.sampleRate));
  const b = Math.min(p.channels[0].length, Math.round(endSec * p.sampleRate));
  if (b <= a) throw new Error('The end must be after the start.');
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => c.slice(a, b)) };
}

/** Linear fade in/out (seconds), in place on a copy. */
export function fade(p: Pcm, inSec: number, outSec: number): Pcm {
  const n = p.channels[0].length;
  const fi = Math.min(n, Math.round(inSec * p.sampleRate));
  const fo = Math.min(n, Math.round(outSec * p.sampleRate));
  const channels = p.channels.map((c) => {
    const x = c.slice();
    for (let i = 0; i < fi; i++) x[i] *= i / fi;
    for (let i = 0; i < fo; i++) x[n - 1 - i] *= i / fo;
    return x;
  });
  return { sampleRate: p.sampleRate, channels };
}

export const dbToGain = (db: number) => 10 ** (db / 20);
export const gainToDb = (g: number) => (g > 0 ? 20 * Math.log10(g) : -Infinity);

export function peak(p: Pcm): number {
  let m = 0;
  for (const c of p.channels) for (let i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i]));
  return m;
}

export function gain(p: Pcm, g: number): Pcm {
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => c.map((s) => s * g)) };
}

/** Scales so the highest peak sits at `targetDb` dBFS. */
export function normalize(p: Pcm, targetDb = -1): { pcm: Pcm; appliedDb: number } {
  const pk = peak(p);
  if (pk === 0) return { pcm: p, appliedDb: 0 };
  const g = dbToGain(targetDb) / pk;
  return { pcm: gain(p, g), appliedDb: gainToDb(g) };
}

export function toMono(p: Pcm): Pcm {
  if (p.channels.length === 1) return p;
  const n = p.channels[0].length;
  const out = new Float32Array(n);
  for (const c of p.channels) for (let i = 0; i < n; i++) out[i] += c[i] / p.channels.length;
  return { sampleRate: p.sampleRate, channels: [out] };
}

export function reverse(p: Pcm): Pcm {
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => c.slice().reverse()) };
}

/** Resamples with linear interpolation (the UI prefers the browser's resampler when available). */
export function resampleLinear(p: Pcm, rate: number): Pcm {
  if (rate === p.sampleRate) return p;
  const n = p.channels[0].length;
  const m = Math.max(1, Math.round((n * rate) / p.sampleRate));
  const ratio = p.sampleRate / rate;
  return {
    sampleRate: rate,
    channels: p.channels.map((c) => {
      const out = new Float32Array(m);
      for (let i = 0; i < m; i++) {
        const x = i * ratio;
        const j = Math.floor(x);
        const f = x - j;
        out[i] = (c[j] ?? 0) * (1 - f) + (c[Math.min(n - 1, j + 1)] ?? 0) * f;
      }
      return out;
    }),
  };
}

/** Gives every clip the same channel count (mono is duplicated, extra channels are mixed down). */
export function matchChannels(p: Pcm, count: number): Pcm {
  if (p.channels.length === count) return p;
  if (count === 1) return toMono(p);
  if (p.channels.length === 1) return { sampleRate: p.sampleRate, channels: Array.from({ length: count }, () => p.channels[0]) };
  const mono = toMono(p).channels[0];
  return { sampleRate: p.sampleRate, channels: Array.from({ length: count }, (_, i) => p.channels[i] ?? mono) };
}

/** Joins clips (same sample rate) with an optional silent gap or an equal-power crossfade. */
export function concat(clips: Pcm[], o: { gapSec?: number; crossfadeSec?: number } = {}): Pcm {
  if (!clips.length) throw new Error('Add at least one clip.');
  const sr = clips[0].sampleRate;
  const ch = Math.max(...clips.map((c) => c.channels.length));
  const list = clips.map((c) => {
    if (c.sampleRate !== sr) throw new Error('All clips must have the same sample rate.');
    return matchChannels(c, ch);
  });
  const gap = Math.max(0, Math.round((o.gapSec ?? 0) * sr));
  const xf = Math.max(0, Math.round((o.crossfadeSec ?? 0) * sr));
  let total = 0;
  list.forEach((c, i) => {
    const len = c.channels[0].length;
    if (i === 0) total = len;
    else if (xf) total += len - Math.min(xf, len, list[i - 1].channels[0].length);
    else total += gap + len;
  });
  const out = Array.from({ length: ch }, () => new Float32Array(total));
  let pos = 0;
  list.forEach((c, i) => {
    const len = c.channels[0].length;
    const ov = i === 0 || !xf ? 0 : Math.min(xf, len, list[i - 1].channels[0].length);
    if (i > 0 && !xf) pos += gap;
    const start = pos - ov;
    for (let k = 0; k < ch; k++) {
      const src = c.channels[k];
      const dst = out[k];
      for (let s = 0; s < len; s++) {
        if (s < ov) {
          // equal-power crossfade: fade the tail already written out, fade this clip in
          const t = (s + 0.5) / ov;
          dst[start + s] = dst[start + s] * Math.cos((t * Math.PI) / 2) + src[s] * Math.sin((t * Math.PI) / 2);
        } else dst[start + s] = src[s];
      }
    }
    pos = start + len;
  });
  return { sampleRate: sr, channels: out };
}

export interface AudioStats {
  duration: number;
  sampleRate: number;
  channels: number;
  peakDb: number;
  rmsDb: number;
  /** Samples at or above 0.999 full scale (likely clipping). */
  clipped: number;
  /** Seconds of near-silence (below -50 dBFS) at the start and end. */
  leadingSilence: number;
  trailingSilence: number;
  /** Rough loudness estimate (ungated RMS, not a true LUFS meter). */
  dcOffset: number;
}

export function analyze(p: Pcm): AudioStats {
  const n = p.channels[0]?.length ?? 0;
  let pk = 0;
  let sum = 0;
  let clipped = 0;
  let dc = 0;
  for (const c of p.channels)
    for (let i = 0; i < n; i++) {
      const s = c[i];
      const a = Math.abs(s);
      if (a > pk) pk = a;
      if (a >= 0.999) clipped++;
      sum += s * s;
      dc += s;
    }
  const total = n * p.channels.length || 1;
  const thr = dbToGain(-50);
  const loud = (i: number) => p.channels.some((c) => Math.abs(c[i]) > thr);
  let lead = 0;
  while (lead < n && !loud(lead)) lead++;
  let trail = 0;
  while (trail < n - lead && !loud(n - 1 - trail)) trail++;
  return {
    duration: n / p.sampleRate,
    sampleRate: p.sampleRate,
    channels: p.channels.length,
    peakDb: gainToDb(pk),
    rmsDb: gainToDb(Math.sqrt(sum / total)),
    clipped,
    leadingSilence: lead / p.sampleRate,
    trailingSilence: trail / p.sampleRate,
    dcOffset: dc / total,
  };
}

/** Removes leading/trailing near-silence (below `thresholdDb`), keeping `padSec` of it. */
export function trimSilence(p: Pcm, thresholdDb = -50, padSec = 0.05): Pcm {
  const n = p.channels[0].length;
  const thr = dbToGain(thresholdDb);
  const loud = (i: number) => p.channels.some((c) => Math.abs(c[i]) > thr);
  let a = 0;
  while (a < n && !loud(a)) a++;
  if (a >= n) return { sampleRate: p.sampleRate, channels: p.channels.map(() => new Float32Array(0)) };
  let b = n - 1;
  while (b > a && !loud(b)) b--;
  const pad = Math.round(padSec * p.sampleRate);
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => c.slice(Math.max(0, a - pad), Math.min(n, b + 1 + pad))) };
}

/** Min/max pairs per column for drawing a waveform `width` columns wide. */
export function waveformPeaks(p: Pcm, width: number): Array<[number, number]> {
  const n = p.channels[0]?.length ?? 0;
  const out: Array<[number, number]> = [];
  const step = n / Math.max(1, width);
  for (let x = 0; x < width; x++) {
    const a = Math.floor(x * step);
    const b = Math.max(a + 1, Math.floor((x + 1) * step));
    let lo = 0;
    let hi = 0;
    // sample at most ~2000 points per column to stay fast on long files
    const stride = Math.max(1, Math.floor((b - a) / 2000));
    for (const c of p.channels)
      for (let i = a; i < b && i < n; i += stride) {
        if (c[i] < lo) lo = c[i];
        if (c[i] > hi) hi = c[i];
      }
    out.push([lo, hi]);
  }
  return out;
}

export function formatTime(sec: number, decimals = 2): string {
  if (!Number.isFinite(sec)) return '—';
  const neg = sec < 0;
  const s = Math.abs(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = (s % 60).toFixed(decimals).padStart(decimals ? decimals + 3 : 2, '0');
  return `${neg ? '-' : ''}${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${r}`;
}

/** Parses "1:23.5", "83.5", "1:02:03" into seconds. */
export function parseTime(s: string): number {
  const t = s.trim();
  if (!t) return NaN;
  const parts = t.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return NaN;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}
