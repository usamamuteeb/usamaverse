'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Button } from './actions';
import { CheckboxField, NumberField, SelectField, Status, TextAreaField, TextField, type Choice } from './fields';
import { OutputPanel, ResultRows } from './output';

export type FieldDef =
  | { type: 'number'; key: string; label: string; default: string; suffix?: string; hint?: string; placeholder?: string; showIf?: (v: FormValues) => boolean }
  | { type: 'text' | 'url'; key: string; label: string; default: string; hint?: string; placeholder?: string; showIf?: (v: FormValues) => boolean }
  | { type: 'date' | 'datetime-local'; key: string; label: string; default: string | (() => string); hint?: string; showIf?: (v: FormValues) => boolean }
  | { type: 'select'; key: string; label: string; default: string; choices: Choice[]; hint?: string; showIf?: (v: FormValues) => boolean }
  | { type: 'checkbox'; key: string; label: string; default: boolean; hint?: string; showIf?: (v: FormValues) => boolean }
  | { type: 'textarea'; key: string; label: string; default: string; hint?: string; placeholder?: string; showIf?: (v: FormValues) => boolean };

export type FormValues = Record<string, string | boolean>;

export interface FormResult {
  rows?: Array<{ label: string; value: string; emphasis?: boolean }>;
  /** Text output with copy (e.g. a generated URL). */
  output?: string;
  outputLabel?: string;
  note?: string;
  extra?: ReactNode;
}

function initial(fields: FieldDef[]): FormValues {
  return Object.fromEntries(fields.map((f) => [f.key, typeof f.default === 'function' ? f.default() : f.default]));
}

export function FormTool({ fields, compute, intro }: { fields: FieldDef[]; compute: (v: FormValues) => FormResult | null; intro?: ReactNode }) {
  const [values, setValues] = useState<FormValues>(() => initial(fields));
  const set = (k: string, v: string | boolean) => setValues((p) => ({ ...p, [k]: v }));
  const outcome = useMemo(() => {
    try {
      return { result: compute(values), error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [values, compute]);

  return (
    <div className="tool-grid">
      <div className="tool-col">
        {intro}
        <form className="form-grid" onSubmit={(e) => e.preventDefault()} noValidate>
          {fields
            .filter((f) => !f.showIf || f.showIf(values))
            .map((f) => {
              const v = values[f.key];
              switch (f.type) {
                case 'number':
                  return <NumberField key={f.key} label={f.label} hint={f.hint} suffix={f.suffix} placeholder={f.placeholder} value={String(v)} onChange={(x) => set(f.key, x)} />;
                case 'text':
                case 'url':
                  return <TextField key={f.key} type={f.type === 'url' ? 'url' : 'text'} inputMode={f.type === 'url' ? 'url' : undefined} label={f.label} hint={f.hint} placeholder={f.placeholder} value={String(v)} onChange={(x) => set(f.key, x)} />;
                case 'date':
                case 'datetime-local':
                  return <TextField key={f.key} type={f.type} label={f.label} hint={f.hint} value={String(v)} onChange={(x) => set(f.key, x)} />;
                case 'select':
                  return <SelectField key={f.key} label={f.label} hint={f.hint} options={f.choices} value={String(v)} onChange={(x) => set(f.key, x)} />;
                case 'checkbox':
                  return <CheckboxField key={f.key} label={f.label} hint={f.hint} checked={Boolean(v)} onChange={(x) => set(f.key, x)} />;
                case 'textarea':
                  return <TextAreaField key={f.key} label={f.label} hint={f.hint} placeholder={f.placeholder} rows={6} value={String(v)} onChange={(x) => set(f.key, x)} />;
              }
            })}
        </form>
        <div className="actions">
          <Button variant="ghost" onClick={() => setValues(initial(fields))}>
            Reset
          </Button>
        </div>
      </div>
      <div className="tool-col" aria-live="polite">
        {outcome.error && <Status tone="error">{outcome.error}</Status>}
        {!outcome.error && !outcome.result && <p className="empty-state">Fill in the fields to see the result.</p>}
        {outcome.result?.rows && <ResultRows rows={outcome.result.rows} />}
        {outcome.result?.output !== undefined && <OutputPanel label={outcome.result.outputLabel ?? 'Result'} value={outcome.result.output} rows={4} />}
        {outcome.result?.note && <Status tone="info">{outcome.result.note}</Status>}
        {outcome.result?.extra}
      </div>
    </div>
  );
}
