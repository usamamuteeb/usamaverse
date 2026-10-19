'use client';

import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { Button, OpenTextFileButton } from './actions';
import { Status, TextAreaField } from './fields';
import { OptionsForm, defaultValues, type OptionDef, type OptionValues } from './options';

export interface Stat {
  label: string;
  value: string;
}

export function StatsTool({
  inputLabel = 'Text',
  placeholder = 'Paste or type text…',
  example,
  options = [],
  compute,
  renderExtra,
}: {
  inputLabel?: string;
  placeholder?: string;
  example?: string;
  options?: OptionDef[];
  compute: (input: string, values: OptionValues) => Stat[];
  renderExtra?: (input: string, values: OptionValues) => ReactNode;
}) {
  const [input, setInput] = useState('');
  const [values, setValues] = useState<OptionValues>(() => defaultValues(options));
  const [error, setError] = useState<string | null>(null);
  const deferred = useDeferredValue(input);
  const result = useMemo(() => {
    try {
      return { stats: compute(deferred, values), error: null as string | null };
    } catch (e) {
      return { stats: [] as Stat[], error: e instanceof Error ? e.message : String(e) };
    }
  }, [deferred, values, compute]);

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField label={inputLabel} value={input} onChange={setInput} placeholder={placeholder} rows={12} mono={false} />
        <div className="actions">
          {example && (
            <Button variant="ghost" onClick={() => setInput(example)}>
              Load example
            </Button>
          )}
          <OpenTextFileButton onText={(t) => setInput(t)} onError={setError} />
          <Button
            variant="ghost"
            onClick={() => {
              setInput('');
              setValues(defaultValues(options));
              setError(null);
            }}
          >
            Reset
          </Button>
        </div>
        <OptionsForm defs={options} values={values} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />
      </div>
      <div className="tool-col">
        {(error || result.error) && <Status tone="error">{error || result.error}</Status>}
        <dl className="stat-grid" aria-live="polite">
          {result.stats.map((s) => (
            <div className="stat" key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
        {renderExtra?.(deferred, values)}
      </div>
    </div>
  );
}
