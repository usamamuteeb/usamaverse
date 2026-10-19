'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { ZoneSelect } from './ZoneSelect';
import { formatOffset, localZone, offsetMinutes } from './zones';

export default function WorldClock() {
  const [now, setNow] = useState<number | null>(null);
  const [zones, setZones] = useState<string[]>(['UTC', 'Europe/London', 'America/New_York', 'Asia/Dubai', 'Asia/Tokyo']);
  const [add, setAdd] = useState('Australia/Sydney');
  useEffect(() => {
    const z = localZone();
    setZones((list) => (list.includes(z) ? list : [z, ...list]));
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const here = typeof window === 'undefined' ? 'UTC' : localZone();
  return (
    <div className="stack">
      <div className="color-pair">
        <ZoneSelect label="Add a city / time zone" value={add} onChange={setAdd} />
        <Button onClick={() => setZones((z) => (z.includes(add) ? z : [...z, add]))}>Add</Button>
      </div>
      <ul className="clock-grid" aria-label="Clocks">
        {zones.map((z) => (
          <li key={z} className="clock-card">
            <div className="output-head">
              <strong>{z.split('/').pop()!.replace(/_/g, ' ')}</strong>
              <Button variant="ghost" onClick={() => setZones((list) => list.filter((x) => x !== z))} ariaLabel={`Remove ${z}`}>✕</Button>
            </div>
            {now !== null && (
              <>
                <div className="time" role="timer" aria-live="off">
                  {new Intl.DateTimeFormat(undefined, { timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now)}
                </div>
                <div className="muted">{new Intl.DateTimeFormat(undefined, { timeZone: z, weekday: 'long', day: 'numeric', month: 'short' }).format(now)}</div>
                <div className="muted mono">
                  {formatOffset(offsetMinutes(now, z))}
                  {z === here ? ' · your zone' : ''}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="field-hint">Times come from your device clock and your browser’s time-zone rules. The list isn’t saved.</p>
    </div>
  );
}
