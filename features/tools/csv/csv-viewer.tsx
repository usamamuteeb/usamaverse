'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Button, OpenTextFileButton } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextAreaField } from '@/components/tool-kit/fields';
import { parseCsv, resolveDelimiter } from '@/lib/tools/shared/csv';

const SHOW = 500;

export default function CsvViewer() {
  const [text, setText] = useState('');
  const [delim, setDelim] = useState('auto');
  const [header, setHeader] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferred = useDeferredValue(text);

  const parsed = useMemo(() => {
    if (!deferred) return null;
    try {
      const d = resolveDelimiter(delim, deferred);
      const rows = parseCsv(deferred, d);
      const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
      const ragged = rows.filter((r) => r.length !== cols).length;
      return { rows, cols, d, ragged, error: null as string | null };
    } catch (e) {
      return { rows: [], cols: 0, d: ',', ragged: 0, error: e instanceof Error ? e.message : String(e) };
    }
  }, [deferred, delim]);

  const head = parsed && header && parsed.rows.length ? parsed.rows[0] : null;
  const body = parsed ? (header ? parsed.rows.slice(1) : parsed.rows) : [];
  const dName = (d: string) => ({ ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' })[d] ?? d;

  return (
    <div className="stack">
      <div className="tool-grid">
        <div className="tool-col">
          <TextAreaField label="CSV" value={text} onChange={setText} rows={8} placeholder={'name,city\n"Khan, Ali",Lahore'} />
          <div className="actions">
            <OpenTextFileButton label="Open CSV file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" maxBytes={20 * 1024 * 1024} onText={(t) => setText(t)} onError={setError} />
            <Button variant="ghost" onClick={() => setText('id,name,note\n1,"Khan, Ali","Said ""hello"""\n2,Sara,"Two\nlines"\n3,Omar,')}>
              Load example
            </Button>
            <Button variant="ghost" onClick={() => setText('')}>
              Reset
            </Button>
          </div>
        </div>
        <div className="tool-col">
          <SelectField label="Delimiter" value={delim} onChange={setDelim} options={[{ value: 'auto', label: 'Detect automatically' }, { value: ',', label: 'Comma' }, { value: ';', label: 'Semicolon' }, { value: 'tab', label: 'Tab' }, { value: '|', label: 'Pipe' }]} />
          <CheckboxField label="First row is a header" checked={header} onChange={setHeader} />
          {parsed && !parsed.error && (
            <p className="summary">
              {body.length.toLocaleString()} data row{body.length === 1 ? '' : 's'} × {parsed.cols} column{parsed.cols === 1 ? '' : 's'} · delimiter: {dName(parsed.d)}
            </p>
          )}
          {parsed && parsed.ragged > 0 && <Status tone="warn">{parsed.ragged} row(s) have a different number of columns.</Status>}
        </div>
      </div>
      {(error || parsed?.error) && <Status tone="error">{error || parsed?.error}</Status>}
      {parsed && !parsed.error && parsed.rows.length > 0 && (
        <div className="table-scroll" tabIndex={0} aria-label="CSV table (scrollable)">
          <table className="data-table">
            {head && (
              <thead>
                <tr>
                  <th scope="col" className="muted">#</th>
                  {Array.from({ length: parsed.cols }, (_, i) => (
                    <th scope="col" key={i}>
                      {head[i] ?? ''}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.slice(0, SHOW).map((r, i) => (
                <tr key={i}>
                  <td className="muted">{i + 1}</td>
                  {Array.from({ length: parsed.cols }, (_, k) => (
                    <td key={k} className="cell">
                      {r[k] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {body.length > SHOW && <p className="field-hint">Showing the first {SHOW} of {body.length.toLocaleString()} rows.</p>}
        </div>
      )}
    </div>
  );
}
