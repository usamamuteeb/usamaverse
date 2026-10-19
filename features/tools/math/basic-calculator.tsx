'use client';

import { useMemo, useRef, useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { formatNumber } from '@/lib/format';
import { evaluate } from './logic';

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '%', '+', '(', ')', '^', '⌫'];

export default function BasicCalculator() {
  const [expr, setExpr] = useState('');
  const [history, setHistory] = useState<Array<{ expr: string; result: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const live = useMemo(() => {
    if (!expr.trim()) return { value: null as string | null, error: null as string | null };
    try {
      return { value: formatNumber(evaluate(expr)), error: null };
    } catch (e) {
      return { value: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [expr]);

  const press = (k: string) => {
    if (k === '⌫') setExpr((e) => e.slice(0, -1));
    else setExpr((e) => e + (['÷', '×', '−', '+', '^'].includes(k) ? ` ${k} ` : k).replace(/^ /, ''));
    inputRef.current?.focus();
  };

  const commit = () => {
    if (live.value === null) return;
    setHistory((h) => [{ expr, result: live.value! }, ...h].slice(0, 20));
    setExpr(live.value.replace(/^-/, '−'));
  };

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          <label htmlFor="calc-input" className="field-label">
            Expression
          </label>
          <input id="calc-input" ref={inputRef} className="input mono calc-input" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="(12 + 8) × 15% " autoComplete="off" inputMode="decimal" spellCheck={false} />
          <p className="calc-live mono" aria-live="polite">
            {live.value !== null ? `= ${live.value}` : ' '}
          </p>
          <div className="keypad" role="group" aria-label="Calculator keys">
            {KEYS.map((k) => (
              <button key={k} type="button" className="btn btn-secondary key" onClick={() => press(k)} aria-label={k === '⌫' ? 'Delete last character' : undefined}>
                {k}
              </button>
            ))}
            <button type="button" className="btn btn-ghost key" onClick={() => setExpr('')}>
              C
            </button>
            <button type="submit" className="btn btn-primary key key-wide">
              =
            </button>
          </div>
        </form>
        {live.error && expr.trim() && <Status tone="info">{live.error}</Status>}
      </div>
      <div className="tool-col">
        <div className="output-head">
          <h2 className="field-label">History</h2>
          {history.length > 0 && (
            <Button variant="ghost" onClick={() => setHistory([])}>
              Clear history
            </Button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="empty-state">Press = or Enter to keep a result here. History is not saved.</p>
        ) : (
          <ol className="history">
            {history.map((h, i) => (
              <li key={i} className="mono">
                <span className="muted">{h.expr} =</span> <strong>{h.result}</strong> <CopyButton text={h.result} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
