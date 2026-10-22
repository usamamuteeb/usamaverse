'use client';

import { useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { FileDrop, OrderedFileList, nextId } from '@/components/tool-kit/files';
import { downloadBlob } from '@/lib/tools/shared/download';
import { concat, duration, formatTime, normalize, type Pcm, type WavDepth } from './audio';
import { decodeAudioFile, resample } from './browser';
import { DEPTH_CHOICES, useWavResult } from './useAudio';
import { Waveform } from './Waveform';

interface Item {
  id: number;
  name: string;
  size: number;
  note?: string;
  file: File;
}

export default function MediaJoin() {
  const [items, setItems] = useState<Item[]>([]);
  const [gap, setGap] = useState('0');
  const [xfade, setXfade] = useState('0');
  const [rate, setRate] = useState('auto');
  const [norm, setNorm] = useState(false);
  const [depth, setDepth] = useState('16');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Pcm | null>(null);
  const { blob, url } = useWavResult(result, Number(depth) as WavDepth);

  const join = async () => {
    setError(null);
    setResult(null);
    try {
      const clips: Pcm[] = [];
      for (const [i, it] of items.entries()) {
        setBusy(`Decoding ${i + 1} of ${items.length}: ${it.name}`);
        clips.push(await decodeAudioFile(it.file));
      }
      const target = rate === 'auto' ? Math.max(...clips.map((c) => c.sampleRate)) : Number(rate);
      setBusy('Matching sample rates…');
      const same: Pcm[] = [];
      for (const c of clips) same.push(await resample(c, target));
      setBusy('Joining…');
      let out = concat(same, { gapSec: Math.max(0, Number(gap) || 0), crossfadeSec: Math.max(0, Number(xfade) || 0) });
      if (norm) out = normalize(out, -1).pcm;
      setResult(out);
      setItems((list) => list.map((it, i) => ({ ...it, note: formatTime(duration(clips[i])) })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack">
      <FileDrop
        accept="audio/*,video/*,.mp3,.wav,.flac,.ogg,.opus,.m4a,.aac,.aiff,.webm,.mp4"
        multiple
        onFiles={(files) => {
          setItems((list) => [...list, ...files.map((file) => ({ id: nextId(), name: file.name, size: file.size, file }))]);
          setResult(null);
        }}
        label="Add audio files"
      >
        <p>Add two or more audio files (or videos, to join their sound). They are joined in the order below, on your device.</p>
      </FileDrop>
      <OrderedFileList items={items} onChange={(l) => (setItems(l), setResult(null))} label="Clips in order" />
      {items.length > 0 && (
        <>
          <div className="form-grid">
            <TextField label="Silence between clips (s)" value={gap} onChange={setGap} inputMode="decimal" hint="Ignored when crossfading." />
            <TextField label="Crossfade (s)" value={xfade} onChange={setXfade} inputMode="decimal" hint="Blend each clip into the next." />
            <SelectField label="Sample rate" value={rate} onChange={setRate} options={[{ value: 'auto', label: 'Highest of the clips' }, { value: '44100', label: '44,100 Hz' }, { value: '48000', label: '48,000 Hz' }]} />
            <SelectField label="WAV format" value={depth} onChange={setDepth} options={DEPTH_CHOICES} />
          </div>
          <CheckboxField label="Normalize the result to −1 dBFS" checked={norm} onChange={setNorm} />
          <div className="actions">
            <Button variant="primary" onClick={join} disabled={!!busy || items.length < 2}>
              Join {items.length} clips
            </Button>
            <Button variant="ghost" onClick={() => (setItems([]), setResult(null), setError(null))}>
              Clear
            </Button>
          </div>
          {items.length < 2 && <Status tone="info">Add at least two files.</Status>}
        </>
      )}
      {busy && <Status tone="info">{busy}</Status>}
      {error && <Status tone="error">{error}</Status>}
      {result && blob && url && (
        <>
          <Waveform pcm={result} label="Waveform of the joined audio" />
          <audio className="media-player" controls src={url} />
          <div className="actions">
            <Button variant="primary" onClick={() => downloadBlob(blob, 'joined.wav')}>
              Download WAV ({formatTime(duration(result))})
            </Button>
          </div>
        </>
      )}
      <p className="field-hint">Clips with different channel counts are matched (mono is copied to both sides). The result is a WAV file; all decoding happens in memory, so very long files need plenty of RAM.</p>
    </div>
  );
}
