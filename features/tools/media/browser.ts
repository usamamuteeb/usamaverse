'use client';

/** Browser-only helpers for the media tools: reading files, decoding audio, resampling. */
import type { Pcm } from './audio';
import { probeMedia, type MediaInfo } from './probe';

export const MAX_MEDIA_BYTES = 1024 * 1024 * 1024; // 1 GB
export const MAX_DECODE_BYTES = 500 * 1024 * 1024; // decoded audio lives in memory

export async function readHeadTail(file: File, headBytes = 8 * 1024 * 1024): Promise<{ head: Uint8Array; tail: Uint8Array }> {
  const head = new Uint8Array(await file.slice(0, Math.min(file.size, headBytes)).arrayBuffer());
  const tail = file.size > headBytes ? new Uint8Array(await file.slice(Math.max(0, file.size - 65536)).arrayBuffer()) : head.subarray(Math.max(0, head.length - 65536));
  return { head, tail };
}

export async function probeFile(file: File): Promise<MediaInfo> {
  const { head, tail } = await readHeadTail(file);
  let info = probeMedia(head, file.size, tail);
  // an MP4 whose index sits at the end: read the end of the file too
  if (info.notes.some((n) => n.includes('moov')) && file.size > head.length) {
    const tailBig = new Uint8Array(await file.slice(Math.max(0, file.size - 16 * 1024 * 1024)).arrayBuffer());
    const idx = findBox(tailBig, 'moov');
    if (idx >= 0) {
      // keep the ftyp box from the head, then the index from the end
      const ftypSize = new DataView(head.buffer, head.byteOffset).getUint32(0);
      const ftyp = head.subarray(0, Math.min(ftypSize, 32));
      const fixed = new Uint8Array(ftyp.length + tailBig.length - idx);
      fixed.set(ftyp);
      fixed.set(tailBig.subarray(idx), ftyp.length);
      info = probeMedia(fixed, file.size);
      info.tags['fast start'] = 'no (moov at the end of the file)';
    }
  }
  return info;
}

function findBox(b: Uint8Array, type: string): number {
  for (let i = 4; i + 4 <= b.length; i++) {
    if (b[i] === type.charCodeAt(0) && b[i + 1] === type.charCodeAt(1) && b[i + 2] === type.charCodeAt(2) && b[i + 3] === type.charCodeAt(3)) {
      const size = (b[i - 4] << 24) | (b[i - 3] << 16) | (b[i - 2] << 8) | b[i - 1];
      if (size >= 8 && i - 4 + size <= b.length + 8) return i - 4;
    }
  }
  return -1;
}

type OfflineCtor = typeof OfflineAudioContext;
const Offline = (): OfflineCtor => {
  const C = (globalThis as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor }).OfflineAudioContext ?? (globalThis as unknown as { webkitOfflineAudioContext?: OfflineCtor }).webkitOfflineAudioContext;
  if (!C) throw new Error('This browser cannot decode audio (Web Audio API missing).');
  return C;
};

export function bufferToPcm(buf: AudioBuffer): Pcm {
  return { sampleRate: buf.sampleRate, channels: Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i)) };
}

/**
 * Decodes any audio (or the audio track of a video) the browser supports.
 * The file's own sample rate is kept when it can be read from the header.
 */
export async function decodeAudioFile(file: File, info?: MediaInfo): Promise<Pcm> {
  if (file.size > MAX_DECODE_BYTES) throw new Error('This file is over 500 MB. Decoded audio is kept in memory, so use a shorter file.');
  const meta = info ?? (await probeFile(file).catch(() => undefined));
  const audio = meta?.tracks.find((t) => t.kind === 'audio');
  if (meta && meta.tracks.length && !audio) throw new Error('This file has no audio track.');
  let rate = Math.round(audio?.sampleRate ?? 0);
  if (!(rate >= 8000 && rate <= 192000)) rate = 48000;
  const data = await file.arrayBuffer();
  const C = Offline();
  const tryRate = async (r: number) => {
    const ctx = new C(1, 1, r);
    return ctx.decodeAudioData(data.slice(0));
  };
  let buf: AudioBuffer;
  try {
    buf = await tryRate(rate);
  } catch {
    if (rate !== 48000) {
      try {
        buf = await tryRate(48000);
      } catch {
        throw decodeError(file, meta);
      }
    } else throw decodeError(file, meta);
  }
  return bufferToPcm(buf);
}

function decodeError(file: File, meta?: MediaInfo): Error {
  const codec = meta?.tracks.find((t) => t.kind === 'audio');
  const what = codec ? `${codec.codecName ?? codec.codec} audio in ${meta?.container}` : file.type || 'this file type';
  return new Error(`Your browser could not decode ${what}. Try MP3, WAV, AAC/M4A, Ogg/Opus or FLAC — Safari cannot read Ogg/WebM audio in some versions.`);
}

/** High-quality resampling with the browser's own resampler. */
export async function resample(p: Pcm, rate: number): Promise<Pcm> {
  if (rate === p.sampleRate) return p;
  const n = p.channels[0].length;
  const C = Offline();
  const ctx = new C(p.channels.length, Math.max(1, Math.ceil((n * rate) / p.sampleRate)), rate);
  const buf = ctx.createBuffer(p.channels.length, n, p.sampleRate);
  p.channels.forEach((c, i) => buf.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  return bufferToPcm(await ctx.startRendering());
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'audio';
}
