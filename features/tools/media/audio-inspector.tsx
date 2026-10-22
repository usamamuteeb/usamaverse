'use client';

import { useMemo } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { FileDrop, useObjectUrl } from '@/components/tool-kit/files';
import { analyze, formatTime } from './audio';
import { MediaInfoTable } from './MediaInfoTable';
import { useAudioFile } from './useAudio';
import { Waveform } from './Waveform';

const db = (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)} dBFS` : '−∞ (silent)');

export default function AudioInspector() {
  const { audio, busy, error, load, reset } = useAudioFile();
  const url = useObjectUrl(audio?.file ?? null);
  const stats = useMemo(() => (audio ? analyze(audio.pcm) : null), [audio]);

  return (
    <div className="stack">
      <FileDrop accept="audio/*,.mp3,.wav,.flac,.ogg,.opus,.m4a,.aac,.aiff,.aif,.webm" onFiles={(f) => load(f[0])} label="Choose audio">
        <p>Choose an audio file (MP3, WAV, FLAC, M4A, Ogg, Opus…) or drop it here. It is read on your device and never uploaded.</p>
      </FileDrop>
      {busy && <Status tone="info">Reading and decoding…</Status>}
      {error && <Status tone="error">{error}</Status>}
      {audio && stats && (
        <>
          <Waveform pcm={audio.pcm} label={`Waveform of ${audio.file.name}`} />
          {url && <audio className="media-player" controls src={url} preload="metadata" />}
          <dl className="stat-grid">
            <div className="stat">
              <dt>Duration</dt>
              <dd>{formatTime(stats.duration)}</dd>
            </div>
            <div className="stat">
              <dt>Peak</dt>
              <dd>{db(stats.peakDb)}</dd>
            </div>
            <div className="stat">
              <dt>Average (RMS)</dt>
              <dd>{db(stats.rmsDb)}</dd>
            </div>
            <div className="stat">
              <dt>Clipped samples</dt>
              <dd>{stats.clipped.toLocaleString()}</dd>
            </div>
            <div className="stat">
              <dt>Silence start / end</dt>
              <dd>
                {stats.leadingSilence.toFixed(2)} s / {stats.trailingSilence.toFixed(2)} s
              </dd>
            </div>
          </dl>
          {stats.clipped > 10 && <Status tone="warn">{stats.clipped.toLocaleString()} samples reach full scale — the recording is probably clipped (distorted) in places.</Status>}
          {stats.peakDb < -12 && Number.isFinite(stats.peakDb) && <Status tone="info">The audio is quiet (peak {stats.peakDb.toFixed(1)} dBFS). The Audio Volume Adjuster can normalize it.</Status>}
          {Math.abs(stats.dcOffset) > 0.01 && <Status tone="info">There is a DC offset of {(stats.dcOffset * 100).toFixed(1)}% — the waveform is not centred, which some recorders cause.</Status>}
          <MediaInfoTable info={audio.info} file={audio.file} extra={[['Decoded as', `${audio.pcm.sampleRate.toLocaleString()} Hz, ${audio.pcm.channels.length} channel${audio.pcm.channels.length > 1 ? 's' : ''}`]]} />
          <p className="field-hint">Levels are measured on the decoded samples. RMS is a simple average, not an EBU R128 / LUFS loudness reading.</p>
          <div className="actions">
            <Button variant="ghost" onClick={reset}>
              Clear
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
