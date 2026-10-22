/**
 * GIF decoder (GIF87a/89a): frames, delays, disposal methods, transparency,
 * interlacing and loop count, composited to full RGBA canvases the way
 * browsers show them. Pure TypeScript, no canvas needed.
 */

export interface GifFrameInfo {
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Delay in milliseconds as stored (browsers raise 0–10 ms to ~100 ms). */
  delay: number;
  disposal: number;
  transparentIndex: number | null;
  interlaced: boolean;
  localPalette: boolean;
  /** Composited full-size RGBA image after this frame is drawn. */
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

export interface Gif {
  width: number;
  height: number;
  /** 0 = loop forever, null = play once (no NETSCAPE block). */
  loops: number | null;
  globalPalette: boolean;
  backgroundIndex: number;
  comments: string[];
  frames: GifFrameInfo[];
  /** Sum of delays as browsers play them (0–10 ms counted as 100 ms). */
  duration: number;
  version: string;
}

export const DISPOSAL = ['Not specified', 'Keep', 'Restore to background', 'Restore to previous'];

/** Playback delay a browser uses for a stored delay. */
export const playDelay = (ms: number) => (ms <= 10 ? 100 : ms);

function lzw(data: Uint8Array, minCodeSize: number, pixelCount: number): Uint8Array {
  const out = new Uint8Array(pixelCount);
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  // dictionary as prefix/suffix chains
  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  const length = new Uint16Array(4096);
  for (let i = 0; i < clear; i++) {
    prefix[i] = -1;
    suffix[i] = i;
    length[i] = 1;
  }
  let prev = -1;
  let op = 0;
  let bits = 0;
  let acc = 0;
  let p = 0;
  const stack = new Uint8Array(4097);
  while (op < pixelCount) {
    while (bits < codeSize && p < data.length) {
      acc |= data[p++] << bits;
      bits += 8;
    }
    if (bits < codeSize) break;
    const code = acc & ((1 << codeSize) - 1);
    acc >>>= codeSize;
    bits -= codeSize;
    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = eoi + 1;
      prev = -1;
      continue;
    }
    if (code === eoi) break;
    let cur = code;
    if (code < next) {
      // emit string for code
    } else if (code === next && prev >= 0) {
      cur = prev;
    } else break; // corrupt
    // write string of `cur` (reversed via stack)
    let sp = 0;
    let c = cur;
    while (c >= 0 && sp < 4097) {
      stack[sp++] = suffix[c];
      c = prefix[c];
    }
    const first = stack[sp - 1];
    while (sp > 0 && op < pixelCount) out[op++] = stack[--sp];
    if (code === next && prev >= 0 && op < pixelCount) out[op++] = first;
    if (prev >= 0 && next < 4096) {
      prefix[next] = prev;
      suffix[next] = first;
      length[next] = length[prev] + 1;
      next++;
      if (next === 1 << codeSize && codeSize < 12) codeSize++;
    }
    prev = code;
  }
  return out;
}

