'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { formatClock } from './logic';

export default function Stopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const startRef = useRef(0); // performance.now() at last start
  const baseRef = useRef(0); // elapsed before last start
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setElapsed(baseRef.current + performance.now() - startRef.current);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  const now = () => (running ? baseRef.current + performance.now() - startRef.current : elapsed);
  const start = () => {
    startRef.current = performance.now();
    setRunning(true);
  };
  const stop = () => {
    baseRef.current = now();
    setElapsed(baseRef.current);
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    baseRef.current = 0;
    setElapsed(0);
    setLaps([]);
  };
  const lap = () => setLaps((l) => [now(), ...l]);

  const lapRows = laps.map((t, i) => ({ n: laps.length - i, total: t, split: t - (laps[i + 1] ?? 0) }));
  const lapText = lapRows.slice().reverse().map((r) => `Lap ${r.n}\t${formatClock(r.split)}\t${formatClock(r.total)}`).join('\n');

  return (
    <div className="stack center">
      <p className="clock mono" role="timer" aria-label={`Elapsed ${formatClock(elapsed, false)}`}>
        {formatClock(elapsed)}
      </p>
      <div className="actions centered">
        {running ? (
          <Button variant="primary" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button variant="primary" onClick={start}>
            {elapsed > 0 ? 'Resume' : 'Start'}
          </Button>
        )}
        <Button onClick={lap} disabled={!running}>
          Lap
        </Button>
        <Button variant="ghost" onClick={reset} disabled={elapsed === 0 && laps.length === 0}>
          Reset
        </Button>
        {laps.length > 0 && <CopyButton text={lapText} label="Copy laps" />}
      </div>
      {laps.length > 0 && (
        <table className="data-table compact laps">
          <caption>Laps</caption>
          <thead>
            <tr>
              <th scope="col">Lap</th>
              <th scope="col">Split</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {lapRows.map((r) => (
              <tr key={r.n}>
                <td>{r.n}</td>
                <td className="mono">{formatClock(r.split)}</td>
                <td className="mono">{formatClock(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="field-hint">Uses a monotonic clock, so changing the system time does not affect it. Laps are not saved.</p>
    </div>
  );
}
