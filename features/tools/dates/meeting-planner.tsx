'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { NumberField, TextField } from '@/components/tool-kit/fields';
import { todayLocal } from './logic';
import { ZoneSelect } from './ZoneSelect';
import { formatOffset, localZone, offsetMinutes, wallTime, zonedToUtc } from './zones';

export default function MeetingPlanner() {
  const [date, setDate] = useState('');
  const [base, setBase] = useState('UTC');
  const [zones, setZones] = useState<string[]>(['Europe/London', 'America/New_York']);
  const [add, setAdd] = useState('Asia/Tokyo');
  const [startH, setStartH] = useState('9');
  const [endH, setEndH] = useState('17');
  useEffect(() => {
    setDate(todayLocal());
    setBase(localZone());
  }, []);
  const all = [base, ...zones.filter((z) => z !== base)];
  const ws = Math.min(23, Math.max(0, Number(startH) || 0));
  const we = Math.min(24, Math.max(ws + 1, Number(endH) || 17));
  let hours: number[] = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    hours = Array.from({ length: 24 }, (_, h) => zonedToUtc({ y, m, d, hh: h, mm: 0, ss: 0 }, base).instant);
  }
  const good = hours.map((t) => all.every((z) => {
    const w = wallTime(t, z);
    return w.hh >= ws && w.hh < we;
  }));
  return (
    <div className="stack">
      <div className="form-grid">
        <TextField type="date" label="Date" value={date} onChange={setDate} />
        <ZoneSelect label="Your time zone" value={base} onChange={setBase} />
        <NumberField label="Working day starts (hour)" value={startH} onChange={setStartH} />
        <NumberField label="Working day ends (hour)" value={endH} onChange={setEndH} />
      </div>
      <div className="color-pair">
        <ZoneSelect label="Add a participant’s time zone" value={add} onChange={setAdd} />
        <Button onClick={() => setZones((z) => (z.includes(add) ? z : [...z, add]))}>Add</Button>
      </div>
      {hours.length > 0 && (
        <>
          <p className="summary">
            {good.some(Boolean) ? `Hours that fall within ${ws}:00–${we}:00 for everyone are marked ✓.` : `No hour falls within ${ws}:00–${we}:00 for everyone. Consider widening the working day.`}
          </p>
          <div className="table-scroll" tabIndex={0} aria-label="Hour comparison table (scrollable)">
            <table className="hour-grid">
              <tbody>
                <tr>
                  <th scope="row">Works for all</th>
                  {good.map((g, i) => (
                    <td key={i} className={g ? 'work' : ''}>{g ? '✓' : ''}</td>
                  ))}
                </tr>
                {all.map((z) => (
                  <tr key={z}>
                    <th scope="row">
                      {z.split('/').pop()!.replace(/_/g, ' ')} <span className="muted">{formatOffset(offsetMinutes(hours[12], z))}</span>
                      {z !== base && <Button variant="ghost" onClick={() => setZones((list) => list.filter((x) => x !== z))} ariaLabel={`Remove ${z}`}>✕</Button>}
                    </th>
                    {hours.map((t, i) => {
                      const w = wallTime(t, z);
                      const work = w.hh >= ws && w.hh < we;
                      return (
                        <td key={i} className={work ? 'work' : w.hh < 7 || w.hh >= 22 ? 'night' : ''}>
                          {String(w.hh).padStart(2, '0')}:{String(w.mm).padStart(2, '0')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="field-hint">Each column is one hour of your selected date in your time zone. Green cells are inside the working day.</p>
        </>
      )}
    </div>
  );
}
