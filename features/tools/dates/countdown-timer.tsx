'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { CheckboxField, NumberField, Status } from '@/components/tool-kit/fields';
import { formatClock } from './logic';

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.85);
    o.onended = () => void ctx.close();
  } catch {
    /* audio not available */
  }
}

export default function CountdownTimer() {
  const [h, setH] = useState('0');
  const [m, setM] = useState('5');
  const [s, setS] = useState('0');
  const [sound, setSound] = useState(true);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const endRef = useRef(0);
  const title = useRef<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = endRef.current - Date.now();
      if (left <= 0) {
        setRemaining(0);
        setRunning(false);
        setDone(true);
        if (sound) beep();
        return;
      }
      setRemaining(left);
    }, 200);
    return () => clearInterval(id);
  }, [running, sound]);

  useEffect(() => {
    if (title.current === null) title.current = document.title;
    if (done) document.title = '⏰ Time’s up';
    else if (running && remaining !== null) document.title = `${formatClock(remaining + 999, false)} — Timer`;
    else document.title = title.current;
  }, [running, remaining, done]);

  useEffect(() => () => {
    if (title.current !== null) document.title = title.current;
  }, []);

  const total = (Number(h) || 0) * 3600_000 + (Number(m) || 0) * 60_000 + (Number(s) || 0) * 1000;
  const invalid = [h, m, s].some((x) => !/^\d{0,4}$/.test(x.trim())) || total <= 0 || total > 100 * 3600_000;

  const start = () => {
    const base = remaining !== null && remaining > 0 && !done ? remaining : total;
    endRef.current = Date.now() + base;
    setRemaining(base);
    setDone(false);
    setRunning(true);
  };
  const pause = () => {
    setRemaining(Math.max(0, endRef.current - Date.now()));
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    setRemaining(null);
    setDone(false);
  };

  return (
    <div className="stack center">
      {remaining === null ? (
        <div className="form-grid three">
          <NumberField label="Hours" value={h} onChange={setH} />
          <NumberField label="Minutes" value={m} onChange={setM} />
          <NumberField label="Seconds" value={s} onChange={setS} />
        </div>
      ) : (
        <p className="clock mono" role="timer" aria-live="off">
          {formatClock(remaining + (running ? 999 : 0), false)}
        </p>
      )}
      <CheckboxField label="Play a sound when finished" checked={sound} onChange={setSound} />
      <div className="actions centered">
        {running ? (
          <Button variant="primary" onClick={pause}>
            Pause
          </Button>
        ) : (
          <Button variant="primary" onClick={start} disabled={remaining === null && invalid}>
            {remaining !== null && remaining > 0 && !done ? 'Resume' : 'Start'}
          </Button>
        )}
        <Button variant="ghost" onClick={reset} disabled={remaining === null}>
          Reset
        </Button>
      </div>
      {remaining === null && invalid && <Status tone="info">Set a duration between 1 second and 100 hours.</Status>}
      {done && <Status tone="success">Time’s up!</Status>}
      <p className="field-hint">If this tab is in the background, your browser may delay the on-screen update and sound, but the end time is fixed when you press Start.</p>
    </div>
  );
}
