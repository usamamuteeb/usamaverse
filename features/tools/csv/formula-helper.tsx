'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { TASKS, checkFormula, explainFormula, withSep, type App, type FormulaSettings } from './formula';

const APPS: Array<{ value: App; label: string }> = [
  { value: 'excel', label: 'Microsoft Excel' },
  { value: 'sheets', label: 'Google Sheets' },
  { value: 'calc', label: 'LibreOffice Calc' },
];

const defaults = (id: string) => Object.fromEntries((TASKS.find((t) => t.id === id) ?? TASKS[0]).fields.map((f) => [f.key, f.default]));

export default function FormulaHelper() {
  const [mode, setMode] = useState<'build' | 'explain'>('build');
  const [taskId, setTaskId] = useState(TASKS[0].id);
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({});
  const [s, setS] = useState<FormulaSettings>({ app: 'excel', sep: ',', modern: true });
  const [pasted, setPasted] = useState('');
  const task = TASKS.find((t) => t.id === taskId) ?? TASKS[0];
  const v = { ...defaults(task.id), ...vals[task.id] };
  const built = task.build(v, s);
  const formula = built.formula ? withSep(built.formula, s.sep) : '';
  const groups = [...new Set(TASKS.map((t) => t.group))];
  const explained = explainFormula(pasted);
  const issues = pasted.trim() ? checkFormula(pasted) : [];

  return (
    <div className="stack">
      <div className="rt-views" role="tablist" aria-label="Mode">
        {(['build', 'explain'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'is-active' : ''} onClick={() => setMode(m)}>
            {m === 'build' ? 'Build a formula' : 'Explain a formula'}
          </button>
        ))}
      </div>
      <div className="form-grid">
        <SelectField label="Spreadsheet" value={s.app} onChange={(a) => setS((p) => ({ ...p, app: a as App }))} options={APPS} />
        <SelectField label="Argument separator" hint="Many European settings use “;”." value={s.sep} onChange={(x) => setS((p) => ({ ...p, sep: x as ',' | ';' }))} options={[{ value: ',', label: 'Comma  ,' }, { value: ';', label: 'Semicolon  ;' }]} />
        <CheckboxField label="Use newer functions" hint="XLOOKUP, IFS, TEXTJOIN, UNIQUE… (Excel 2021/365, Google Sheets)." checked={s.modern} onChange={(x) => setS((p) => ({ ...p, modern: x }))} />
      </div>
      {mode === 'build' ? (
        <>
          <div className="field">
            <label className="field-label" htmlFor="fh-task">
              What do you want to do?
            </label>
            <select id="fh-task" className="input select" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {TASKS.filter((t) => t.group === g).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="form-grid">
            {task.fields.map((f) =>
              f.kind === 'select' ? (
                <SelectField key={f.key} label={f.label} hint={f.hint} value={v[f.key]} onChange={(x) => setVals((p) => ({ ...p, [task.id]: { ...v, [f.key]: x } }))} options={f.choices ?? []} />
              ) : (
                <TextField key={f.key} label={f.label} hint={f.hint ?? (f.kind === 'range' ? 'e.g. B2:B100, B:B or Sheet2!B2:B100' : undefined)} value={v[f.key]} inputMode={f.kind === 'number' ? 'decimal' : undefined} onChange={(x) => setVals((p) => ({ ...p, [task.id]: { ...v, [f.key]: x } }))} />
              ),
            )}
          </div>
          {formula && (
            <div className="big-result" aria-live="polite">
              <span className="big-result-label">Formula</span>
              <code className="mono" style={{ fontSize: '1.05rem', overflowWrap: 'anywhere', fontWeight: 700 }}>
                {formula}
              </code>
              <div className="actions" style={{ marginTop: 6 }}>
                <CopyButton text={formula} label="Copy formula" />
              </div>
            </div>
          )}
          <p style={{ margin: 0 }}>{built.explain}</p>
          {built.note && <Status tone="info">{built.note}</Status>}
          {s.sep === ';' && <p className="field-hint">With “;” separators your spreadsheet may also expect a decimal comma (0,5 instead of 0.5) in numbers you type.</p>}
        </>
      ) : (
        <>
          <TextField label="Formula" value={pasted} onChange={setPasted} placeholder='=IFERROR(VLOOKUP(A2, Prices!A:C, 3, FALSE), "")' />
          {issues.map((i) => (
            <Status key={i} tone="warn">
              {i}
            </Status>
          ))}
          {explained.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Function</th>
                    <th>What it does</th>
                  </tr>
                </thead>
                <tbody>
                  {explained.map((e) => (
                    <tr key={e.name}>
                      <th scope="row" className="mono">
                        {e.name}
                      </th>
                      <td>{e.help}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            pasted.trim() && <Status tone="info">No functions found — this formula only uses references and operators.</Status>
          )}
          <p className="field-hint">Functions are listed outside-in, in the order they appear. Nothing is calculated.</p>
        </>
      )}
    </div>
  );
}
