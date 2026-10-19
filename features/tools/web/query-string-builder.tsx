'use client';

import { useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { CheckboxField, Status, TextField } from '@/components/tool-kit/fields';
import { OutputPanel } from '@/components/tool-kit/output';
import { buildQuery } from './more';

export default function QueryStringBuilder() {
  const [base, setBase] = useState('https://example.com/search');
  const [keep, setKeep] = useState(true);
  const [rows, setRows] = useState([{ key: 'q', value: 'café latte' }, { key: 'tag', value: 'hot' }, { key: 'tag', value: 'new' }]);
  let out = '';
  let error: string | null = null;
  try {
    out = buildQuery(base, rows, keep);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const set = (i: number, k: 'key' | 'value', v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextField label="Base URL (optional)" value={base} onChange={setBase} placeholder="https://example.com/page" />
        <CheckboxField label="Keep parameters already in the base URL" checked={keep} onChange={setKeep} />
        <div className="table-scroll">
          <table className="grid-editor">
            <thead><tr><th scope="col">Key</th><th scope="col">Value</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input className="input" aria-label={`Parameter ${i + 1} key`} value={r.key} onChange={(e) => set(i, 'key', e.target.value)} /></td>
                  <td><input className="input" aria-label={`Parameter ${i + 1} value`} value={r.value} onChange={(e) => set(i, 'value', e.target.value)} /></td>
                  <td><Button variant="ghost" ariaLabel={`Remove parameter ${i + 1}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>✕</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <Button onClick={() => setRows((r) => [...r, { key: '', value: '' }])}>Add parameter</Button>
          <Button variant="ghost" onClick={() => { setRows([{ key: '', value: '' }]); setBase(''); }}>Reset</Button>
        </div>
        <p className="field-hint">Repeated keys are kept (key=a&amp;key=b). Values are percent-encoded; spaces become “+”.</p>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        <OutputPanel label="Result" value={out} rows={4} />
      </div>
    </div>
  );
}
