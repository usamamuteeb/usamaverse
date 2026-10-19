'use client';

import { useRef, useState } from 'react';
import { TransformTool } from '@/components/tool-kit/TransformTool';
import { Button } from '@/components/tool-kit/actions';
import { RangeField, TextField, Status } from '@/components/tool-kit/fields';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { fromMorse, morseTimeline, toMorse } from './logic';

const options: OptionDef[] = [{ type: 'select', key: 'dir', label: 'Mode', default: 'encode', choices: [{ value: 'encode', label: 'Text → Morse' }, { value: 'decode', label: 'Morse → text' }] }];

function Player() {
  const [code, setCode] = useState('... --- ...');
  const [wpm, setWpm] = useState(18);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const play = () => {
    setError(null);
    if (!/^[.\-\s/]+$/.test(code.trim())) return setError('Use dots, dashes, spaces and “/”.');
    try {
      const ctx = ctxRef.current ?? new AudioContext();
      ctxRef.current = ctx;
      const unit = 1.2 / wpm;
      let t = ctx.currentTime + 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 650;
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      for (const s of morseTimeline(code)) {
        if (s.on) {
          gain.gain.setValueAtTime(0.25, t);
          gain.gain.setValueAtTime(0, t + s.units * unit);
        }
        t += s.units * unit;
      }
      osc.start();
      osc.stop(t + 0.05);
      setPlaying(true);
      osc.onended = () => setPlaying(false);
    } catch {
      setError('Audio is not available in this browser.');
    }
  };
  return (
    <section className="card-plain stack" aria-labelledby="player-h">
      <h2 id="player-h" className="h3">Listen</h2>
      <TextField label="Morse to play" value={code} onChange={setCode} />
      <RangeField label="Speed" value={wpm} min={5} max={40} onChange={setWpm} format={(v) => `${v} WPM`} />
      <div className="actions"><Button variant="primary" onClick={play} disabled={playing}>{playing ? 'Playing…' : 'Play'}</Button></div>
      {error && <Status tone="error">{error}</Status>}
    </section>
  );
}

export default function MorseCode() {
  return (
    <div className="stack">
      <TransformTool
        options={options}
        example="SOS. Help is on the way!"
        allowFile={false}
        transform={(t, v) => {
          if (str(v.dir) === 'decode') return { output: fromMorse(t) };
          const r = toMorse(t);
          return { output: r.output, warning: r.skipped.length ? `No Morse code for: ${r.skipped.join(' ')} (skipped).` : undefined };
        }}
      />
      <Player />
    </div>
  );
}
