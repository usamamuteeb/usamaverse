'use client';

import { useState } from 'react';
import { CheckboxField, Status } from '@/components/tool-kit/fields';
import { passwordStrength } from './security';

export default function PasswordStrengthMeter() {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const r = passwordStrength(pw);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div className="field">
          <label htmlFor="pw" className="field-label">Password to check</label>
          <input id="pw" className="input mono" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" spellCheck={false} />
        </div>
        <CheckboxField label="Show password" checked={show} onChange={setShow} />
        <Status tone="info">Checked entirely on this device. Nothing is sent or stored. Still, avoid typing a password you use for something important on any website.</Status>
      </div>
      <div className="tool-col" aria-live="polite">
        {pw && (
          <>
            <div className={`strength-bar s${r.score}`} aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={i <= r.score ? 'on' : ''} />)}</div>
            <p className="big-result"><span className="big-result-label">Estimate</span><span className="big-result-value">{r.label}</span></p>
            <dl className="result-rows">
              <div className="result-row"><dt>Rough entropy</dt><dd>{Math.round(r.bits)} bits</dd></div>
              <div className="result-row"><dt>Offline guessing (10¹⁰/s)</dt><dd>{r.crackTime}</dd></div>
            </dl>
            {r.warnings.map((w) => <Status key={w} tone="warn">{w}</Status>)}
            <ul>{r.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
          </>
        )}
        <p className="field-hint">A heuristic, not a guarantee: real attackers use large leaked-password lists and patterns this simple check can’t know.</p>
      </div>
    </div>
  );
}
