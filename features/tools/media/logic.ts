/** Estimates only: real files vary with codec, container overhead and variable bitrate. */
export function estimateSize(o: { videoKbps: number; audioKbps: number; seconds: number; overheadPct: number }) {
  const { videoKbps, audioKbps, seconds, overheadPct } = o;
  if (videoKbps < 0 || audioKbps < 0) throw new Error('Bitrates cannot be negative.');
  if (!(seconds > 0)) throw new Error('Duration must be greater than zero.');
  if (videoKbps + audioKbps <= 0) throw new Error('Enter a video or audio bitrate.');
  const bits = (videoKbps + audioKbps) * 1000 * seconds * (1 + overheadPct / 100);
  return { bytes: bits / 8 };
}

export function bitrateForSize(o: { targetBytes: number; seconds: number; audioKbps: number; overheadPct: number }) {
  if (!(o.targetBytes > 0) || !(o.seconds > 0)) throw new Error('Enter a target size and duration greater than zero.');
  const totalKbps = (o.targetBytes * 8) / (1 + o.overheadPct / 100) / o.seconds / 1000;
  const videoKbps = totalKbps - o.audioKbps;
  if (videoKbps <= 0) throw new Error('The audio bitrate alone already exceeds the target size.');
  return { totalKbps, videoKbps };
}

export function parseClock(s: string): number {
  const t = s.trim();
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (m) {
    if (Number(m[2]) > 59 || Number(m[3]) >= 60) throw new Error('Minutes and seconds must be below 60.');
    return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t) * 60;
  throw new Error('Enter a duration like 1:30:00, 4:20 or 90 (minutes).');
}
