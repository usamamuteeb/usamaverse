'use client';

import { useMemo, useState } from 'react';
import { formatNumber } from '@/lib/format';
import { convert, fromBase, toBase, type Quantity } from '@/features/tools/units/logic';
import { Button } from './actions';
import { NumberField, SelectField, Status } from './fields';
import { CopyButton } from './actions';

export function UnitConverter({ quantity, note }: { quantity: Quantity; note?: string }) {
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState(quantity.defaultFrom);
  const [to, setTo] = useState(quantity.defaultTo);
  const options = quantity.units.map((u) => ({ value: u.id, label: `${u.label} (${u.symbol})` }));
  const unit = (id: string) => quantity.units.find((u) => u.id === id)!;

  const outcome = useMemo(() => {
    const t = value.trim().replace(/,/g, '');
    if (t === '') return { error: null, result: null, all: [] as Array<{ id: string; text: string }> };
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return { error: 'Enter a number, for example 12.5 or 1e6.', result: null, all: [] };
    const n = Number(t);
    try {
      const result = convert(quantity, n, from, to);
      const base = toBase(quantity, from, n);
      const all = quantity.units.map((u) => ({ id: u.id, text: `${formatNumber(fromBase(quantity, u.id, base))} ${u.symbol}` }));
      return { error: null, result, all };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e), result: null, all: [] };
    }
  }, [value, from, to, quantity]);

  const resultText = outcome.result === null ? '' : formatNumber(outcome.result);

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div className="form-grid">
          <NumberField label="Value" value={value} onChange={setValue} />
          <SelectField label="From" value={from} onChange={setFrom} options={options} />
          <SelectField label="To" value={to} onChange={setTo} options={options} />
        </div>
        <div className="actions">
          <Button
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
          >
            ⇄ Swap units
          </Button>
          <Button variant="ghost" onClick={() => { setValue('1'); setFrom(quantity.defaultFrom); setTo(quantity.defaultTo); }}>
            Reset
          </Button>
        </div>
        {note && <p className="field-hint">{note}</p>}
      </div>
      <div className="tool-col">
        {outcome.error && <Status tone="error">{outcome.error}</Status>}
        {outcome.result !== null && (
          <>
            <div className="big-result" aria-live="polite">
              <span className="big-result-label">
                {value} {unit(from).symbol} =
              </span>
              <span className="big-result-value">
                {resultText} {unit(to).symbol}
              </span>
            </div>
            <div className="actions">
              <CopyButton text={resultText} label="Copy number" />
            </div>
            <table className="data-table compact">
              <caption>All units</caption>
              <tbody>
                {outcome.all.map((r) => (
                  <tr key={r.id} className={r.id === to ? 'is-selected' : undefined}>
                    <th scope="row">{unit(r.id).label}</th>
                    <td className="mono">{r.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
