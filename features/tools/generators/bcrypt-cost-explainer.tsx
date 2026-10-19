'use client';

import { useState } from 'react';
import { NumberField, Status, TextField } from '@/components/tool-kit/fields';
import { ResultRows } from '@/components/tool-kit/output';
import { costTable, parseBcrypt } from './security';

export default function BcryptCostExplainer() {
  const [hash, setHash] = useState('$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW');
  const [baseCost, setBaseCost] = useState('10');
  const [baseMs, setBaseMs] = useState('80');
  let parsed: ReturnType<typeof parseBcrypt> | null = null;
  let error: string | null = null;
  if (hash.trim()) {
    try {
      parsed = parseBcrypt(hash);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const bc = Math.min(31, Math.max(4, Number(baseCost) || 10));
  const bm = Math.max(0.1, Number(baseMs) || 80);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextField label="bcrypt hash to inspect (optional)" value={hash} onChange={setHash} />
        {error && <Status tone="error">{error}</Status>}
        {parsed && (
          <ResultRows rows={[{ label: 'Version', value: `$${parsed.version}$` }, { label: 'Cost factor', value: `${parsed.cost} → 2^${parsed.cost} = ${parsed.rounds.toLocaleString()} rounds`, emphasis: true }, { label: 'Salt (22 chars)', value: parsed.salt }, { label: 'Hash (31 chars)', value: parsed.hash }]} />
        )}
        <Status tone="info">This page only explains bcrypt; it does not hash or check passwords. bcrypt uses at most the first 72 bytes of a password.</Status>
      </div>
      <div className="tool-col">
        <div className="form-grid">
          <NumberField label="Your measured cost" value={baseCost} onChange={setBaseCost} />
          <NumberField label="took (ms) on your server" value={baseMs} onChange={setBaseMs} />
        </div>
        <table className="data-table compact">
          <caption>Each +1 doubles the work (estimate from your measurement)</caption>
          <thead><tr><th scope="col">Cost</th><th scope="col">Rounds</th><th scope="col">≈ time per hash</th></tr></thead>
          <tbody>
            {costTable(bc, bm).map((r) => (
              <tr key={r.cost} className={parsed?.cost === r.cost ? 'is-selected' : undefined}>
                <td>{r.cost}</td>
                <td className="mono">{r.rounds.toLocaleString()}</td>
                <td className="mono">{r.estimateMs < 1000 ? `${r.estimateMs.toFixed(r.estimateMs < 10 ? 1 : 0)} ms` : `${(r.estimateMs / 1000).toFixed(1)} s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="field-hint">A common target is the highest cost that keeps a login around 100–300 ms on your production hardware. Measure it there; timings vary by machine.</p>
      </div>
    </div>
  );
}
