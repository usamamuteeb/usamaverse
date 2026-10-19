'use client';

import { useDeferredValue, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { TextAreaField } from '@/components/tool-kit/fields';
import { inspectText } from './logic';

export default function UnicodeInspector() {
  const [text, setText] = useState('');
  const d = useDeferredValue(text);
  const clusters = inspectText(d);
  const points = clusters.reduce((n, c) => n + c.points.length, 0);
  return (
    <div className="stack">
      <TextAreaField label="Text to inspect" value={text} onChange={setText} rows={4} mono={false} hint="Reveals invisible characters, look-alike letters, combining marks and emoji sequences." />
      <div className="actions">
        <Button variant="ghost" onClick={() => setText('café vs café · 👍🏽 · zero​width · Аpple (Cyrillic А)')}>Load example</Button>
        <Button variant="ghost" onClick={() => setText('')}>Reset</Button>
      </div>
      {clusters.length > 0 && (
        <>
          <p className="summary">{clusters.length} visible character(s) made of {points} code point(s){d.length > 0 && clusters.length >= 500 ? ' (showing the first 500)' : ''}.</p>
          <div className="table-scroll">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th scope="col">Char</th><th scope="col">Code point</th><th scope="col">Category</th><th scope="col">Script</th><th scope="col">UTF-8</th><th scope="col">UTF-16</th><th scope="col">Escapes</th>
                </tr>
              </thead>
              <tbody>
                {clusters.flatMap((c, ci) =>
                  c.points.map((p, pi) => (
                    <tr key={`${ci}-${pi}`} className={c.points.length > 1 && pi > 0 ? 'muted' : undefined}>
                      <td className="char-cell">{pi === 0 ? (/^\s$|\p{Cf}|\p{Cc}/u.test(p.char) ? '·' : c.grapheme) : '↳'}</td>
                      <td className="mono">{p.codePoint}</td>
                      <td>{p.category}</td>
                      <td>{p.script}</td>
                      <td className="mono">{p.utf8}</td>
                      <td className="mono">{p.utf16}</td>
                      <td className="mono">{p.htmlEntity} {p.jsEscape}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className="field-hint">Character names aren’t shown because browsers don’t include the Unicode name database. “↳” marks code points that join the character above.</p>
        </>
      )}
    </div>
  );
}
