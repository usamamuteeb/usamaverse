'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { CheckboxField, Status, TextAreaField } from '@/components/tool-kit/fields';
import { diffToUnifiedText, lineDiff } from './logic';

export default function TextDiff() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWs, setIgnoreWs] = useState(false);
  const [onlyChanges, setOnlyChanges] = useState(false);
  const da = useDeferredValue(a);
  const db = useDeferredValue(b);

  const outcome = useMemo(() => {
    if (!da && !db) return { ops: null, error: null };
    try {
      return { ops: lineDiff(da, db, { ignoreCase, ignoreWhitespace: ignoreWs }), error: null };
    } catch (e) {
      return { ops: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [da, db, ignoreCase, ignoreWs]);

  const added = outcome.ops?.filter((o) => o.type === 'add').length ?? 0;
  const removed = outcome.ops?.filter((o) => o.type === 'remove').length ?? 0;
  const shown = outcome.ops?.filter((o) => !onlyChanges || o.type !== 'equal') ?? [];

  return (
    <div className="stack">
      <div className="tool-grid">
        <TextAreaField label="Original" value={a} onChange={setA} rows={10} placeholder="Paste the original text…" />
        <TextAreaField label="Changed" value={b} onChange={setB} rows={10} placeholder="Paste the changed text…" />
      </div>
      <div className="options inline">
        <CheckboxField label="Ignore case" checked={ignoreCase} onChange={setIgnoreCase} />
        <CheckboxField label="Ignore whitespace differences" checked={ignoreWs} onChange={setIgnoreWs} />
        <CheckboxField label="Show changed lines only" checked={onlyChanges} onChange={setOnlyChanges} />
      </div>
      <div className="actions">
        <Button variant="ghost" onClick={() => { setA('Line one\nLine two\nLine three'); setB('Line one\nLine 2\nLine three\nLine four'); }}>
          Load example
        </Button>
        <Button variant="ghost" onClick={() => { setA(b); setB(a); }}>
          ⇄ Swap
        </Button>
        <Button variant="ghost" onClick={() => { setA(''); setB(''); }}>
          Reset
        </Button>
        {outcome.ops && <CopyButton text={diffToUnifiedText(outcome.ops)} label="Copy diff" />}
      </div>
      {outcome.error && <Status tone="error">{outcome.error}</Status>}
      {outcome.ops && (
        <>
          <p className="summary" aria-live="polite">
            {added === 0 && removed === 0 ? 'No differences.' : `${added} line${added === 1 ? '' : 's'} added, ${removed} removed.`}
          </p>
          <div className="diff" role="table" aria-label="Line differences">
            {shown.map((op, i) => (
              <div key={i} role="row" className={`diff-line diff-${op.type}`}>
                <span role="cell" className="diff-num">{op.a ?? ''}</span>
                <span role="cell" className="diff-num">{op.b ?? ''}</span>
                <span role="cell" className="diff-sign" aria-label={op.type === 'add' ? 'added' : op.type === 'remove' ? 'removed' : 'unchanged'}>
                  {op.type === 'add' ? '+' : op.type === 'remove' ? '−' : ' '}
                </span>
                <span role="cell" className="diff-text">{op.text || ' '}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
