'use client';

import { formatBytes } from '@/lib/format';
import { formatTime } from './audio';
import type { MediaInfo, TrackInfo } from './probe';

const kbps = (b?: number) => (b ? `${Math.round(b / 1000).toLocaleString()} kbps` : undefined);
const ch = (n?: number) => (n === 1 ? 'Mono' : n === 2 ? 'Stereo' : n ? `${n} channels${n === 6 ? ' (5.1)' : n === 8 ? ' (7.1)' : ''}` : undefined);

export function trackRows(t: TrackInfo): Array<[string, string | undefined]> {
  return [
    ['Codec', [t.codecName ?? t.codec, t.codecName && t.codec && t.codecName !== t.codec ? `(${t.codec})` : ''].join(' ').trim() || undefined],
    ['Profile', t.profile],
    ['Resolution', t.width && t.height ? `${t.width} × ${t.height}${aspect(t.width, t.height)}` : undefined],
    ['Frame rate', t.fps ? `${t.fps} fps` : undefined],
    ['Frames', t.frames ? t.frames.toLocaleString() : undefined],
    ['Sample rate', t.sampleRate ? `${t.sampleRate.toLocaleString()} Hz` : undefined],
    ['Channels', ch(t.channels)],
    ['Bit depth', t.bitDepth && t.kind === 'audio' && !/aac|mp4a|opus|vorbis/i.test(t.codec) ? `${t.bitDepth}-bit` : undefined],
    ['Bitrate', kbps(t.bitrate)],
    ['Duration', t.duration ? formatTime(t.duration, 3) : undefined],
    ['Language', t.language],
  ];
}

function aspect(w: number, h: number) {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = g(w, h);
  const r = `${w / d}:${h / d}`;
  const named: Record<string, string> = { '16:9': '16:9', '4:3': '4:3', '1:1': '1:1', '9:16': '9:16 vertical', '21:9': '21:9', '64:27': '21:9', '256:135': '≈17:9 (DCI)', '3:2': '3:2' };
  return named[r] ? ` (${named[r]})` : ` (${(w / h).toFixed(2)}:1)`;
}

export function MediaInfoTable({ info, file, extra = [] }: { info: MediaInfo; file: File; extra?: Array<[string, string | undefined]> }) {
  const general: Array<[string, string | undefined]> = [
    ['File', file.name],
    ['Size', formatBytes(file.size)],
    ['Container', info.container],
    ['Duration', info.duration ? formatTime(info.duration, 3) : undefined],
    ['Overall bitrate', kbps(info.bitrate)],
    ...extra,
  ];
  const tags = Object.entries(info.tags);
  return (
    <div className="stack">
      <div className="table-scroll">
        <table className="data-table compact">
          <caption>General</caption>
          <tbody>
            {general
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td className="cell">{v}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {info.tracks.map((t, i) => (
        <div className="table-scroll" key={i}>
          <table className="data-table compact">
            <caption>
              {t.kind === 'video' ? 'Video' : t.kind === 'audio' ? 'Audio' : t.kind === 'subtitle' ? 'Subtitles' : 'Other'} track{info.tracks.filter((x) => x.kind === t.kind).length > 1 ? ` ${info.tracks.filter((x) => x.kind === t.kind).indexOf(t) + 1}` : ''}
            </caption>
            <tbody>
              {trackRows(t)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td className="cell">{v}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
      {tags.length > 0 && (
        <div className="table-scroll">
          <table className="data-table compact">
            <caption>Tags & details</caption>
            <tbody>
              {tags.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td className="cell">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {info.notes.map((n) => (
        <p key={n} className="field-hint">
          {n}
        </p>
      ))}
    </div>
  );
}
