'use client';

import { useEffect, useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { ResultRows } from '@/components/tool-kit/output';
import { fromTimestamp } from './logic';

function localInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function UnixTimestamp() {
  const [now, setNow] = useState<number | null>(null);
  const [ts, setTs] = useState('');
  const [unit, setUnit] = useState<'auto' | 's' | 'ms'>('auto');
  const [local, setLocal] = useState('');

  useEffect(() => {
    const start = Date.now();
    setNow(start);
    setTs(String(Math.floor(start / 1000)));
    setLocal(localInputValue(new Date(start)));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  let tsRows: Array<{ label: string; value: string; emphasis?: boolean }> | null = null;
  let tsError: string | null = null;
  if (ts.trim()) {
    try {
      const { ms, unitUsed } = fromTimestamp(ts, unit);
      const d = new Date(ms);
      tsRows = [
        { label: 'Read as', value: unitUsed === 's' ? 'seconds' : 'milliseconds' },
        { label: 'UTC (ISO 8601)', value: d.toISOString(), emphasis: true },
        { label: 'Your local time', value: d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }) },
        { label: 'Relative', value: relative(ms - Date.now()) },
      ];
    } catch (e) {
      tsError = e instanceof Error ? e.message : String(e);
    }
  }

  let back: { s: string; ms: string; iso: string } | null = null;
  let backError: string | null = null;
  if (local) {
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) backError = 'Enter a valid date and time.';
    else back = { s: String(Math.floor(d.getTime() / 1000)), ms: String(d.getTime()), iso: d.toISOString() };
  }

  return (
    <div className="stack">
      <p className="summary mono" aria-live="off">
        Current Unix time: {now === null ? '…' : Math.floor(now / 1000)}
      </p>
      <div className="tool-grid">
        <section className="tool-col" aria-labelledby="ts-to-date">
          <h2 id="ts-to-date" className="h3">Timestamp → date</h2>
          <TextField label="Unix timestamp" value={ts} onChange={setTs} inputMode="numeric" placeholder="1700000000" />
          <SelectField label="Unit" value={unit} onChange={(v) => setUnit(v as 'auto')} options={[{ value: 'auto', label: 'Detect (≥ 1e11 = milliseconds)' }, { value: 's', label: 'Seconds' }, { value: 'ms', label: 'Milliseconds' }]} />
          {tsError && <Status tone="error">{tsError}</Status>}
          {tsRows && <ResultRows rows={tsRows} />}
        </section>
        <section className="tool-col" aria-labelledby="date-to-ts">
          <h2 id="date-to-ts" className="h3">Date → timestamp</h2>
          <TextField type="datetime-local" step="1" label="Date and time (your time zone)" value={local} onChange={setLocal} />
          <div className="actions">
            <Button variant="ghost" onClick={() => setLocal(localInputValue(new Date()))}>
              Use now
            </Button>
          </div>
          {backError && <Status tone="error">{backError}</Status>}
          {back && (
            <>
              <ResultRows rows={[{ label: 'Seconds', value: back.s, emphasis: true }, { label: 'Milliseconds', value: back.ms }, { label: 'UTC (ISO 8601)', value: back.iso }]} />
              <div className="actions">
                <CopyButton text={back.s} label="Copy seconds" />
                <CopyButton text={back.ms} label="Copy milliseconds" />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function relative(diffMs: number): string {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const abs = Math.abs(diffMs);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [['year', 31_556_952_000], ['month', 2_629_746_000], ['day', 86_400_000], ['hour', 3_600_000], ['minute', 60_000], ['second', 1000]];
  for (const [u, ms] of units) if (abs >= ms || u === 'second') return rtf.format(Math.round(diffMs / ms), u);
  return '';
}
