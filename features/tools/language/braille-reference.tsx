'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/tool-kit/actions';
import { Status, TextAreaField } from '@/components/tool-kit/fields';
import { BRAILLE_TABLE, cell, toBraille } from './logic';

export default function BrailleReference() {
  const [text, setText] = useState('Hello 2026');
  const r = toBraille(text);
  return (
    <div className="stack">
      <div className="tool-grid">
        <div className="tool-col">
          <TextAreaField label="Text" value={text} onChange={setText} rows={4} mono={false} />
          <Status tone="info">Uncontracted (Grade 1) English braille only. It is not contracted (Grade 2) braille and is not suitable for official transcription.</Status>
        </div>
        <div className="tool-col">
          <div className="output-head"><span className="field-label">Unicode braille</span><CopyButton text={r.output} /></div>
          <p className="braille" lang="en-Brai">{r.output || ' '}</p>
          {r.skipped.length > 0 && <Status tone="warn">Not translated: {r.skipped.join(' ')}</Status>}
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table compact">
          <caption>Reference: letters, punctuation and indicators</caption>
          <thead><tr><th scope="col">Symbol</th><th scope="col">Cell</th><th scope="col">Dots</th></tr></thead>
          <tbody>
            {BRAILLE_TABLE.map((e) => (
              <tr key={e.label}>
                <td>{e.label}</td>
                <td className="braille" style={{ fontSize: '1.6rem' }}>{cell(e.dots)}</td>
                <td className="mono">{e.dots.join('-')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