export function decodeGif(b: Uint8Array, o: { maxFrames?: number; maxPixels?: number } = {}): Gif {
  const maxFrames = o.maxFrames ?? 2000;
  const sig = String.fromCharCode(...b.subarray(0, 6));
  if (!/^GIF8[79]a$/.test(sig)) throw new Error('This is not a GIF file.');
  const width = b[6] | (b[7] << 8);
  const height = b[8] | (b[9] << 8);
  if (!width || !height) throw new Error('The GIF has no size.');
  if (width * height > (o.maxPixels ?? 40_000_000)) throw new Error('This GIF is too large to inspect in the browser.');
  const flags = b[10];
  const gct = flags & 0x80 ? b.subarray(13, 13 + 3 * (2 << (flags & 7))) : null;
  const bgIndex = b[11];
  let p = 13 + (gct ? gct.length : 0);
  const gif: Gif = { width, height, loops: null, globalPalette: !!gct, backgroundIndex: bgIndex, comments: [], frames: [], duration: 0, version: sig.slice(3) };
  let canvas: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(width * height * 4);
  let gce = { delay: 0, disposal: 0, transparent: null as number | null };
  const readSubBlocks = () => {
    const parts: Uint8Array[] = [];
    let total = 0;
    while (p < b.length) {
      const n = b[p++];
      if (!n) break;
      parts.push(b.subarray(p, p + n));
      total += n;
      p += n;
    }
    const outB = new Uint8Array(total);
    let k = 0;
    for (const part of parts) {
      outB.set(part, k);
      k += part.length;
    }
    return outB;
  };
  let prevFrame: { info: Omit<GifFrameInfo, 'rgba'>; saved: Uint8ClampedArray<ArrayBuffer> | null } | null = null;
  while (p < b.length) {
    const block = b[p++];
    if (block === 0x3b) break; // trailer
    if (block === 0x21) {
      const label = b[p++];
      if (label === 0xf9) {
        const data = readSubBlocks();
        const packed = data[0];
        gce = { disposal: (packed >> 2) & 7, delay: (data[1] | (data[2] << 8)) * 10, transparent: packed & 1 ? data[3] : null };
      } else if (label === 0xff) {
        const app = String.fromCharCode(...b.subarray(p + 1, p + 12));
        const data = readSubBlocks();
        if (/^NETSCAPE2\.0|ANIMEXTS1\.0/.test(app) && data.length >= 14 && data[11] === 1) gif.loops = data[12] | (data[13] << 8);
      } else if (label === 0xfe) {
        gif.comments.push(new TextDecoder('latin1').decode(readSubBlocks()));
      } else readSubBlocks();
      continue;
    }
    if (block !== 0x2c) break; // unknown block: stop
    const left = b[p] | (b[p + 1] << 8);
    const top = b[p + 2] | (b[p + 3] << 8);
    const w = b[p + 4] | (b[p + 5] << 8);
    const h = b[p + 6] | (b[p + 7] << 8);
    const f = b[p + 8];
    p += 9;
    const lct = f & 0x80 ? b.subarray(p, p + 3 * (2 << (f & 7))) : null;
    if (lct) p += lct.length;
    const interlaced = !!(f & 0x40);
    const minCode = b[p++];
    const data = readSubBlocks();
    if (gif.frames.length >= maxFrames) {
      gce = { delay: 0, disposal: 0, transparent: null };
      continue;
    }
    // apply the previous frame's disposal before drawing this one
    if (prevFrame) {
      const d = prevFrame.info.disposal;
      if (d === 2) {
        const { left: L, top: T, width: W, height: H } = prevFrame.info;
        for (let y = T; y < Math.min(height, T + H); y++) canvas.fill(0, (y * width + L) * 4, (y * width + Math.min(width, L + W)) * 4);
      } else if (d === 3 && prevFrame.saved) canvas = prevFrame.saved;
    }
    const saved = gce.disposal === 3 ? canvas.slice() : null;
    const pal = lct ?? gct;
    const indices = lzw(data, Math.min(11, Math.max(2, minCode)), w * h);
    // interlaced rows come in passes: every 8th from 0, every 8th from 4, every 4th from 2, every 2nd from 1
    const rowOrder: number[] = [];
    if (interlaced) for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let y = start; y < h; y += step) rowOrder.push(y);
    for (let r = 0; r < h; r++) {
      const y = interlaced ? rowOrder[r] : r;
      const cy = top + y;
      if (cy >= height) continue;
      for (let x = 0; x < w; x++) {
        const cx = left + x;
        if (cx >= width) continue;
        const idx = indices[r * w + x];
        if (idx === gce.transparent || !pal || idx * 3 + 2 >= pal.length) continue;
        const q = (cy * width + cx) * 4;
        canvas[q] = pal[idx * 3];
        canvas[q + 1] = pal[idx * 3 + 1];
        canvas[q + 2] = pal[idx * 3 + 2];
        canvas[q + 3] = 255;
      }
    }
    const info = { index: gif.frames.length, left, top, width: w, height: h, delay: gce.delay, disposal: gce.disposal, transparentIndex: gce.transparent, interlaced, localPalette: !!lct };
    gif.frames.push({ ...info, rgba: canvas.slice() });
    gif.duration += playDelay(gce.delay);
    prevFrame = { info, saved };
    gce = { delay: 0, disposal: 0, transparent: null };
  }
  if (!gif.frames.length) throw new Error('No image frames were found in this GIF.');
  if (gif.frames.length === 1) gif.duration = 0;
  return gif;
}
