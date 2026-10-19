'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, OpenTextFileButton } from './actions';
import { LiveRegion, Status, TextAreaField } from './fields';
import { OptionsForm, defaultValues, type OptionDef, type OptionValues } from './options';
import { OutputPanel } from './output';

export interface TransformResult {
  output: string;
  /** Short summary such as "3 duplicates removed". */
  summary?: string;
  warning?: string;
}

export interface TransformToolProps {
  inputLabel?: string;
  placeholder?: string;
  example?: string;
  options?: OptionDef[];
  transform: (input: string, values: OptionValues) => TransformResult | Promise<TransformResult>;
  outputLabel?: string;
  filename?: string;
  mime?: string;
  /** Live preview (default) or an explicit Run button for heavier work. */
  live?: boolean;
  runLabel?: string;
  maxChars?: number;
  allowFile?: boolean;
  inputRows?: number;
  /** Treat empty input as "nothing to do" (default) or still call transform. */
  allowEmpty?: boolean;
}

export function TransformTool({
  inputLabel = 'Input',
  placeholder = 'Paste or type here…',
  example,
  options = [],
  transform,
  outputLabel = 'Result',
  filename,
  mime,
  live = true,
  runLabel = 'Run',
  maxChars = 5_000_000,
  allowFile = true,
  inputRows = 10,
  allowEmpty = false,
}: TransformToolProps) {
  const [input, setInput] = useState('');
  const [values, setValues] = useState<OptionValues>(() => defaultValues(options));
  const [result, setResult] = useState<TransformResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const runId = useRef(0);

  const run = async (text: string, vals: OptionValues) => {
    const id = ++runId.current;
    if (!allowEmpty && text === '') {
      setResult(null);
      setError(null);
      return;
    }
    if (text.length > maxChars) {
      setResult(null);
      setError(`Input is ${text.length.toLocaleString()} characters; the limit is ${maxChars.toLocaleString()}.`);
      return;
    }
    setBusy(true);
    try {
      const r = await transform(text, vals);
      if (id !== runId.current) return; // a newer run started; drop this stale result
      setResult(r);
      setError(null);
    } catch (e) {
      if (id !== runId.current) return;
      setResult(null); // never leave stale output next to an error
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === runId.current) setBusy(false);
    }
  };

  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => void run(input, values), input.length > 200_000 ? 250 : 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, values, live]);

  const updateInput = (v: string) => {
    setInput(v);
    if (!live) {
      runId.current++;
      setResult(null); // output would be stale
      setError(null);
    }
  };
  const setOption = (k: string, v: string | boolean) => {
    setValues((p) => ({ ...p, [k]: v }));
    if (!live) {
      runId.current++;
      setResult(null);
    }
  };
  const reset = () => {
    runId.current++;
    setInput('');
    setValues(defaultValues(options));
    setResult(null);
    setError(null);
  };

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField label={inputLabel} value={input} onChange={updateInput} placeholder={placeholder} rows={inputRows} />
        <div className="actions">
          {!live && (
            <Button variant="primary" onClick={() => void run(input, values)} disabled={busy}>
              {busy ? 'Working…' : runLabel}
            </Button>
          )}
          {example && (
            <Button variant="ghost" onClick={() => updateInput(example)}>
              Load example
            </Button>
          )}
          {allowFile && <OpenTextFileButton onText={(t) => updateInput(t)} onError={setError} />}
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        </div>
        <OptionsForm defs={options} values={values} onChange={setOption} />
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {result?.warning && <Status tone="warn">{result.warning}</Status>}
        {result?.summary && <p className="summary">{result.summary}</p>}
        <OutputPanel label={outputLabel} value={result?.output ?? ''} filename={filename} mime={mime} emptyText={!live && input && !result && !error ? `Press “${runLabel}” to see the result.` : 'The result will appear here.'} />
        <LiveRegion>{result?.summary ?? ''}</LiveRegion>
      </div>
    </div>
  );
}
