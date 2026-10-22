'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { downloadBlob } from '@/lib/tools/shared/download';
import { duration, fade, formatTime, parseTime, slice, trimSilence, type WavDepth } from './audio';
import { baseName } from './browser';
import { DEPTH_CHOICES, useAudioFile, useWavResult } from './useAudio';
import { Waveform } from './Waveform';

export default function AudioTrim() {
  const { audio, busy, error, load, reset } = useAudioFile();
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [startText, setStartText] = useState('0:00.00');
  const [endText, setEndText] = useState('0:00.00');
  const [fadeIn, setFadeIn] = useState('0');
  const [fadeOut, setFadeOut] = useState('0');
  const [depth, setDepth] = useState('16');
  const [autoSilence, setAutoSilence] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const player = useRef<HTMLAudioElement>(null);
  const total = audio ? duration(audio.pcm) : 0;

  useEffect(() => {
    if (!audio) return;
    setStart(0);
    setEnd(duration(audio.pcm));
  }, [audio]);
  useEffect(() => setStartText(formatTime(start)), [start]);
  useEffect(() => setEndText(formatTime(end)), [end]);

  const result = useMemo(() => {
    if (!audio || end - start < 0.01) return null;
    try {
      let p = slice(audio.pcm, start, end);
      if (autoSilence) p = trimSilence(p);
      return fade(p, Math.max(0, Number(fadeIn) || 0), Math.max(0, Number(fadeOut) || 0));
    } catch {
      return null;
    }
  }, [audio, start, end, fadeIn, fadeOut, autoSilence]);
  const { blob, url } = useWavResult(result, Number(depth) as WavDepth);
  const resultLen = result ? duration(result) : 0;

  const commit = (which: 'start' | 'end', text: string) => {
    const t = parseTime(text);
    if (!Number.isFinite(t)) return which === 'start' ? setStartText(formatTime(start)) : setEndText(formatTime(end));
    const c = Math.max(0, Math.min(total, t));
    if (which === 'start') setStart(Math.min(c, end));
    else setEnd(Math.max(c, start));
  };

  return (
    <div className="stack">
      {!audio && (
        <FileDrop accept="audio/*,video/*,.mp3,.wav,.flac,.ogg,.opus,.m4a,.aac,.aiff,.webm,.mp4" onFiles={(f) => load(f[0])} label="Choose audio">
          <p>Choose an audio file (or a video to cut its sound). Nothing is uploaded.</p>
        </FileDrop>
      )}
      {busy && <Status tone="info">Decoding…</Status>}
      {error && <Status tone="error">{error}</Status>}
      {audio && (
        <>
          <p className="field-hint" style={{ margin: 0 }}>
            <strong>{audio.file.name}</strong> · {formatTime(total)} · drag on the waveform to select the part to keep.
          </p>
          <Waveform pcm={audio.pcm} start={start} end={end} playhead={playhead} onSelect={(a, b) => (setStart(a), setEnd(b))} label={`Waveform of ${audio.file.name}`} />
          <div className="form-grid">
            <TextField label="Start" hint="m:ss.00 or seconds" value={startText} onChange={setStartText} inputMode="decimal" />
            <TextField label="End" value={endText} onChange={setEndText} inputMode="decimal" />
            <TextField label="Fade in (s)" value={fadeIn} onChange={setFadeIn} inputMode="decimal" />
            <TextField label="Fade out (s)" value={fadeOut} onChange={setFadeOut} inputMode="decimal" />
            <SelectField label="WAV format" value={depth} onChange={setDepth} options={DEPTH_CHOICES} />
          </div>
          <div className="actions">
            <Button variant="ghost" onClick={() => (commit('start', startText), commit('end', endText))}>
              Apply times
            </Button>
            <Button variant="ghost" onClick={() => (setStart(0), setEnd(total))}>
              Select all
            </Button>
            <Button variant="ghost" onClick={reset}>
              Choose another file
            </Button>
          </div>
          <CheckboxField label="Also cut silence at both ends of the selection" checked={autoSilence} onChange={setAutoSilence} />
          {result && url && blob ? (
            <div className="stack">
              <audio
                ref={player}
                className="media-player"
                controls
                src={url}
                onTimeUpdate={(e) => setPlayhead(start + (e.currentTarget.currentTime || 0))}
                onEnded={() => setPlayhead(null)}
                onPause={() => setPlayhead(null)}
              />
              <div className="actions">
                <Button variant="primary" onClick={() => downloadBlob(blob, `${baseName(audio.file.name)}-trimmed.wav`)}>
                  Download WAV ({formatTime(resultLen)})
                </Button>
              </div>
            </div>
          ) : (
            <Status tone="info">Select at least 0.01 seconds.</Status>
          )}
          <p className="field-hint">The result is saved as WAV (lossless). Use your device’s or another tool’s encoder if you need MP3 or AAC.</p>
        </>
      )}
    </div>
  );
}
