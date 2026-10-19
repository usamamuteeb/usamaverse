'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { CheckboxField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import type { RegexMatch, RegexRequest, RegexResponse } from '@/workers/regex.worker';

const TIMEOUT_MS = 1500;
const MAX_TEXT = 200_000;
const FLAG_INFO: Array<[string, string]> = [
  ['g', 'global — all matches'],
  ['i', 'ignore case'],
  ['m', 'multiline ^ and $'],
  ['s', 'dot matches newlines'],
  ['u', 'Unicode'],
  ['y', 'sticky'],
];

type State =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; matches: RegexMatch[]; total: number; truncated: boolean; replaced: string | null };

function createWorker() {
  return new Worker(new URL('../../../workers/regex.worker.ts', import.meta.url), { type: 'module' });
}

export default function RegexTester() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('gu');
  const [text, setText] = useState('');
  const [useReplace, setUseReplace] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    if (!pattern) {
      setState({ kind: 'idle' });
      return;
    }
    if (text.length > MAX_TEXT) {
      setState({ kind: 'error', message: `Test text is limited to ${MAX_TEXT.toLocaleString()} characters.` });
      return;
    }
    const id = ++reqId.current;
    const debounce = setTimeout(() => {
      if (!workerRef.current) workerRef.current = createWorker();
      const worker = workerRef.current;
      setState({ kind: 'running' });
      const timer = setTimeout(() => {
        if (id !== reqId.current) return;
        worker.terminate();
        workerRef.current = null;
        setState({ kind: 'error', message: `Stopped after ${TIMEOUT_MS / 1000} s. The pattern is probably backtracking catastrophically (for example nested quantifiers like (a+)+).` });
      }, TIMEOUT_MS);
      worker.onmessage = (e: MessageEvent<RegexResponse>) => {
        if (e.data.id !== reqId.current) return;
        clearTimeout(timer);
        const d = e.data;
        setState(d.ok ? { kind: 'done', matches: d.matches, total: d.total, truncated: d.truncated, replaced: d.replaced } : { kind: 'error', message: d.error });
      };
      const msg: RegexRequest = { id, pattern, flags, text, replacement: useReplace ? replacement : null, maxMatches: 1000 };
      worker.postMessage(msg);
    }, 120);
    return () => clearTimeout(debounce);
  }, [pattern, flags, text, useReplace, replacement]);

  const toggleFlag = (f: string, on: boolean) => setFlags((cur) => (on ? [...new Set(cur + f)].join('') : cur.replace(f, '')));

  return (
    <div className="stack">
      <div className="tool-grid">
        <div className="tool-col">
          <TextField label="Pattern (without slashes)" value={pattern} onChange={setPattern} placeholder="\\b(\\w+)@(\\w+)\\.com\\b" />
          <fieldset className="options inline">
            <legend className="field-label">Flags: /{flags}</legend>
            {FLAG_INFO.map(([f, label]) => (
              <CheckboxField key={f} label={`${f} — ${label}`} checked={flags.includes(f)} onChange={(on) => toggleFlag(f, on)} />
            ))}
          </fieldset>
          <CheckboxField label="Preview a replacement" checked={useReplace} onChange={setUseReplace} />
          {useReplace && <TextField label="Replacement ($1, $<name>, $& supported)" value={replacement} onChange={setReplacement} placeholder="$2: $1" />}
          <div className="actions">
            <Button
              variant="ghost"
              onClick={() => {
                setPattern('(\\w+)@([\\w.]+)');
                setText('Contact: ali@example.com, sara@test.org\nInvalid: @nope');
              }}
            >
              Load example
            </Button>
            <Button variant="ghost" onClick={() => { setPattern(''); setText(''); setReplacement(''); setFlags('gu'); setUseReplace(false); }}>
              Reset
            </Button>
          </div>
        </div>
        <div className="tool-col">
          <TextAreaField label="Test text" value={text} onChange={setText} rows={10} placeholder="Text to search…" />
        </div>
      </div>

      {state.kind === 'running' && <p className="summary">Testing…</p>}
      {state.kind === 'error' && <Status tone="error">{state.message}</Status>}
      {state.kind === 'done' && (
        <>
          <p className="summary" aria-live="polite">
            {state.total === 0 ? 'No matches.' : `${state.total.toLocaleString()} match${state.total === 1 ? '' : 'es'}${state.truncated ? ' (showing the first 1,000)' : ''}.`}
          </p>
          {state.total > 0 && <Highlighted text={text} matches={state.matches} />}
          {state.matches.length > 0 && (
            <div className="table-scroll">
              <table className="data-table">
                <caption>Matches</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Index</th>
                    <th scope="col">Match</th>
                    <th scope="col">Groups</th>
                  </tr>
                </thead>
                <tbody>
                  {state.matches.slice(0, 200).map((m, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{m.index}</td>
                      <td className="mono">{JSON.stringify(m.text)}</td>
                      <td className="mono">
                        {m.groups.map((g, k) => `$${k + 1}=${g === undefined ? '—' : JSON.stringify(g)}`).join('  ')}
                        {m.named ? `  ${Object.entries(m.named).map(([k, v]) => `${k}=${JSON.stringify(v ?? null)}`).join('  ')}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {state.replaced !== null && (
            <div className="field output">
              <div className="output-head">
                <span className="field-label">Replacement result</span>
                <CopyButton text={state.replaced} />
              </div>
              <pre className="code-block">{state.replaced}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Highlighted({ text, matches }: { text: string; matches: RegexMatch[] }) {
  const parts: Array<{ t: string; m: boolean }> = [];
  let pos = 0;
  for (const m of matches) {
    if (m.text === '' || m.index < pos) continue;
    if (m.index > pos) parts.push({ t: text.slice(pos, m.index), m: false });
    parts.push({ t: m.text, m: true });
    pos = m.index + m.text.length;
  }
  parts.push({ t: text.slice(pos), m: false });
  return (
    <pre className="code-block highlight" aria-label="Test text with matches highlighted">
      {parts.map((p, i) => (p.m ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </pre>
  );
}
