'use client';

import { useId, type ReactNode, type RefObject } from 'react';

interface BaseProps {
  label: string;
  hint?: ReactNode;
  id?: string;
}

function Hint({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="field-hint">
      {children}
    </p>
  );
}

export function TextAreaField({
  label,
  hint,
  id,
  value,
  onChange,
  rows = 10,
  placeholder,
  readOnly,
  mono = true,
  textareaRef,
}: BaseProps & {
  value: string;
  onChange?: (v: string) => void;
  rows?: number;
  placeholder?: string;
  readOnly?: boolean;
  mono?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="field">
      <label htmlFor={fid} className="field-label">
        {label}
      </label>
      <textarea
        id={fid}
        ref={textareaRef}
        className={mono ? 'input textarea mono' : 'input textarea'}
        value={value}
        rows={rows}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-describedby={hint ? `${fid}-hint` : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
      <Hint id={`${fid}-hint`}>{hint}</Hint>
    </div>
  );
}

export function TextField({
  label,
  hint,
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  inputMode,
  min,
  max,
  step,
  suffix,
  autoFocus,
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'date' | 'datetime-local' | 'url' | 'number' | 'search' | 'color';
  placeholder?: string;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'url';
  min?: string | number;
  max?: string | number;
  step?: string | number;
  suffix?: string;
  autoFocus?: boolean;
}) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="field">
      <label htmlFor={fid} className="field-label">
        {label}
      </label>
      <div className={suffix ? 'input-wrap has-suffix' : 'input-wrap'}>
        <input
          id={fid}
          className="input"
          type={type}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={hint ? `${fid}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && (
          <span className="input-suffix" aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>
      <Hint id={`${fid}-hint`}>{hint}</Hint>
    </div>
  );
}

export function NumberField(props: Omit<Parameters<typeof TextField>[0], 'type' | 'inputMode'>) {
  return <TextField {...props} inputMode="decimal" />;
}

export interface Choice {
  value: string;
  label: string;
}

export function SelectField({ label, hint, id, value, onChange, options }: BaseProps & { value: string; onChange: (v: string) => void; options: Choice[] }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="field">
      <label htmlFor={fid} className="field-label">
        {label}
      </label>
      <select id={fid} className="input select" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${fid}-hint` : undefined}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Hint id={`${fid}-hint`}>{hint}</Hint>
    </div>
  );
}

export function CheckboxField({ label, hint, id, checked, onChange }: BaseProps & { checked: boolean; onChange: (v: boolean) => void }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="field field-check">
      <input id={fid} type="checkbox" className="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-describedby={hint ? `${fid}-hint` : undefined} />
      <label htmlFor={fid} className="check-label">
        {label}
      </label>
      <Hint id={`${fid}-hint`}>{hint}</Hint>
    </div>
  );
}

export function RangeField({
  label,
  hint,
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
}: BaseProps & { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="field">
      <label htmlFor={fid} className="field-label">
        {label}: <output htmlFor={fid}>{format ? format(value) : value}</output>
      </label>
      <input id={fid} type="range" className="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <Hint id={`${fid}-hint`}>{hint}</Hint>
    </div>
  );
}

export type StatusTone = 'error' | 'success' | 'info' | 'warn';

const TONE_LABEL: Record<StatusTone, string> = { error: 'Error', success: 'Done', info: 'Note', warn: 'Heads up' };
const TONE_ICON: Record<StatusTone, string> = { error: '✕', success: '✓', info: 'i', warn: '!' };

/** Status message that never relies on color alone (icon + label + text). */
export function Status({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <div className={`status status-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="status-icon" aria-hidden="true">
        {TONE_ICON[tone]}
      </span>
      <span>
        <strong>{TONE_LABEL[tone]}:</strong> {children}
      </span>
    </div>
  );
}

/** Polite live region for results that update as you type. */
export function LiveRegion({ children }: { children: ReactNode }) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}
