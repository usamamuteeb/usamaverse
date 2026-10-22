import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze, concat, decodeWav, encodeWav, fade, formatTime, normalize, parseTime, resampleLinear, slice, toMono, trimSilence, waveformPeaks, type Pcm } from '@/features/tools/media/audio';
import { detectContainer, parseMp3Frame, probeMedia } from '@/features/tools/media/probe';
import { decodeGif, playDelay } from '@/features/tools/media/gif';

const fx = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/media/${name}`, import.meta.url)));
const probe = (name: string) => {
  const b = fx(name);
  return probeMedia(b, b.length, b.subarray(Math.max(0, b.length - 65536)));
};
const tone = (sec: number, sr = 8000, ch = 1, amp = 0.5): Pcm => ({ sampleRate: sr, channels: Array.from({ length: ch }, () => Float32Array.from({ length: Math.round(sec * sr) }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / sr))) });

test('WAV encode/decode round trip at 16, 24 and 32-bit', () => {
  const p = tone(0.1, 8000, 2);
  for (const depth of [16, 24, 32] as const) {
    const back = decodeWav(encodeWav(p, depth));
    assert.equal(back.sampleRate, 8000);
    assert.equal(back.channels.length, 2);
    assert.equal(back.channels[0].length, 800);
    const tol = depth === 16 ? 1 / 30000 : 1e-6;
    for (let i = 0; i < 800; i += 37) assert.ok(Math.abs(back.channels[1][i] - p.channels[1][i]) <= tol, `${depth} @${i}`);
  }
  // the ffmpeg fixture decodes too
  const w = decodeWav(fx('tone.wav'));
  assert.equal(w.sampleRate, 8000);
  assert.equal(w.channels[0].length, 4000);
});

test('trim, fade, gain, mono, silence and joining', () => {
  const p = tone(1);
  assert.equal(slice(p, 0.25, 0.75).channels[0].length, 4000);
  assert.throws(() => slice(p, 0.5, 0.5), /after the start/);
  const f = fade(p, 0.1, 0.1);
  assert.equal(f.channels[0][0], 0);
  assert.ok(Math.abs(f.channels[0][7999]) < 0.01);
  const n = normalize(p, -1);
  assert.ok(Math.abs(analyze(n.pcm).peakDb + 1) < 0.01);
  assert.ok(Math.abs(n.appliedDb - (-1 - 20 * Math.log10(0.5))) < 0.05);
  const st = tone(0.5, 8000, 2);
  assert.equal(toMono(st).channels.length, 1);
  const padded: Pcm = { sampleRate: 8000, channels: [Float32Array.from([...new Float32Array(4000), ...p.channels[0], ...new Float32Array(2000)])] };
  const a = analyze(padded);
  assert.ok(Math.abs(a.leadingSilence - 0.5) < 0.01 && Math.abs(a.trailingSilence - 0.25) < 0.01);
  assert.ok(Math.abs(trimSilence(padded, -50, 0).channels[0].length - 8000) < 10);
  const joined = concat([tone(0.5), tone(0.5, 8000, 2)], { gapSec: 0.25 });
  assert.equal(joined.channels.length, 2);
  assert.equal(joined.channels[0].length, 10000);
  const xf = concat([tone(0.5), tone(0.5)], { crossfadeSec: 0.1 });
  assert.equal(xf.channels[0].length, 7200);
  assert.throws(() => concat([tone(0.1), tone(0.1, 16000)]), /same sample rate/);
  assert.equal(resampleLinear(tone(1), 16000).channels[0].length, 16000);
  assert.equal(waveformPeaks(p, 100).length, 100);
  assert.equal(formatTime(83.5), '1:23.50');
  assert.equal(parseTime('1:23.5'), 83.5);
  assert.equal(parseTime('1:02:03'), 3723);
  assert.ok(Number.isNaN(parseTime('abc')));
});

test('media probe matches ffprobe on fixtures', () => {
  const cases: Array<[string, Partial<{ container: string; duration: number; codec: string; sr: number; ch: number; w: number; h: number; fps: number }>]> = [
    ['tone.wav', { container: 'WAV', duration: 0.5, codec: 'PCM', sr: 8000, ch: 1 }],
    ['tone-cbr.mp3', { container: 'MP3', duration: 1.071, sr: 22050, ch: 1 }],
    ['tone-vbr.mp3', { container: 'MP3', duration: 1.071, sr: 22050, ch: 2 }],
    ['tone.flac', { container: 'FLAC', duration: 0.5, codec: 'FLAC', sr: 16000, ch: 1 }],
    ['tone.opus', { container: 'Ogg', duration: 1, codec: 'Opus', ch: 1 }],
    ['tone.ogg', { container: 'Ogg', duration: 1, codec: 'Vorbis', sr: 22050, ch: 1 }],
    ['tone.m4a', { container: 'MPEG-4 audio (M4A)', duration: 1, codec: 'mp4a', sr: 22050, ch: 1 }],
    ['tone.aiff', { container: 'AIFF', duration: 0.25, sr: 8000, ch: 1 }],
    ['clip.mp4', { container: 'MPEG-4 (MP4)', duration: 1, codec: 'avc1', w: 64, h: 48, fps: 24 }],
    ['clip.webm', { container: 'WebM', duration: 1.008, codec: 'V_VP9', w: 64, h: 48, fps: 25 }],
    ['clip.avi', { container: 'AVI', duration: 0.5, codec: 'MJPG', w: 32, h: 24, fps: 10 }],
  ];
  for (const [file, want] of cases) {
    const r = probe(file);
    const t = r.tracks[0];
    assert.ok(t, file);
    if (want.container) assert.equal(r.container, want.container, file);
    if (want.duration) assert.ok(Math.abs((r.duration ?? 0) - want.duration) < 0.01, `${file} duration ${r.duration}`);
    if (want.codec) assert.equal(t.codec, want.codec, file);
    if (want.sr) assert.equal(t.sampleRate, want.sr, file);
    if (want.ch) assert.equal(t.channels, want.ch, file);
    if (want.w) assert.deepEqual([t.width, t.height], [want.w, want.h], file);
    if (want.fps) assert.equal(t.fps, want.fps, file);
  }
  const mp4 = probe('clip.mp4');
  assert.equal(mp4.tracks[0].profile, 'High @ L1');
  assert.equal(mp4.tracks[1].profile, 'AAC-LC');
  assert.match(mp4.tags['fast start'], /^yes/);
  assert.equal(probe('tone-cbr.mp3').tags.title, 'Tone MP3');
  assert.equal(probe('tone.flac').tags.title, 'Flac tone');
  assert.equal(probe('tone.wav').tags.artist, 'UsamaVerse');
  assert.match(probe('tone-vbr.mp3').tracks[0].profile ?? '', /VBR/);
  assert.equal(detectContainer(new Uint8Array([1, 2, 3, 4])), 'unknown');
  assert.equal(parseMp3Frame(new Uint8Array([0xff, 0xfb, 0x90, 0x64]), 0)?.bitrate, 128000);
  // a truncated file never throws
  const cut = fx('clip.mp4').subarray(0, 200);
  assert.doesNotThrow(() => probeMedia(cut, 5806));
});

test('GIF decoder: frames, delays, disposal, loop and comments', () => {
  const g = decodeGif(fx('anim.gif'));
  assert.deepEqual([g.width, g.height, g.frames.length, g.loops], [24, 16, 4, 0]);
  assert.deepEqual(g.frames.map((f) => f.delay), [100, 200, 50, 0]);
  assert.equal(g.duration, 100 + 200 + 50 + playDelay(0));
  assert.deepEqual(g.comments, ['UsamaVerse test']);
  // frame 2 (index 1): a green box at x=5..13 and transparent outside drawn areas
  const px = (f: number, x: number, y: number) => Array.from(g.frames[f].rgba.subarray((y * 24 + x) * 4, (y * 24 + x) * 4 + 4));
  assert.deepEqual(px(1, 6, 3), [40, 180, 60, 255]);
  assert.equal(px(1, 1, 1)[3], 0);
  const ff = decodeGif(fx('ff.gif'));
  assert.equal(ff.frames.length, 5);
  assert.equal(ff.frames[1].top, 22);
  assert.throws(() => decodeGif(new Uint8Array([1, 2, 3])), /not a GIF/);
});
