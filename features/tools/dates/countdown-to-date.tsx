'use client';

import { useEffect, useState } from 'react';
import { Status, TextField } from '@/components/tool-kit/fields';
import { ZoneSelect } from './ZoneSelect';
import { localZone, parseWall, zonedToUtc } from './zones';

export default function CountdownToDate() {
  const [when, setWhen] = useState('');
  const [zone, setZone] = useState('UTC');
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setZone(localZone());
    const y = new Date().getFullYear() + 1;
    setWhen(`${y}-01-01T00:00`);
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  let target: number | null = null;
  let error: string | null = null;
  let warn: string | null = null;
  if (when) {
    try {
      const r = zonedToUtc(parseWall(when), zone);
      target = r.instant;
      if (r.kind === 'nonexistent') warn = 'That local time is skipped by a daylight-saving change; counting to the moment just after it.';
      if (r.kind === 'ambiguous') warn = 'That local time happens twice (clocks go back); counting to the first occurrence.';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const diff = target !== null && now !== null ? target - now : null;
  const parts = diff === null ? null : (() => {
    const a = Math.abs(diff);
    return { d: Math.floor(a / 86_400_000), h: Math.floor((a % 86_400_000) / 3_600_000), m: Math.floor((a % 3_600_000) / 60_000), s: Math.floor((a % 60_000) / 1000) };
  })();
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextField type="datetime-local" label="Target date and time" value={when} onChange={setWhen} />
        <ZoneSelect label="Time zone of the target" value={zone} onChange={setZone} />
        {error && <Status tone="error">{error}</Status>}
        {warn && <Status tone="warn">{warn}</Status>}
      </div>
      <div className="tool-col">
        {parts && diff !== null && (
          <>
            <p className="big-result">
              <span className="big-result-label">{diff >= 0 ? 'Time left' : 'Time since'}</span>
              <span className="big-result-value mono" role="timer" aria-live="off">
                {parts.d}d {String(parts.h).padStart(2, '0')}h {String(parts.m).padStart(2, '0')}m {String(parts.s).padStart(2, '0')}s
              </span>
            </p>
            <p className="field-hint">
              Target in your time: {new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(target!)}. Counts from your device clock.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
