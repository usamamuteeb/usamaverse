'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button } from './actions';
import { Status } from './fields';
import { OptionsForm, defaultValues, type OptionDef, type OptionValues } from './options';
import { OutputPanel } from './output';

export function GeneratorTool({
  options,
  generate,
  outputLabel = 'Generated',
  filename,
  buttonLabel = 'Generate',
  note,
  describe,
}: {
  options: OptionDef[];
  generate: (v: OptionValues) => string;
  outputLabel?: string;
  filename?: string;
  buttonLabel?: string;
  note?: ReactNode;
  /** Extra info about the current output, e.g. entropy. */
  describe?: (v: OptionValues, output: string) => ReactNode;
}) {
  const [values, setValues] = useState<OptionValues>(() => defaultValues(options));
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (v: OptionValues) => {
      try {
        setOutput(generate(v));
        setError(null);
      } catch (e) {
        setOutput('');
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [generate],
  );

  // Generate once when the tool opens (client-only, so no hydration mismatch).
  useEffect(() => {
    run(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <OptionsForm
          defs={options}
          values={values}
          onChange={(k, v) => {
            const next = { ...values, [k]: v };
            setValues(next);
            run(next);
          }}
        />
        <div className="actions">
          <Button variant="primary" onClick={() => run(values)}>
            {buttonLabel}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const d = defaultValues(options);
              setValues(d);
              run(d);
            }}
          >
            Reset
          </Button>
        </div>
        {note}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        <OutputPanel label={outputLabel} value={output} filename={filename} rows={8} />
        {output && describe?.(values, output)}
      </div>
    </div>
  );
}
