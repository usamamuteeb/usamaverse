'use client';

import { useDeferredValue, useState } from 'react';
import { OpenTextFileButton, Button } from '@/components/tool-kit/actions';
import { Status, TextAreaField } from '@/components/tool-kit/fields';
import { detectDelimiter } from '@/lib/tools/shared/csv';
import { delimiterReport } from './logic';

const NAME: Record<string, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

export default function CsvDelimiterDetector() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const d = useDeferredValue(text);
  const report = d.trim() ? delimiterReport(d) : [];
  const best = d.trim() ? detectDelimiter(d) : null;
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField label="CSV sample" value={text} onChange={setText} rows={10} />
        <div className="actions">
          <OpenTextFileButton label="Open file" accept=".csv,.tsv,.txt" maxBytes={20 * 1024 * 1024} onText={setText} onError={setError} />
          <Button variant="ghost" onClick={() => setText('name;price;note\n"Tea; green";1,50;ok\nCoffee;2,10;"hot, fresh"')}>Load example</Button>
        </div>
        {error && <Status tone="error">{error}</Status>}
      </div>
      <div className="tool-col">
        {best && (
          <p className="big-result" aria-live="polite">
            <span className="big-result-label">Most likely delimiter</span>
            <span className="big-result-value">{NAME[best]}</span>
          </p>
        )}
        {report.length > 0 && (
          <table className="data-table">
            <thead><tr><th scope="col">Delimiter</th><th scope="col">Columns (first row)</th><th scope="col">Rows with that many columns</th></tr></thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  <td>{r.error ? '—' : r.columns}</td>
                  <td>{r.error ? r.error : `${Math.round(r.consistency * 100)}% of ${r.rows}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="field-hint">Quoted values are respected, so commas inside &quot;quotes&quot; don’t count. Semicolons are common where the comma is the decimal separator.</p>
      </div>
    </div>
  );
}
