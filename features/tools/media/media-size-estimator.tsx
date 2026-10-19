'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatBytes } from '@/lib/format';
import { parseNum } from '@/features/tools/math/logic';
import { bitrateForSize, estimateSize, parseClock } from './logic';

const fields: FieldDef[] = [
  { type: 'select', key: 'mode', label: 'Calculate', default: 'size', choices: [{ value: 'size', label: 'File size from bitrate' }, { value: 'bitrate', label: 'Bitrate for a target size' }] },
  { type: 'text', key: 'duration', label: 'Duration', default: '10:00', hint: 'h:mm:ss, m:ss, or minutes (e.g. 90).' },
  { type: 'number', key: 'video', label: 'Video bitrate', default: '5000', suffix: 'kbps', showIf: (v) => v.mode === 'size', hint: 'Typical: 1080p ≈ 4,000–8,000 kbps, 720p ≈ 2,500–5,000, 4K ≈ 15,000–45,000.' },
  { type: 'number', key: 'target', label: 'Target size', default: '100', suffix: 'MB', showIf: (v) => v.mode === 'bitrate' },
  { type: 'number', key: 'audio', label: 'Audio bitrate', default: '128', suffix: 'kbps' },
  { type: 'number', key: 'overhead', label: 'Container overhead', default: '2', suffix: '%' },
];

function compute(v: FormValues): FormResult | null {
  if (!String(v.duration).trim()) return null;
  const seconds = parseClock(String(v.duration));
  const audio = parseNum(v.audio, 'the audio bitrate', { min: 0 });
  const overhead = parseNum(v.overhead, 'the overhead', { min: 0, max: 50 });
  if (v.mode === 'bitrate') {
    const r = bitrateForSize({ targetBytes: parseNum(v.target, 'the target size', { min: 0 }) * 1e6, seconds, audioKbps: audio, overheadPct: overhead });
    return { rows: [{ label: 'Video bitrate', value: `${Math.floor(r.videoKbps).toLocaleString('en-US')} kbps`, emphasis: true }, { label: 'Total bitrate', value: `${Math.floor(r.totalKbps).toLocaleString('en-US')} kbps` }], note: 'An estimate for constant/average bitrate encoding. Leave some margin: variable bitrate encoders can overshoot.' };
  }
  const r = estimateSize({ videoKbps: parseNum(v.video, 'the video bitrate', { min: 0 }), audioKbps: audio, seconds, overheadPct: overhead });
  return { rows: [{ label: 'Estimated size', value: formatBytes(r.bytes), emphasis: true }, { label: 'Per minute', value: formatBytes((r.bytes / seconds) * 60) }], note: 'An estimate: real files vary with codec, content complexity, variable bitrate and container overhead.' };
}

export default function MediaSizeEstimator() {
  return <FormTool fields={fields} compute={compute} />;
}
