'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { CheckboxField, RangeField, SelectField, Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { downloadBlob } from '@/lib/tools/shared/download';
import { analyze, dbToGain, duration, formatTime, gain, normalize, peak, reverse, toMono, trimSilence, type Pcm, type WavDepth } from './audio';
import { baseName, resample } from './browser';
import { DEPTH_CHOICES, useAudioFile, useWavResult } from './useAudio';
import { Waveform } from './Waveform';

const RATES = [
  { value: 'keep', label: 'Keep original' },
  { value: '8000', label: '8,000 Hz (phone)' },
  { value: '16000', label: '16,000 Hz (speech)' },
  { value: '22050', label: '22,050 Hz' },
  { value: '44100', label: '44,100 Hz (CD)' },
  { value: '48000', label: '48,000 Hz (video)' },
];

export default function AudioAdjust() {
  const { audio, busy, error, load, reset } = useAudioFile();
  const [mode, setMode] = useState<'normalize' | 'gain'>('normalize');
  const [target, setTarget] = useState(-1);
  const [gainDb, setGainDb] = useState(0);
  const [mono, setMono] = useState(false);
  const [rev, setRev] = useState(false);
  const [silence, setSilence] = useState(false);
  const [rate, setRate] = useState('keep');
  const [depth, setDepth] = useState('16');
  const [result, setResult] = useState<Pcm | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const before = useMemo(() => (audio ? analyze(audio.pcm) : null), [audio]);

  useEffect(() => {
    if (!audio) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setWorking(true);
    const t = setTimeout(async () => {
      try {
        let p: Pcm = audio.pcm;
        if (silence) p = trimSilence(p);
        if (mono) p = toMono(p);
        if (rev) p = reverse(p);
        let msg: string | null = null;
        if (mode === 'normalize') {
          const r = normalize(p, target);
          p = r.pcm;
          msg = `Changed the level by ${r.appliedDb >= 0 ? '+' : ''}${r.appliedDb.toFixed(1)} dB so the loudest peak is ${target} dBFS.`;
        } else if (gainDb !== 0) {
          p = gain(p, dbToGain(gainDb));
          const pk = peak(p);
          if (pk > 1) msg = `Peaks now exceed full scale by ${(20 * Math.log10(pk)).toFixed(1)} dB and will clip in 16/24-bit files. Lower the gain or choose 32-bit float.`;
        }
        if (rate !== 'keep') p = await resample(p, Number(rate));
        if (!cancelled) {
          setResult(p);
          setNote(msg);
        }
      } catch (e) {
        if (!cancelled) setNote((e as Error).message);
      } finally {
        if (!cancelled) setWorking(false);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [audio, mode, target, gainDb, mono, rev, silence, rate]);

  const { blob, url } = useWavResult(result, Number(depth) as WavDepth);
  const after = useMemo(() => (result ? analyze(result) : null), [result]);

  return (
    <div className="stack">
      {!audio && (
        <FileDrop accept="audio/*,video/*,.mp3,.wav,.flac,.ogg,.opus,.m4a,.aac,.aiff,.webm,.mp4" onFiles={(f) => load(f[0])} label="Choose audio">
          <p>Choose an audio file to make louder, quieter or mono. Nothing is uploaded.</p>
        </FileDrop>
      )}
      {busy && <Status tone="info">Decoding…</Status>}
      {error && <Status tone="error">{error}</Status>}
      {audio && before && (
        <>
          <p className="field-hint" style={{ margin: 0 }}>
            <strong>{audio.file.name}</strong> · {formatTime(before.duration)} · peak {before.peakDb.toFixed(1)} dBFS · {audio.pcm.channels.length === 1 ? 'mono' : `${audio.pcm.channels.length} channels`} · {audio.pcm.sampleRate.toLocaleString()} Hz
          </p>
          <div className="tool-grid">
            <div className="tool-col">
              <SelectField label="Volume" value={mode} onChange={(v) => setMode(v as 'normalize' | 'gain')} options={[{ value: 'normalize', label: 'Normalize to a peak level' }, { value: 'gain', label: 'Change by a fixed amount' }]} />
              {mode === 'normalize' ? (
                <RangeField label="Peak level" value={target} onChange={setTarget} min={-20} max={0} step={0.5} format={(v) => `${v} dBFS`} hint="−1 dBFS leaves a little headroom for MP3/AAC encoding." />
              ) : (
                <RangeField label="Gain" value={gainDb} onChange={setGainDb} min={-30} max={30} step={0.5} format={(v) => `${v > 0 ? '+' : ''}${v} dB`} hint="+6 dB is about twice as loud in level; −6 dB about half." />
              )}
              <SelectField label="Sample rate" value={rate} onChange={setRate} options={RATES} />
              <SelectField label="WAV format" value={depth} onChange={setDepth} options={DEPTH_CHOICES} />
            </div>
            <div className="tool-col">
              <CheckboxField label="Convert to mono" checked={mono} onChange={setMono} />
              <CheckboxField label="Cut silence at the start and end" checked={silence} onChange={setSilence} />
              <CheckboxField label="Reverse" checked={rev} onChange={setRev} />
            </div>
          </div>
          {working && <Status tone="info">Processing…</Status>}
          {note && <Status tone={/clip|exceed/i.test(note) ? 'warn' : 'info'}>{note}</Status>}
          {result && <Waveform pcm={result} label="Waveform of the result" />}
          {after && (
            <p className="field-hint" style={{ margin: 0 }}>
              Result: {formatTime(after.duration)} · peak {Number.isFinite(after.peakDb) ? after.peakDb.toFixed(1) : '−∞'} dBFS · RMS {Number.isFinite(after.rmsDb) ? after.rmsDb.toFixed(1) : '−∞'} dBFS · {result!.sampleRate.toLocaleString()} Hz
            </p>
          )}
          {url && <audio className="media-player" controls src={url} />}
          <div className="actions">
            <Button variant="primary" disabled={!blob || working} onClick={() => blob && downloadBlob(blob, `${baseName(audio.file.name)}-adjusted.wav`)}>
              Download WAV{result ? ` (${formatTime(duration(result))})` : ''}
            </Button>
            <Button variant="ghost" onClick={reset}>
              Choose another file
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
