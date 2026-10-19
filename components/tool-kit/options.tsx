'use client';

import { CheckboxField, NumberField, SelectField, TextField, type Choice } from './fields';

export type OptionDef =
  | { type: 'select'; key: string; label: string; choices: Choice[]; default: string; hint?: string }
  | { type: 'checkbox'; key: string; label: string; default: boolean; hint?: string }
  | { type: 'number'; key: string; label: string; default: string; hint?: string; suffix?: string }
  | { type: 'text'; key: string; label: string; default: string; placeholder?: string; hint?: string };

export type OptionValues = Record<string, string | boolean>;

export function defaultValues(defs: OptionDef[] = []): OptionValues {
  return Object.fromEntries(defs.map((d) => [d.key, d.default]));
}

export function OptionsForm({ defs, values, onChange }: { defs: OptionDef[]; values: OptionValues; onChange: (key: string, v: string | boolean) => void }) {
  if (defs.length === 0) return null;
  return (
    <fieldset className="options">
      <legend className="sr-only">Options</legend>
      {defs.map((d) => {
        const v = values[d.key];
        switch (d.type) {
          case 'select':
            return <SelectField key={d.key} label={d.label} hint={d.hint} value={String(v)} options={d.choices} onChange={(x) => onChange(d.key, x)} />;
          case 'checkbox':
            return <CheckboxField key={d.key} label={d.label} hint={d.hint} checked={Boolean(v)} onChange={(x) => onChange(d.key, x)} />;
          case 'number':
            return <NumberField key={d.key} label={d.label} hint={d.hint} suffix={d.suffix} value={String(v)} onChange={(x) => onChange(d.key, x)} />;
          case 'text':
            return <TextField key={d.key} label={d.label} hint={d.hint} placeholder={d.placeholder} value={String(v)} onChange={(x) => onChange(d.key, x)} />;
        }
      })}
    </fieldset>
  );
}

export const str = (v: string | boolean | undefined) => String(v ?? '');
export const bool = (v: string | boolean | undefined) => v === true;
