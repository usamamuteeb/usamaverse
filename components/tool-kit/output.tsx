'use client';

import { useId, useRef, type ReactNode } from 'react';
import { CopyButton, DownloadTextButton } from './actions';

export function OutputPanel({
  label = 'Result',
  value,
  filename,
  mime,
  rows = 10,
  emptyText = 'The result will appear here.',
  extraActions,
  mono = true,
}: {
  label?: string;
  value: string;
  filename?: string;
  mime?: string;
  rows?: number;
  emptyText?: string;
  extraActions?: ReactNode;
  mono?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  return (
    <div className="field output">
      <div className="output-head">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <div className="actions">
          <CopyButton text={value} targetRef={ref} />
          {filename && <DownloadTextButton text={value} filename={filename} mime={mime} />}
          {extraActions}
        </div>
      </div>
      <textarea id={id} ref={ref} className={mono ? 'input textarea mono' : 'input textarea'} value={value} rows={rows} readOnly placeholder={emptyText} spellCheck={false} />
    </div>
  );
}

export function ResultRows({ rows }: { rows: Array<{ label: string; value: string; emphasis?: boolean }> }) {
  return (
    <dl className="result-rows">
      {rows.map((r) => (
        <div key={r.label} className={r.emphasis ? 'result-row emphasis' : 'result-row'}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
