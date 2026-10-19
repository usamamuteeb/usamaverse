'use client';

import { useEffect, useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { Status, TextField } from '@/components/tool-kit/fields';
import { ZoneSelect } from './ZoneSelect';
import { formatOffset, localZone, offsetMinutes, parseWall, wallTime, wallToString, zonedToUtc, zoneAbbrev } from './zones';

function nowLocalInput(zone: string): string {
  const w = wallTime(Date.now(), zone);
  return wallToString(w).replace(' ', 'T');
}

export default function TimezoneConverter() {
  const [from, setFrom] = useState('UTC');
  const [when, setWhen] = useState('');
  const [targets, setTargets] = useState<string[]>(['UTC', 'Europe/London', 'America/New_York', 'Asia/Tokyo']);
  const [add, setAdd] = useState('Asia/Dubai');

  useEffect(() => {
    const z = localZone();
    setFrom(z);
    setWhen(nowLocalInput(z));
    setTargets((t) => (t.includes(z) ? t : [z, ...t]));
  }, []);

  let error: string | null = null;
  let instant: number | null = null;
  let note: string | null = null;
  if (when) {
    try {
      const r = zonedToUtc(parseWall(when), from);
      instant = r.instant;
      if (r.kind === 'nonexistent') note = `${when.replace('T', ' ')} does not exist in ${from} (clocks jump forward for daylight saving). Showing the moment just after the jump.`;
      if (r.kind === 'ambiguous') note = `${when.replace('T', ' ')} happens twice in ${from} (clocks go back). Showing the first occurrence (${formatOffset(offsetMinutes(r.candidates[0], from))}); the second is at ${formatOffset(offsetMinutes(r.candidates[1], from))}.`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const rows =
    instant === null
      ? []
      : targets.map((z) => {
          const w = wallTime(instant!, z);
          const fromDay = wallTime(instant!, from);
          const dayDiff = Math.round((Date.UTC(w.y, w.m - 1, w.d) - Date.UTC(fromDay.y, fromDay.m - 1, fromDay.d)) / 86_400_000);
          return { z, text: wallToString(w), off: formatOffset(offsetMinutes(instant!, z)), abbr: zoneAbbrev(instant!, z), dayDiff };
        });
  const copyText = rows.map((r) => `${r.z}: ${r.text} (${r.off})`).join('\n');

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextField type="datetime-local" label="Date and time" value={when} onChange={setWhen} />
        <ZoneSelect label="In time zone" value={from} onChange={setFrom} />
        <div className="actions">
          <Button variant="ghost" onClick={() => setWhen(nowLocalInput(from))}>Now</Button>
        </div>
        <div className="color-pair">
          <ZoneSelect label="Add a time zone" value={add} onChange={setAdd} />
          <Button onClick={() => setTargets((t) => (t.includes(add) ? t : [...t, add]))}>Add</Button>
        </div>
        <p className="field-hint">Uses your browser’s built-in time-zone database, including daylight-saving rules.</p>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {note && <Status tone="warn">{note}</Status>}
        {instant !== null && (
          <>
            <p className="summary mono">UTC: {new Date(instant).toISOString().replace('.000Z', 'Z')}</p>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Time zone</th>
                    <th scope="col">Local time</th>
                    <th scope="col">Offset</th>
                    <th scope="col"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.z}>
                      <th scope="row">{r.z.replace(/_/g, ' ')}</th>
                      <td className="mono">
                        {r.text}
                        {r.dayDiff !== 0 && <span className="muted"> ({r.dayDiff > 0 ? '+' : '−'}{Math.abs(r.dayDiff)} day)</span>}
                      </td>
                      <td className="mono">{r.off}{r.abbr && !r.abbr.startsWith('GMT') ? ` ${r.abbr}` : ''}</td>
                      <td>
                        <Button variant="ghost" onClick={() => setTargets((t) => t.filter((x) => x !== r.z))} ariaLabel={`Remove ${r.z}`}>✕</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="actions">
              <CopyButton text={copyText} label="Copy all" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
