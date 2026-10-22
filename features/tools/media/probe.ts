/**
 * Reads technical details from the first part of an audio/video file without
 * decoding it: container, codecs, duration, bitrate, resolution, frame rate,
 * sample rate, channels and common tags. Supports WAV, MP3, FLAC, Ogg (Opus/
 * Vorbis/FLAC), MP4/M4A/MOV (ISO-BMFF), WebM/Matroska, AIFF and AVI.
 * Everything is parsed from bytes in memory; nothing is played.
 */

export interface TrackInfo {
  kind: 'video' | 'audio' | 'subtitle' | 'other';
  codec: string;
  /** Human name for the codec, e.g. "H.264 / AVC". */
  codecName?: string;
  profile?: string;
  width?: number;
  height?: number;
  fps?: number;
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  duration?: number;
  bitrate?: number;
  language?: string;
  frames?: number;
}

export interface MediaInfo {
  container: string;
  mime?: string;
  duration?: number;
  /** Overall bitrate in bits per second. */
  bitrate?: number;
  tracks: TrackInfo[];
  tags: Record<string, string>;
  notes: string[];
}

const CODEC_NAMES: Record<string, string> = {
  avc1: 'H.264 / AVC', avc3: 'H.264 / AVC', hvc1: 'H.265 / HEVC', hev1: 'H.265 / HEVC', vp08: 'VP8', vp09: 'VP9', av01: 'AV1', mp4v: 'MPEG-4 Visual', jpeg: 'Motion JPEG', 'mjpa': 'Motion JPEG', apch: 'ProRes 422 HQ', apcn: 'ProRes 422', apcs: 'ProRes 422 LT', apco: 'ProRes 422 Proxy', ap4h: 'ProRes 4444', s263: 'H.263',
  mp4a: 'AAC', 'ac-3': 'Dolby Digital (AC-3)', 'ec-3': 'Dolby Digital Plus (E-AC-3)', opus: 'Opus', Opus: 'Opus', fLaC: 'FLAC', alac: 'Apple Lossless (ALAC)', sowt: 'PCM', twos: 'PCM', lpcm: 'PCM', ulaw: 'µ-law', '.mp3': 'MP3', samr: 'AMR-NB',
  V_VP8: 'VP8', V_VP9: 'VP9', V_AV1: 'AV1', 'V_MPEG4/ISO/AVC': 'H.264 / AVC', V_MPEGH: 'H.265 / HEVC', 'V_MPEGH/ISO/HEVC': 'H.265 / HEVC', V_THEORA: 'Theora', V_MJPEG: 'Motion JPEG',
  A_OPUS: 'Opus', A_VORBIS: 'Vorbis', A_AAC: 'AAC', A_FLAC: 'FLAC', A_MPEG_L3: 'MP3', A_AC3: 'Dolby Digital (AC-3)', A_EAC3: 'Dolby Digital Plus', A_PCM_INT_LIT: 'PCM', A_DTS: 'DTS', S_TEXT_UTF8: 'SRT subtitles', S_TEXT_WEBVTT: 'WebVTT subtitles', S_TEXT_ASS: 'ASS subtitles',
};
const name = (c: string) => CODEC_NAMES[c] ?? CODEC_NAMES[c.split('/')[0]] ?? undefined;

