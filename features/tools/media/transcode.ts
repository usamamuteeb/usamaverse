export type VideoAction = 'trim' | 'mute' | 'convert';
export type MediaFormat = 'mp4' | 'webm' | 'gif' | 'mp3' | 'wav';

export function mediaCommand(action: VideoAction, input: string, output: string, opts: { start?: number; end?: number; format?: MediaFormat }): string[] {
  if (action === 'trim') {
    const start = opts.start ?? 0;
    const end = opts.end ?? 0;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start > 600) throw new Error('Choose a valid segment up to 10 minutes.');
    return ['-ss', String(start), '-i', input, '-t', String(end - start), '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '25', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output];
  }
  if (action === 'mute') return ['-i', input, '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '25', '-movflags', '+faststart', output];
  switch (opts.format) {
    case 'mp4': return ['-i', input, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '25', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output];
    case 'webm': return ['-i', input, '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '1M', '-c:a', 'libopus', output];
    case 'gif': return ['-i', input, '-vf', 'fps=10,scale=480:-1:flags=lanczos', '-loop', '0', output];
    case 'mp3': return ['-i', input, '-vn', '-c:a', 'libmp3lame', '-q:a', '4', output];
    case 'wav': return ['-i', input, '-vn', '-c:a', 'pcm_s16le', output];
    default: throw new Error('Choose an output format.');
  }
}

export const MEDIA_MIME: Record<MediaFormat, string> = { mp4: 'video/mp4', webm: 'video/webm', gif: 'image/gif', mp3: 'audio/mpeg', wav: 'audio/wav' };
