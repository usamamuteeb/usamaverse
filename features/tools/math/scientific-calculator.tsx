'use client';

import { useMemo, useRef, useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { SelectField, Status } from '@/components/tool-kit/fields';
import { formatNumber } from '@/lib/format';
import { evaluateScientific } from './more';

const KEYS = ['sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(', 'ln(', 'log(', 'sqrt(', '^', '!', 'π', 'e', '(', ')', 'mod', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '%', '+'];

export default function ScientificCalculator() {
  const [expr, setExpr] = useState('');
  const [angle, setAngle] = useState<'deg' | 'rad'>('deg');
  const [ans, setAns] = useState(0);
  const [history, setHistory] = useState<Array<{ expr: string; result: string }>>([]);
  const ref = useRef<HTMLInputElement>(null);
  const live = useMemo(() => {
    if (!expr.trim()) return { v: null as string | null, e: null as string | null };
    try {
      return { v: formatNumber(evaluateScientific(expr, angle, ans)), e: null };
    } catch (e) {
      return { v: null, e: e instanceof Error ? e.message : String(e) };
    }
  }, [expr, angle, ans]);
  const press = (k: string) => {
    setExpr((x) => x + (['÷', '×', '−', '+', 'mod'].includes(k) ? ` ${k} ` : k));
    ref.current?.focus();
  };
  const commit = () => {
    if (live.v === null) return;
    const n = evaluateScientific(expr, angle, ans);
    setAns(n);
    setHistory((h) => [{ expr, result: live.v! }, ...h].slice(0, 20));
    setExpr('');
  };
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <form onSubmit={(e) => { e.preventDefault(); commit(); }}>
          <label htmlFor="sci-input" className="field-label">Expression</label>
          <input id="sci-input" ref={ref} className="input mono calc-input" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="sin(30) + sqrt(2)^2" autoComplete="off" spellCheck={false} />
          <p className="calc-live mono" aria-live="polite">{live.v !== null ? `= ${live.v}` : ' '}</p>
          <div className="keypad sci" role="group" aria-label="Calculator keys">
            {KEYS.map((k) => (
              <button key={k} type="button" className="btn btn-secondary key" onClick={() => press(k)}>{k}</button>
            ))}
            <button type="button" className="btn btn-ghost key" onClick={() => press('ans')}>Ans</button>
            <button type="button" className="btn btn-ghost key" onClick={() => setExpr((x) => x.slice(0, -1))} aria-label="Delete last character">⌫</button>
            <button type="button" className="btn btn-ghost key" onClick={() => setExpr('')}>C</button>
            <button type="submit" className="btn btn-primary key">=</button>
          </div>
        </form>
        <SelectField label="Angles" value={angle} onChange={(v) => setAngle(v as 'deg')} options={[{ value: 'deg', label: 'Degrees' }, { value: 'rad', label: 'Radians' }]} />
        {live.e && expr.trim() && <Status tone="info">{live.e}</Status>}
      </div>
      <div className="tool-col">
        <div className="output-head">
          <h2 className="field-label">History</h2>
          {history.length > 0 && <Button variant="ghost" onClick={() => setHistory([])}>Clear history</Button>}
        </div>
        {history.length === 0 ? (
          <p className="empty-state">Press = or Enter to keep results. “Ans” reuses the last result. Nothing is saved.</p>
        ) : (
          <ol className="history">
            {history.map((h, i) => (
              <li key={i} className="mono">
                <span className="muted">{h.expr} =</span> <strong>{h.result}</strong> <CopyButton text={h.result} />
              </li>
            ))}
          </ol>
        )}
        <p className="field-hint">Functions: sin cos tan asin acos atan sinh cosh tanh sqrt cbrt abs exp ln log (base 10) log2 floor ceil round. Operators: + − × ÷ ^ mod, n! and %. Constants: π, e.</p>
      </div>
    </div>
  );
}
