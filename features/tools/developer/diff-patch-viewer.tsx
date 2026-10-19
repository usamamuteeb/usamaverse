'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Button, OpenTextFileButton } from '@/components/tool-kit/actions';
import { Status, TextAreaField } from '@/components/tool-kit/fields';
import { parsePatch } from './patch';

const EXAMPLE = `diff --git a/src/app.js b/src/app.js
index 3b18e51..a1d2c3f 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,5 +1,6 @@
 import { start } from './server';
-const port = 3000;
+const port = process.env.PORT || 3000;
+const host = '0.0.0.0';
 
-start(port);
+start(port, host);
 export default start;
`;

export default function DiffPatchViewer() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const d = useDeferredValue(text);
  const parsed = useMemo(() => {
    if (!d.trim()) return null;
    try {
      return { files: parsePatch(d), e: null as string | null };
    } catch (e) {
      return { files: [], e: e instanceof Error ? e.message : String(e) };
    }
  }, [d]);
  const add = parsed?.files.reduce((n, f) => n + f.added, 0) ?? 0;
  const del = parsed?.files.reduce((n, f) => n + f.removed, 0) ?? 0;
  return (
    <div className="stack">
      <TextAreaField label="Unified diff / patch" value={text} onChange={setText} rows={8} hint="Paste output of “git diff”, “git show” or “diff -u”. It is only displayed, never applied." />
      <div className="actions">
        <OpenTextFileButton label="Open .diff/.patch" accept=".diff,.patch,.txt" onText={setText} onError={setError} />
        <Button variant="ghost" onClick={() => setText(EXAMPLE)}>Load example</Button>
        <Button variant="ghost" onClick={() => setText('')}>Reset</Button>
      </div>
      {(error || parsed?.e) && <Status tone="error">{error || parsed?.e}</Status>}
      {parsed && parsed.files.length > 0 && (
        <>
          <p className="summary">{parsed.files.length} file{parsed.files.length === 1 ? '' : 's'} changed, {add} addition{add === 1 ? '' : 's'}, {del} deletion{del === 1 ? '' : 's'}.</p>
          {parsed.files.map((f, fi) => (
            <section key={fi} className="patch-file" aria-label={`Changes to ${f.newPath || f.oldPath}`}>
              <h3>
                {f.status === 'renamed' ? `${f.oldPath} → ${f.newPath}` : f.newPath || f.oldPath} <span className="muted">({f.status}, +{f.added} −{f.removed})</span>
              </h3>
              {f.hunks.map((h, hi) => (
                <div key={hi} className="diff" role="table" aria-label="Hunk">
                  <div role="row" className="diff-line diff-meta"><span role="cell" className="diff-num" /><span role="cell" className="diff-num" /><span role="cell" className="diff-sign" /><span role="cell" className="diff-text">{h.header}</span></div>
                  {h.lines.map((l, li) => (
                    <div key={li} role="row" className={`diff-line ${l.type === 'add' ? 'diff-add' : l.type === 'del' ? 'diff-remove' : l.type === 'meta' ? 'diff-meta' : ''}`}>
                      <span role="cell" className="diff-num">{l.oldNo ?? ''}</span>
                      <span role="cell" className="diff-num">{l.newNo ?? ''}</span>
                      <span role="cell" className="diff-sign" aria-label={l.type === 'add' ? 'added' : l.type === 'del' ? 'removed' : 'context'}>{l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}</span>
                      <span role="cell" className="diff-text">{l.text || ' '}</span>
                    </div>
                  ))}
                </div>
              ))}
              {f.status === 'binary' && <p className="field-hint" style={{ padding: 8 }}>Binary file — no text changes to show.</p>}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
