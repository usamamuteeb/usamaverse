'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { downloadBlob } from '@/lib/tools/shared/download';
import { duration, formatTime, normalize, toMono, type WavDepth } from './audio';
import { baseName } from './browser';
import { DEPTH_CHOICES, useAudioFile, useWavResult } from './useAudio';
import { Waveform } from './Waveform';

export default function ExtractAudio() {
  const { audio, busy, error, load, reset } = useAudioFile();
  const [mono, setMono] = useState(false);
  const [norm, setNorm] = useState(false);
  const [depth, setDepth] = useState('16');
  const result = useMemo(() => {
    if (!audio) return null;
    let p = audio.pcm;
    if (mono) p = toMono(p);
    if (norm) p = normalize(p, -1).pcm;
    return p;
  }, [audio, mono, norm]);
  const { blob, url } = useWavResult(result, Number(depth) as WavDepth);
  const src = audio?.info.tracks.find((t) => t.kind === 'audio');
  const video = audio?.info.tracks.find((t) => t.kind === 'video');

  return (
    <div className="stack">
      {!audio && (
        <FileDrop accept="video/*,.mp4,.m4v,.mov,.webm,.mkv,.ogv" onFiles={(f) => load(f[0])} label="Choose video">
          <p>Choose a video (MP4, MOV, WebM…) to save its soundtrack as a WAV file. The video is read on your device, never uploaded.</p>
        </FileDrop>
      )}
      {busy && <Status tone="info">Decoding the soundtrack…</Status>}
      {error && <Status tone="error">{error}</Status>}
      {audio && result && (
        <>
          <p className="field-hint" style={{ margin: 0 }}>
            <strong>{audio.file.name}</strong>
            {video?.width ? ` · ${video.width}×${video.height}` : ''} · soundtrack {src ? `${src.codecName ?? src.codec}, ` : ''}
            {formatTime(duration(audio.pcm))}, {audio.pcm.sampleRate.toLocaleString()} Hz, {audio.pcm.channels.length === 1 ? 'mono' : `${audio.pcm.channels.length} channels`}
          </p>
          <Waveform pcm={result} label="Waveform of the soundtrack" />
          <div className="form-grid">
            <SelectField label="WAV format" value={depth} onChange={setDepth} options={DEPTH_CHOICES} />
          </div>
          <CheckboxField label="Convert to mono" checked={mono} onChange={setMono} />
          <CheckboxField label="Normalize to −1 dBFS" checked={norm} onChange={setNorm} />
          {url && <audio className="media-player" controls src={url} />}
          <div className="actions">
            <Button variant="primary" disabled={!blob} onClick={() => blob && downloadBlob(blob, `${baseName(audio.file.name)}.wav`)}>
              Download WAV
            </Button>
            <Button variant="ghost" onClick={reset}>
              Choose another video
            </Button>
          </div>
          <p className="field-hint">The soundtrack is decoded and saved as uncompressed WAV, so the file is larger than the original audio. Which video formats work depends on your browser (MP4/AAC works everywhere; WebM/Opus is not supported in some Safari versions).</p>
        </>
      )}
    </div>
  );
}
