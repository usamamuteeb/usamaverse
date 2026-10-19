'use client';

import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { Button, OpenTextFileButton } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextAreaField } from '@/components/tool-kit/fields';
import { OutputPanel } from '@/components/tool-kit/output';
import { columnLabels, readTable, type Table } from './logic';

export const DELIMS = [
  { value: 'auto', label: 'Detect automatically' },
  { value: ',', label: 'Comma' },
  { value: ';', label: 'Semicolon' },
  { value: 'tab', label: 'Tab' },
  { value: '|', label: 'Pipe' },
];

export interface CsvOpResult {
  output: string;
  summary?: string;
  extra?: ReactNode;
}

/**
 * Shared shell for CSV table tools: input (paste or open file), delimiter and header
 * options, tool-specific controls (which receive the parsed table) and a CSV result.
 */
export function CsvOpTool({ example, controls, run, filename = 'result.csv' }: { example: string; controls: (t: Table, labels: string[]) => ReactNode; run: (t: Table) => CsvOpResult | null; filename?: string }) {
  const [text, setText] = useState('');
  const [delim, setDelim] = useState('auto');
  const [header, setHeader] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const d = useDeferredValue(text);
  const parsed = useMemo(() => {
    if (!d.trim()) return null;
    try {
      return { t: readTable(d, delim, header), e: null as string | null };
    } catch (e) {
      return { t: null, e: e instanceof Error ? e.message : String(e) };
    }
  }, [d, delim, header]);
  let result: CsvOpResult | null = null;
  let runError: string | null = null;
  if (parsed?.t) {
    try {
      result = run(parsed.t);
    } catch (e) {
      runError = e instanceof Error ? e.message : String(e);
    }
  }
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField label="CSV" value={text} onChange={setText} rows={8} />
        <div className="actions">
          <OpenTextFileButton label="Open CSV file" accept=".csv,.tsv,.txt,text/csv" maxBytes={20 * 1024 * 1024} onText={(t) => setText(t)} onError={setError} />
          <Button variant="ghost" onClick={() => setText(example)}>Load example</Button>
          <Button variant="ghost" onClick={() => setText('')}>Reset</Button>
        </div>
        <div className="form-grid">
          <SelectField label="Delimiter" value={delim} onChange={setDelim} options={DELIMS} />
          <CheckboxField label="First row is a header" checked={header} onChange={setHeader} />
        </div>
        {parsed?.t && controls(parsed.t, columnLabels(parsed.t))}
      </div>
      <div className="tool-col">
        {(error || parsed?.e || runError) && <Status tone="error">{error || parsed?.e || runError}</Status>}
        {result?.summary && <p className="summary" aria-live="polite">{result.summary}</p>}
        {result?.extra}
        <OutputPanel label="Result CSV" value={result?.output ?? ''} filename={filename} mime="text/csv" />
      </div>
    </div>
  );
}
