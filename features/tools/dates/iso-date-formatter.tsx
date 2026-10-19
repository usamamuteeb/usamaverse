'use client';

import { useEffect, useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { Status, TextField } from '@/components/tool-kit/fields';
import { ZoneSelect } from './ZoneSelect';
import { dayOfYear, formatOffset, isoWeek, localZone, offsetMinutes, wallTime } from './zones';

function parseInput(s: string): number {
  const t = s.trim();
  if (!t) throw new Error('Enter a date.');
  if (/^-?\d{9,13}$/.test(t)) return Math.abs(Number(t)) >= 1e11 ? Number(t) : Number(t) * 1000;
  // Date-only ISO strings are treated as UTC midnight by JS; make that explicit.
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) throw new Error('Could not read that date. Try 2026-10-19T14:30:00+05:00, an RFC 2822 date or a Unix timestamp.');
  return ms;
}

export default function IsoDateFormatter() {
  const [input, setInput] = useState('');
  const [zone, setZone] = useState('UTC');
  useEffect(() => {
    setZone(localZone());
    setInput(new Date().toISOString());
  }, []);
  let rows: Array<[string, string]> = [];
  let error: string | null = null;
  try {
    if (input.trim()) {
      const t = parseInput(input);
      const w = wallTime(t, zone);
      const off = offsetMinutes(t, zone);
      const p = (n: number, l = 2) => String(n).padStart(l, '0');
      const offIso = off === 0 ? 'Z' : formatOffset(off).replace('UTC', '');
      const wk = isoWeek(w);
      const local = `${p(w.y, 4)}-${p(w.m)}-${p(w.d)}T${p(w.hh)}:${p(w.mm)}:${p(w.ss)}`;
      rows = [
        ['ISO 8601 (UTC)', new Date(t).toISOString()],
        ['ISO 8601 with offset', `${local}${offIso}`],
        ['Date only', `${p(w.y, 4)}-${p(w.m)}-${p(w.d)}`],
        ['Basic format', `${p(w.y, 4)}${p(w.m)}${p(w.d)}T${p(w.hh)}${p(w.mm)}${p(w.ss)}${offIso.replace(':', '')}`],
        ['ISO week date', `${wk.year}-W${p(wk.week)}-${wk.weekday}`],
        ['Ordinal date', `${p(w.y, 4)}-${p(dayOfYear(w), 3)}`],
        ['RFC 9110 / HTTP date', new Date(t).toUTCString()],
        ['Unix seconds', String(Math.floor(t / 1000))],
        ['Unix milliseconds', String(t)],
      ];
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextField label="Date, date-time or timestamp" value={input} onChange={setInput} placeholder="2026-10-19T14:30:00+05:00" hint="A date without a time zone, like 2026-10-19, is read as UTC midnight (JavaScript rules); a date-time without an offset is read in your local time." />
        <ZoneSelect label="Show in time zone" value={zone} onChange={setZone} />
        <div className="actions">
          <Button variant="ghost" onClick={() => setInput(new Date().toISOString())}>Now</Button>
        </div>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {rows.length > 0 && (
          <dl className="result-rows">
            {rows.map(([k, v]) => (
              <div key={k} className="result-row">
                <dt>{k}</dt>
                <dd className="mono with-action">{v} <CopyButton text={v} /></dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