const latin1 = (b: Uint8Array, a: number, n: number) => {
  let s = '';
  for (let i = a; i < a + n && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
};
const utf8 = (b: Uint8Array) => new TextDecoder('utf-8', { fatal: false }).decode(b).replace(/\0+$/, '');
const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

export function detectContainer(b: Uint8Array): string {
  const h = latin1(b, 0, 12);
  if (h.startsWith('RIFF') && h.slice(8, 12) === 'WAVE') return 'wav';
  if (h.startsWith('RIFF') && h.slice(8, 12) === 'AVI ') return 'avi';
  if (h.startsWith('FORM') && /AIF[FC]/.test(h.slice(8, 12))) return 'aiff';
  if (h.startsWith('fLaC')) return 'flac';
  if (h.startsWith('OggS')) return 'ogg';
  if (h.slice(4, 8) === 'ftyp' || ['moov', 'mdat', 'wide', 'free', 'skip'].includes(h.slice(4, 8))) return 'mp4';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'matroska';
  if (h.startsWith('ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return b[0] === 0xff && (b[1] & 0xf6) === 0xf0 ? 'aac' : 'mp3';
  if (h.startsWith('GIF8')) return 'gif';
  return 'unknown';
}

// ------------------------------------------------------------------ WAV / AIFF

function probeWav(b: Uint8Array, info: MediaInfo, fileSize: number) {
  const v = dv(b);
  let o = 12;
  let t: TrackInfo | null = null;
  const FORMATS: Record<number, string> = { 1: 'PCM', 3: 'IEEE float', 6: 'A-law', 7: 'µ-law', 0x55: 'MP3', 0x11: 'IMA ADPCM', 2: 'MS ADPCM' };
  while (o + 8 <= b.length) {
    const id = latin1(b, o, 4);
    const len = v.getUint32(o + 4, true);
    if (id === 'fmt ' && o + 24 <= b.length) {
      let fmt = v.getUint16(o + 8, true);
      if (fmt === 0xfffe && len >= 40 && o + 34 <= b.length) fmt = v.getUint16(o + 32, true);
      const byteRate = v.getUint32(o + 16, true);
      t = { kind: 'audio', codec: FORMATS[fmt] ?? `format 0x${fmt.toString(16)}`, channels: v.getUint16(o + 10, true), sampleRate: v.getUint32(o + 12, true), bitDepth: v.getUint16(o + 22, true), bitrate: byteRate * 8 };
      info.tracks.push(t);
    } else if (id === 'data' && t) {
      const dataLen = len === 0xffffffff || len === 0 ? fileSize - o - 8 : len;
      const byteRate = (t.bitrate ?? 0) / 8;
      if (byteRate) t.duration = info.duration = dataLen / byteRate;
      break;
    } else if (id === 'LIST' && latin1(b, o + 8, 4) === 'INFO') {
      const MAP: Record<string, string> = { INAM: 'title', IART: 'artist', IPRD: 'album', ICRD: 'date', IGNR: 'genre', ICMT: 'comment', ISFT: 'software' };
      let p = o + 12;
      while (p + 8 <= o + 8 + len && p + 8 <= b.length) {
        const k = latin1(b, p, 4);
        const l = v.getUint32(p + 4, true);
        if (MAP[k]) info.tags[MAP[k]] = utf8(b.subarray(p + 8, p + 8 + l));
        p += 8 + l + (l & 1);
      }
    }
    o += 8 + len + (len & 1);
  }
  if (info.duration) info.bitrate = (fileSize * 8) / info.duration;
}

function float80(b: Uint8Array, o: number): number {
  const exp = ((b[o] & 0x7f) << 8) | b[o + 1];
  let mant = 0;
  for (let i = 0; i < 8; i++) mant = mant * 256 + b[o + 2 + i];
  return mant * 2 ** (exp - 16383 - 63) * (b[o] & 0x80 ? -1 : 1);
}

function probeAiff(b: Uint8Array, info: MediaInfo, fileSize: number) {
  const v = dv(b);
  let o = 12;
  while (o + 8 <= b.length) {
    const id = latin1(b, o, 4);
    const len = v.getUint32(o + 4, false);
    if (id === 'COMM' && o + 26 <= b.length) {
      const ch = v.getUint16(o + 8, false);
      const frames = v.getUint32(o + 10, false);
      const bits = v.getUint16(o + 14, false);
      const sr = float80(b, o + 16);
      const codec = latin1(b, 8, 4) === 'AIFC' && len >= 22 ? latin1(b, o + 26, 4) : 'PCM';
      info.duration = frames / sr;
      info.tracks.push({ kind: 'audio', codec: codec === 'NONE' || codec === 'sowt' ? 'PCM' : codec, channels: ch, sampleRate: Math.round(sr), bitDepth: bits, duration: info.duration, bitrate: sr * ch * bits });
    }
    o += 8 + len + (len & 1);
  }
  if (info.duration) info.bitrate = (fileSize * 8) / info.duration;
}

// ------------------------------------------------------------------ MP3

const MP3_BITRATES: Record<string, number[]> = {
  '1-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  '2-2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const MP3_RATES = [[44100, 48000, 32000], [22050, 24000, 16000], [11025, 12000, 8000]];

export function parseMp3Frame(b: Uint8Array, o: number) {
  if (b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) return null;
  const verBits = (b[o + 1] >> 3) & 3; // 0: 2.5, 2: 2, 3: 1
  const layerBits = (b[o + 1] >> 1) & 3; // 1: III, 2: II, 3: I
  if (verBits === 1 || layerBits === 0) return null;
  const version = verBits === 3 ? 1 : verBits === 2 ? 2 : 2.5;
  const layer = 4 - layerBits;
  const brIdx = b[o + 2] >> 4;
  const srIdx = (b[o + 2] >> 2) & 3;
  if (brIdx === 0 || brIdx === 15 || srIdx === 3) return null;
  const table = version === 1 ? `1-${layer}` : layer === 1 ? '2-1' : '2-2';
  const bitrate = MP3_BITRATES[table][brIdx] * 1000;
  const sampleRate = MP3_RATES[version === 1 ? 0 : version === 2 ? 1 : 2][srIdx];
  const padding = (b[o + 2] >> 1) & 1;
  const mode = b[o + 3] >> 6;
  const samples = layer === 1 ? 384 : layer === 3 && version !== 1 ? 576 : 1152;
  const size = layer === 1 ? Math.floor((12 * bitrate) / sampleRate + padding) * 4 : Math.floor((samples / 8) * bitrate / sampleRate) + padding;
  return { version, layer, bitrate, sampleRate, channels: mode === 3 ? 1 : 2, mode: ['Stereo', 'Joint stereo', 'Dual channel', 'Mono'][mode], samples, size };
}

function id3Size(b: Uint8Array, o: number) {
  return ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
}

function readId3(b: Uint8Array, info: MediaInfo): number {
  if (latin1(b, 0, 3) !== 'ID3') return 0;
  const ver = b[3];
  const size = id3Size(b, 6) + 10 + (b[5] & 0x10 ? 10 : 0);
  const MAP: Record<string, string> = { TIT2: 'title', TPE1: 'artist', TALB: 'album', TYER: 'year', TDRC: 'year', TCON: 'genre', TRCK: 'track', TPE2: 'album artist', TCOM: 'composer', TSSE: 'encoder', TT2: 'title', TP1: 'artist', TAL: 'album', TYE: 'year', TCO: 'genre', TRK: 'track' };
  let o = 10;
  if (b[5] & 0x40 && ver >= 3) o += ver === 4 ? id3Size(b, 10) : dv(b).getUint32(10) + 4;
  const v = dv(b);
  while (o + (ver === 2 ? 6 : 10) < Math.min(size, b.length)) {
    const idLen = ver === 2 ? 3 : 4;
    const id = latin1(b, o, idLen);
    if (!/^[A-Z0-9]+$/.test(id)) break;
    const len = ver === 2 ? (b[o + 3] << 16) | (b[o + 4] << 8) | b[o + 5] : ver === 4 ? id3Size(b, o + 4) : v.getUint32(o + 4);
    const head = ver === 2 ? 6 : 10;
    const body = b.subarray(o + head, o + head + len);
    if (MAP[id] && body.length > 1) {
      const enc = body[0];
      const raw = body.subarray(1);
      let text = '';
      if (enc === 1 || enc === 2) {
        const le = enc === 1 ? !(raw[0] === 0xfe && raw[1] === 0xff) : false;
        const start = enc === 1 && ((raw[0] === 0xff && raw[1] === 0xfe) || (raw[0] === 0xfe && raw[1] === 0xff)) ? 2 : 0;
        text = new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(raw.subarray(start));
      } else text = enc === 3 ? utf8(raw) : latin1(raw, 0, raw.length);
      text = text.replace(/\0+$/, '').split('\0')[0].trim();
      if (text) info.tags[MAP[id]] = text;
    } else if (id === 'APIC' || id === 'PIC') info.tags['cover art'] = 'yes';
    o += head + len;
  }
  return size;
}

function probeMp3(b: Uint8Array, info: MediaInfo, fileSize: number) {
  let o = readId3(b, info);
  // find the first frame (two consecutive valid headers)
  let f: ReturnType<typeof parseMp3Frame> = null;
  for (let i = 0; i < 64 * 1024 && o + i + 4 < b.length; i++) {
    const a = parseMp3Frame(b, o + i);
    if (a && parseMp3Frame(b, o + i + a.size)) {
      o += i;
      f = a;
      break;
    }
  }
  if (!f) {
    info.notes.push('No MPEG audio frames were found near the start of the file.');
    return;
  }
  const t: TrackInfo = { kind: 'audio', codec: `MPEG-${f.version} Layer ${'I'.repeat(f.layer)}`, codecName: f.layer === 3 ? 'MP3' : f.layer === 2 ? 'MP2' : 'MP1', sampleRate: f.sampleRate, channels: f.channels, profile: f.mode };
  // Xing/Info or VBRI header gives the frame count for VBR files
  const sideInfo = f.version === 1 ? (f.channels === 1 ? 17 : 32) : f.channels === 1 ? 9 : 17;
  const x = o + 4 + sideInfo;
  const tag = latin1(b, x, 4);
  const v = dv(b);
  let frames = 0;
  if ((tag === 'Xing' || tag === 'Info') && b[x + 7] & 1) {
    frames = v.getUint32(x + 8);
    t.profile = `${f.mode}${tag === 'Xing' ? ', VBR' : ', CBR'}`;
  } else if (latin1(b, o + 36, 4) === 'VBRI') {
    frames = v.getUint32(o + 36 + 14);
    t.profile = `${f.mode}, VBR`;
  }
  const audioBytes = fileSize - o;
  if (frames) {
    t.duration = (frames * f.samples) / f.sampleRate;
    t.bitrate = (audioBytes * 8) / t.duration;
  } else {
    t.bitrate = f.bitrate;
    t.duration = (audioBytes * 8) / f.bitrate;
    if (!t.profile?.includes('BR')) t.profile = `${f.mode}, CBR`;
  }
  info.duration = t.duration;
  info.bitrate = t.bitrate;
  info.tracks.push(t);
}

// ------------------------------------------------------------------ FLAC / Ogg

function vorbisComments(b: Uint8Array, o: number, end: number, info: MediaInfo) {
  const v = dv(b);
  if (o + 4 > end) return;
  const vendorLen = v.getUint32(o, true);
  o += 4 + vendorLen;
  if (o + 4 > end) return;
  const n = v.getUint32(o, true);
  o += 4;
  for (let i = 0; i < n && o + 4 <= end; i++) {
    const len = v.getUint32(o, true);
    const s = utf8(b.subarray(o + 4, o + 4 + len));
    o += 4 + len;
    const eq = s.indexOf('=');
    if (eq > 0 && !/^METADATA_BLOCK_PICTURE$/i.test(s.slice(0, eq))) info.tags[s.slice(0, eq).toLowerCase()] = s.slice(eq + 1);
  }
}

function probeFlac(b: Uint8Array, info: MediaInfo, fileSize: number, base = 4) {
  let o = base;
  for (;;) {
    if (o + 4 > b.length) break;
    const last = b[o] & 0x80;
    const type = b[o] & 0x7f;
    const len = (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
    if (type === 0 && o + 22 <= b.length) {
      const p = o + 4 + 10;
      const sr = (b[p] << 12) | (b[p + 1] << 4) | (b[p + 2] >> 4);
      const ch = ((b[p + 2] >> 1) & 7) + 1;
      const bits = (((b[p + 2] & 1) << 4) | (b[p + 3] >> 4)) + 1;
      const total = (b[p + 3] & 0x0f) * 2 ** 32 + ((b[p + 4] << 24) >>> 0) + (b[p + 5] << 16) + (b[p + 6] << 8) + b[p + 7];
      const t: TrackInfo = { kind: 'audio', codec: 'FLAC', codecName: 'FLAC (lossless)', sampleRate: sr, channels: ch, bitDepth: bits };
      if (total && sr) {
        t.duration = info.duration = total / sr;
        info.bitrate = t.bitrate = (fileSize * 8) / t.duration;
      }
      info.tracks.push(t);
    } else if (type === 4) vorbisComments(b, o + 4, o + 4 + len, info);
    else if (type === 6) info.tags['cover art'] = 'yes';
    o += 4 + len;
    if (last) break;
  }
}

function probeOgg(b: Uint8Array, info: MediaInfo, fileSize: number) {
  // read the first pages' packets
  let o = 0;
  const packets: Uint8Array[] = [];
  let cur: number[] = [];
  while (o + 27 <= b.length && packets.length < 3 && latin1(b, o, 4) === 'OggS') {
    const segs = b[o + 26];
    let p = o + 27 + segs;
    for (let i = 0; i < segs; i++) {
      const l = b[o + 27 + i];
      for (let k = 0; k < l && p + k < b.length; k++) cur.push(b[p + k]);
      p += l;
      if (l < 255) {
        packets.push(Uint8Array.from(cur));
        cur = [];
      }
    }
    o = p;
  }
  const head = packets[0];
  if (!head) return;
  let rate = 0;
  if (latin1(head, 0, 8) === 'OpusHead') {
    rate = 48000;
    info.tracks.push({ kind: 'audio', codec: 'Opus', sampleRate: dv(head).getUint32(12, true) || 48000, channels: head[9] });
    if (packets[1] && latin1(packets[1], 0, 8) === 'OpusTags') vorbisComments(packets[1], 8, packets[1].length, info);
  } else if (latin1(head, 1, 6) === 'vorbis') {
    const v = dv(head);
    rate = v.getUint32(12, true);
    const nominal = v.getInt32(20, true);
    info.tracks.push({ kind: 'audio', codec: 'Vorbis', sampleRate: rate, channels: head[11], bitrate: nominal > 0 ? nominal : undefined });
    if (packets[1] && latin1(packets[1], 1, 6) === 'vorbis') vorbisComments(packets[1], 7, packets[1].length, info);
  } else if (latin1(head, 1, 4) === 'FLAC') {
    const sub = head.subarray(13);
    probeFlac(sub, info, fileSize, 0);
    rate = info.tracks[0]?.sampleRate ?? 0;
  } else if (latin1(head, 1, 6) === 'theora') {
    info.tracks.push({ kind: 'video', codec: 'Theora', width: (head[14] << 16) | (head[15] << 8) | head[16], height: (head[17] << 16) | (head[18] << 8) | head[19] });
  }
  // duration = last page's granule position / rate (needs the end of the file)
  if (rate && (info as MediaInfo & { tail?: Uint8Array }).tail) {
    const tail = (info as MediaInfo & { tail?: Uint8Array }).tail!;
    for (let i = tail.length - 27; i >= 0; i--) {
      if (tail[i] === 0x4f && latin1(tail, i, 4) === 'OggS') {
        const v = dv(tail);
        const g = v.getUint32(i + 6, true) + v.getUint32(i + 10, true) * 2 ** 32;
        const pre = latin1(head, 0, 8) === 'OpusHead' ? dv(head).getUint16(10, true) : 0;
        if (g > 0) {
          info.duration = (g - pre) / rate;
          info.bitrate = (fileSize * 8) / info.duration;
          info.tracks[0].duration = info.duration;
        }
        break;
      }
    }
  }
}

// ------------------------------------------------------------------ ISO-BMFF (MP4/MOV/M4A)

interface Box {
  type: string;
  start: number;
  /** content start */
  data: number;
  end: number;
}

function boxes(b: Uint8Array, start: number, end: number): Box[] {
  const out: Box[] = [];
  const v = dv(b);
  let o = start;
  while (o + 8 <= end) {
    let size = v.getUint32(o);
    const type = latin1(b, o + 4, 4);
    let data = o + 8;
    if (size === 1 && o + 16 <= end) {
      size = v.getUint32(o + 8) * 2 ** 32 + v.getUint32(o + 12);
      data = o + 16;
    } else if (size === 0) size = end - o;
    if (size < 8) break;
    out.push({ type, start: o, data, end: Math.min(o + size, end) });
    o += size;
  }
  return out;
}
const child = (b: Uint8Array, box: Box | undefined, type: string, skip = 0) => (box ? boxes(b, box.data + skip, box.end).find((x) => x.type === type) : undefined);

function probeMp4(b: Uint8Array, info: MediaInfo, fileSize: number) {
  const v = dv(b);
  const top = boxes(b, 0, b.length);
  const ftyp = top.find((x) => x.type === 'ftyp');
  if (ftyp) {
    const brand = latin1(b, ftyp.data, 4).trim();
    info.tags['brand'] = brand;
    info.container = brand === 'qt' ? 'QuickTime (MOV)' : /^M4[ABP]/.test(brand) ? 'MPEG-4 audio (M4A)' : brand === '3gp4' || brand.startsWith('3g') ? '3GPP' : 'MPEG-4 (MP4)';
  }
  const moov = top.find((x) => x.type === 'moov');
  if (!moov) {
    const mdat = top.find((x) => x.type === 'mdat');
    info.notes.push(mdat && mdat.end >= b.length - 8 ? 'The index (moov) is at the end of the file and was not read — duration and tracks may be missing. The file is not “fast start”, so it must download fully before it plays online.' : 'No movie header (moov) was found.');
    return;
  }
  const moovIdx = top.indexOf(moov);
  const mdatIdx = top.findIndex((x) => x.type === 'mdat');
  if (mdatIdx >= 0) info.tags['fast start'] = moovIdx < mdatIdx ? 'yes (moov before media data)' : 'no (moov after media data)';
  const mvhd = child(b, moov, 'mvhd');
  if (mvhd) {
    const ver = b[mvhd.data];
    const ts = v.getUint32(mvhd.data + (ver ? 20 : 12));
    const dur = ver ? v.getUint32(mvhd.data + 24) * 2 ** 32 + v.getUint32(mvhd.data + 28) : v.getUint32(mvhd.data + 16);
    if (ts) info.duration = dur / ts;
  }
  for (const trak of boxes(b, moov.data, moov.end).filter((x) => x.type === 'trak')) {
    const tkhd = child(b, trak, 'tkhd');
    const mdia = child(b, trak, 'mdia');
    const hdlr = child(b, mdia, 'hdlr');
    const mdhd = child(b, mdia, 'mdhd');
    const minf = child(b, mdia, 'minf');
    const stbl = child(b, minf, 'stbl');
    const handler = hdlr ? latin1(b, hdlr.data + 8, 4) : '';
    const t: TrackInfo = { kind: handler === 'vide' ? 'video' : handler === 'soun' ? 'audio' : handler === 'subt' || handler === 'text' || handler === 'sbtl' ? 'subtitle' : 'other', codec: '' };
    let ts = 0;
    if (mdhd) {
      const ver = b[mdhd.data];
      ts = v.getUint32(mdhd.data + (ver ? 20 : 12));
      const dur = ver ? v.getUint32(mdhd.data + 24) * 2 ** 32 + v.getUint32(mdhd.data + 28) : v.getUint32(mdhd.data + 16);
      if (ts) t.duration = dur / ts;
      const lang = v.getUint16(mdhd.data + (ver ? 32 : 20));
      const code = String.fromCharCode(((lang >> 10) & 31) + 96, ((lang >> 5) & 31) + 96, (lang & 31) + 96);
      if (/^[a-z]{3}$/.test(code) && code !== 'und') t.language = code;
    }
    if (tkhd && t.kind === 'video') {
      const ver = b[tkhd.data];
      const wOff = tkhd.data + (ver ? 88 : 76);
      t.width = v.getUint32(wOff) / 65536;
      t.height = v.getUint32(wOff + 4) / 65536;
    }
    if (stbl) {
      const stsd = child(b, stbl, 'stsd');
      if (stsd) {
        const entry = boxes(b, stsd.data + 8, stsd.end)[0];
        if (entry) {
          t.codec = entry.type;
          if (t.kind === 'video') {
            const w = v.getUint16(entry.data + 24);
            const h = v.getUint16(entry.data + 26);
            if (!t.width) t.width = w;
            if (!t.height) t.height = h;
            const inner = boxes(b, entry.data + 78, entry.end);
            const avcC = inner.find((x) => x.type === 'avcC');
            if (avcC) {
              const PROF: Record<number, string> = { 66: 'Baseline', 77: 'Main', 88: 'Extended', 100: 'High', 110: 'High 10', 122: 'High 4:2:2', 244: 'High 4:4:4' };
              t.profile = `${PROF[b[avcC.data + 1]] ?? `profile ${b[avcC.data + 1]}`} @ L${(b[avcC.data + 3] / 10).toFixed(1).replace(/\.0$/, '')}`;
            }
            const hvcC = inner.find((x) => x.type === 'hvcC');
            if (hvcC) t.profile = `${['', 'Main', 'Main 10', 'Main Still'][b[hvcC.data + 1] & 31] || 'profile ' + (b[hvcC.data + 1] & 31)} @ L${(b[hvcC.data + 12] / 30).toFixed(1).replace(/\.0$/, '')}`;
          } else if (t.kind === 'audio') {
            t.channels = v.getUint16(entry.data + 16);
            t.bitDepth = v.getUint16(entry.data + 18);
            t.sampleRate = v.getUint32(entry.data + 24) / 65536;
            if (t.codec === 'mp4a') {
              const esds = boxes(b, entry.data + 28, entry.end).find((x) => x.type === 'esds');
              if (esds) {
                // find DecoderConfigDescriptor (tag 4): objectTypeIndication + avg bitrate
                for (let i = esds.data + 4; i < esds.end - 13; i++) {
                  if (b[i] === 4) {
                    let j = i + 1;
                    while (b[j] & 0x80 && j < i + 4) j++;
                    j++;
                    const oti = b[j];
                    if (oti === 0x6b || oti === 0x69) t.codecName = 'MP3';
                    const avg = v.getUint32(j + 9);
                    if (avg) t.bitrate = avg;
                    // AudioSpecificConfig (tag 5) → AAC object type
                    for (let k = j + 13; k < esds.end - 2; k++)
                      if (b[k] === 5) {
                        let m = k + 1;
                        while (b[m] & 0x80 && m < k + 4) m++;
                        m++;
                        const aot = b[m] >> 3;
                        const AOT: Record<number, string> = { 1: 'AAC Main', 2: 'AAC-LC', 3: 'AAC SSR', 4: 'AAC LTP', 5: 'HE-AAC (SBR)', 29: 'HE-AAC v2', 23: 'AAC-LD', 39: 'AAC-ELD' };
                        if (AOT[aot]) t.profile = AOT[aot];
                        break;
                      }
                    break;
                  }
                }
              }
            }
          }
        }
      }
      // frame count and fps from the time-to-sample table
      const stts = child(b, stbl, 'stts');
      if (stts && t.kind === 'video') {
        const n = v.getUint32(stts.data + 4);
        let frames = 0;
        let ticks = 0;
        for (let i = 0; i < n && stts.data + 8 + i * 8 + 8 <= stts.end; i++) {
          const c = v.getUint32(stts.data + 8 + i * 8);
          frames += c;
          ticks += c * v.getUint32(stts.data + 12 + i * 8);
        }
        t.frames = frames;
        if (ticks && ts) t.fps = Math.round((frames / (ticks / ts)) * 1000) / 1000;
      }
      // average bitrate from sample sizes
      const stsz = child(b, stbl, 'stsz');
      if (stsz && t.duration && !t.bitrate) {
        const fixed = v.getUint32(stsz.data + 4);
        const count = v.getUint32(stsz.data + 8);
        let total = fixed * count;
        if (!fixed) for (let i = 0; i < count && stsz.data + 12 + i * 4 + 4 <= stsz.end; i++) total += v.getUint32(stsz.data + 12 + i * 4);
        if (total) t.bitrate = (total * 8) / t.duration;
      }
    }
    t.codecName ??= name(t.codec);
    info.tracks.push(t);
  }
  // iTunes-style metadata
  const ilst = child(b, child(b, child(b, moov, 'udta'), 'meta', 4), 'ilst');
  if (ilst) {
    const MAP: Record<string, string> = { '©nam': 'title', '©ART': 'artist', '©alb': 'album', '©day': 'year', '©gen': 'genre', '©too': 'encoder', '©cmt': 'comment', aART: 'album artist', '©wrt': 'composer' };
    for (const item of boxes(b, ilst.data, ilst.end)) {
      const key = item.type.replace(/^\xa9/, '©');
      const data = child(b, item, 'data');
      if (key === 'covr') info.tags['cover art'] = 'yes';
      else if (MAP[key] && data) info.tags[MAP[key]] = utf8(b.subarray(data.data + 8, data.end));
    }
  }
  if (info.duration) info.bitrate = (fileSize * 8) / info.duration;
}

// ------------------------------------------------------------------ Matroska / WebM

function readVint(b: Uint8Array, o: number, keepMarker: boolean): { value: number; len: number } | null {
  const first = b[o];
  if (first === undefined || first === 0) return null;
  let len = 1;
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
  if (len > 8 || o + len > b.length) return null;
  let value = keepMarker ? first : first & (0xff >> len);
  let allOnes = value === (0xff >> len);
  for (let i = 1; i < len; i++) {
    value = value * 256 + b[o + i];
    if (b[o + i] !== 0xff) allOnes = false;
  }
  return { value: !keepMarker && allOnes ? -1 : value, len };
}

function ebml(b: Uint8Array, start: number, end: number, cb: (id: number, data: number, size: number) => boolean | void) {
  let o = start;
  while (o < end) {
    const id = readVint(b, o, true);
    if (!id) return;
    const size = readVint(b, o + id.len, false);
    if (!size) return;
    const data = o + id.len + size.len;
    const len = size.value < 0 ? end - data : size.value;
    if (cb(id.value, data, Math.min(len, b.length - data)) === false) return;
    o = data + len;
  }
}
const uint = (b: Uint8Array, o: number, n: number) => {
  let x = 0;
  for (let i = 0; i < n; i++) x = x * 256 + b[o + i];
  return x;
};
const float = (b: Uint8Array, o: number, n: number) => (n === 4 ? dv(b).getFloat32(o) : n === 8 ? dv(b).getFloat64(o) : 0);

function probeMatroska(b: Uint8Array, info: MediaInfo, fileSize: number) {
  ebml(b, 0, b.length, (id, data, size) => {
    if (id === 0x1a45dfa3) {
      ebml(b, data, data + size, (cid, d, s) => {
        if (cid === 0x4282) info.container = latin1(b, d, s) === 'webm' ? 'WebM' : 'Matroska (MKV)';
      });
    } else if (id === 0x18538067) {
      let scale = 1e6;
      let dur = 0;
      ebml(b, data, Math.min(b.length, data + size), (sid, d, s) => {
        if (sid === 0x1549a966) {
          ebml(b, d, d + s, (iid, id2, is) => {
            if (iid === 0x2ad7b1) scale = uint(b, id2, is);
            else if (iid === 0x4489) dur = float(b, id2, is);
            else if (iid === 0x4d80) info.tags['muxing app'] = utf8(b.subarray(id2, id2 + is));
            else if (iid === 0x5741) info.tags['writing app'] = utf8(b.subarray(id2, id2 + is));
            else if (iid === 0x7ba9) info.tags['title'] = utf8(b.subarray(id2, id2 + is));
          });
        } else if (sid === 0x1654ae6b) {
          ebml(b, d, d + s, (tid, td, ts) => {
            if (tid !== 0xae) return;
            const t: TrackInfo = { kind: 'other', codec: '' };
            let defaultDuration = 0;
            ebml(b, td, td + ts, (eid, ed, es) => {
              if (eid === 0x83) t.kind = ({ 1: 'video', 2: 'audio', 17: 'subtitle' } as Record<number, TrackInfo['kind']>)[uint(b, ed, es)] ?? 'other';
              else if (eid === 0x86) t.codec = latin1(b, ed, es).replace(/\0+$/, '');
              else if (eid === 0x22b59c) t.language = latin1(b, ed, es).replace(/\0+$/, '');
              else if (eid === 0x23e383) defaultDuration = uint(b, ed, es);
              else if (eid === 0xe0)
                ebml(b, ed, ed + es, (vid, vd, vs) => {
                  if (vid === 0xb0) t.width = uint(b, vd, vs);
                  else if (vid === 0xba) t.height = uint(b, vd, vs);
                });
              else if (eid === 0xe1)
                ebml(b, ed, ed + es, (aid, ad, as) => {
                  if (aid === 0xb5) t.sampleRate = float(b, ad, as);
                  else if (aid === 0x9f) t.channels = uint(b, ad, as);
                  else if (aid === 0x6264) t.bitDepth = uint(b, ad, as);
                });
            });
            if (defaultDuration && t.kind === 'video') t.fps = Math.round((1e9 / defaultDuration) * 1000) / 1000;
            if (t.language === 'und') delete t.language;
            t.codecName = name(t.codec);
            info.tracks.push(t);
          });
        } else if (sid === 0x1f43b675) return false; // first cluster: stop
      });
      if (dur) info.duration = (dur * scale) / 1e9;
      return false;
    }
  });
  if (info.duration) info.bitrate = (fileSize * 8) / info.duration;
  else info.notes.push('No duration is stored in the header (common for files recorded in a browser).');
}

// ------------------------------------------------------------------ AVI

function probeAvi(b: Uint8Array, info: MediaInfo, fileSize: number) {
  const v = dv(b);
  const text = latin1(b, 0, Math.min(b.length, 256 * 1024));
  const avih = text.indexOf('avih');
  let usPerFrame = 0;
  let frames = 0;
  if (avih > 0) {
    usPerFrame = v.getUint32(avih + 8, true);
    frames = v.getUint32(avih + 24, true);
    if (usPerFrame) info.duration = (frames * usPerFrame) / 1e6;
  }
  // each stream: 'strh' (type + handler) followed by 'strf' (format)
  for (let i = text.indexOf('strh'); i >= 0; i = text.indexOf('strh', i + 4)) {
    const type = latin1(b, i + 8, 4);
    const handler = latin1(b, i + 12, 4).replace(/\0/g, '').trim();
    const strhLen = v.getUint32(i + 4, true);
    const strf = i + 8 + strhLen + (strhLen & 1);
    const hasStrf = latin1(b, strf, 4) === 'strf';
    if (type === 'vids') {
      const t: TrackInfo = { kind: 'video', codec: handler, frames };
      if (hasStrf) {
        t.width = v.getInt32(strf + 12, true);
        t.height = Math.abs(v.getInt32(strf + 16, true));
        const comp = latin1(b, strf + 24, 4).replace(/\0/g, '').trim();
        if (comp) t.codec = comp;
      }
      if (usPerFrame) t.fps = Math.round((1e6 / usPerFrame) * 1000) / 1000;
      t.duration = info.duration;
      info.tracks.push(t);
    } else if (type === 'auds') {
      const t: TrackInfo = { kind: 'audio', codec: 'audio' };
      if (hasStrf) {
        const tag = v.getUint16(strf + 8, true);
        t.codec = ({ 1: 'PCM', 0x55: 'MP3', 0xff: 'AAC', 0x2000: 'AC-3', 0x161: 'WMA' } as Record<number, string>)[tag] ?? `format 0x${tag.toString(16)}`;
        t.channels = v.getUint16(strf + 10, true);
        t.sampleRate = v.getUint32(strf + 12, true);
        t.bitrate = v.getUint32(strf + 16, true) * 8;
      }
      info.tracks.push(t);
    }
  }
  if (info.duration) info.bitrate = (fileSize * 8) / info.duration;
}

const MJPEG: Record<string, string> = { MJPG: 'Motion JPEG', XVID: 'Xvid (MPEG-4)', DIVX: 'DivX (MPEG-4)', DX50: 'DivX 5', H264: 'H.264 / AVC', FMP4: 'MPEG-4 Visual' };
Object.assign(CODEC_NAMES, MJPEG);

const MIME: Record<string, string> = { wav: 'audio/wav', aiff: 'audio/aiff', mp3: 'audio/mpeg', aac: 'audio/aac', flac: 'audio/flac', ogg: 'audio/ogg', mp4: 'video/mp4', matroska: 'video/webm', avi: 'video/x-msvideo' };
const CONTAINER: Record<string, string> = { wav: 'WAV', aiff: 'AIFF', mp3: 'MP3', aac: 'AAC (ADTS)', flac: 'FLAC', ogg: 'Ogg', mp4: 'MPEG-4', matroska: 'Matroska', avi: 'AVI', gif: 'GIF', unknown: 'Unknown' };

/**
 * `head` is the start of the file (a few MB is enough for most files), `tail`
 * the last ~64 KB (used for Ogg duration), `fileSize` the full size.
 */
export function probeMedia(head: Uint8Array, fileSize: number, tail?: Uint8Array): MediaInfo {
  const kind = detectContainer(head);
  const info: MediaInfo & { tail?: Uint8Array } = { container: CONTAINER[kind] ?? kind, mime: MIME[kind], tracks: [], tags: {}, notes: [], tail };
  try {
    if (kind === 'wav') probeWav(head, info, fileSize);
    else if (kind === 'aiff') probeAiff(head, info, fileSize);
    else if (kind === 'mp3') probeMp3(head, info, fileSize);
    else if (kind === 'flac') probeFlac(head, info, fileSize);
    else if (kind === 'ogg') probeOgg(head, info, fileSize);
    else if (kind === 'mp4') probeMp4(head, info, fileSize);
    else if (kind === 'matroska') probeMatroska(head, info, fileSize);
    else if (kind === 'avi') probeAvi(head, info, fileSize);
    else if (kind === 'aac') {
      const sr = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350][(head[2] >> 2) & 15];
      info.tracks.push({ kind: 'audio', codec: 'AAC', profile: ['AAC Main', 'AAC-LC', 'AAC SSR', 'AAC LTP'][head[2] >> 6], sampleRate: sr, channels: ((head[2] & 1) << 2) | (head[3] >> 6) });
      info.notes.push('Raw AAC (ADTS) stores no duration in its header.');
    } else info.notes.push('This file type is not recognised as audio or video.');
  } catch {
    info.notes.push('Part of the header could not be read; the file may be damaged or truncated.');
  }
  delete info.tail;
  for (const t of info.tracks) t.codecName ??= name(t.codec);
  if (info.duration !== undefined && !(info.duration > 0 && Number.isFinite(info.duration))) delete info.duration;
  return info;
}
