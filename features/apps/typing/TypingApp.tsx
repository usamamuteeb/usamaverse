'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import {
  abort, backspace, bestKey, chartBuckets, commitText, createSession, defaultConfig,
  getResult, interrupt, tick, type TypingConfig, type TypingResult, type TypingSession,
} from './engine';
import { buildPrompt, validateConfig } from './content';
import {
  addHistory, clearHistory, listHistory, loadSettings, makeEntry, mergeHistory,
  parseHistoryImport, saveSettings, type HistoryEntry,
} from './storage';

function newSeed(): number {
  try { return crypto.getRandomValues(new Uint32Array(1))[0]; }
  catch { return Date.now() >>> 0; }
}

function formatNumber(value: number | null, digits = 1): string {
  return value === null || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

function duration(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function ResultChart({ result }: { result: TypingResult }) {
  const buckets = chartBuckets(result.samples, result.durationSeconds);
  const max = Math.max(12, ...buckets.map((bucket) => bucket.wpm));
  return (
    <details className="typing-chart-details">
      <summary>Speed over time</summary>
      <p className="muted">Each bar shows correct characters typed in its measured time bucket, scaled to WPM. Idle buckets stay at zero.</p>
      <div className="typing-chart" role="img" aria-label={`Speed chart with ${buckets.length} measured buckets of ${buckets[0].spanSeconds} second${buckets[0].spanSeconds === 1 ? '' : 's'}. Peak ${max} WPM.`}>
        {buckets.map((bucket) => <span key={bucket.second} className="typing-chart-bar" style={{ height: `${Math.max(2, bucket.wpm / max * 100)}%` }} title={`Through second ${bucket.second}: ${bucket.wpm} WPM, ${bucket.wrong} wrong`} />)}
      </div>
      <div className="table-scroll typing-chart-table-wrap"><table className="data-table typing-chart-table"><caption>Measured {buckets[0].spanSeconds}-second buckets</caption><thead><tr><th>Through second</th><th>Correct</th><th>Wrong</th><th>WPM</th></tr></thead><tbody>
        {buckets.map((bucket) => <tr key={bucket.second}><td>{bucket.second}</td><td>{bucket.correct}</td><td>{bucket.wrong}</td><td>{bucket.wpm}</td></tr>)}
      </tbody></table></div>
    </details>
  );
}

function ResultPanel({ result, best, onRetry, onNew }: { result: TypingResult; best: number | null; onRetry: () => void; onNew: () => void }) {
  const label = result.config.mode === 'time' ? `${result.config.seconds} seconds` : result.config.mode === 'words' ? `${result.config.wordCount} words` : result.config.mode === 'quote' ? `${result.config.quoteLength} quote` : 'custom text';
  return (
    <section className="typing-result" aria-labelledby="typing-result-title">
      <div className="typing-result-head"><div><p className="eyebrow">{result.status === 'aborted' ? 'Practice stopped' : 'Practice finished'}</p><h2 id="typing-result-title" className="h2">Your result</h2><p className="muted">{label} · English · UsamaType scoring</p></div><span className="typing-result-badge">{result.status === 'aborted' ? 'Not saved' : result.interrupted ? 'Interrupted · PB ineligible' : result.eligibleForBest && best !== null && result.wpm !== null && result.wpm >= best ? 'Personal best' : 'Saved locally'}</span></div>
      <div className="typing-metric-grid">
        <div><span>WPM</span><strong>{formatNumber(result.wpm)}</strong></div>
        <div><span>Raw WPM</span><strong>{formatNumber(result.rawWpm)}</strong></div>
        <div><span>Accuracy</span><strong>{result.accuracy === null ? '—' : `${formatNumber(result.accuracy)}%`}</strong></div>
        <div><span>Duration</span><strong>{duration(result.durationSeconds)}</strong></div>
      </div>
      {result.wpm === null && <p className="status status-info">No score: type for at least one second to receive a reliable rate.</p>}
      <p className="typing-accounting">Attempts: {result.attempts} · Correct attempts: {result.correctAttempts} · Wrong attempts: {result.wrongAttempts} · Backspaces: {result.backspaces}</p>
      <p className="typing-accounting">Final passage: {result.positional.correct} correct · {result.positional.incorrect} incorrect · {result.positional.extra} extra · {result.positional.missed} missed</p>
      <div className="actions"><button type="button" className="btn btn-primary" onClick={onRetry}>Retry same text</button><button type="button" className="btn btn-secondary" onClick={onNew}>New test</button></div>
      {result.wpm !== null && result.samples.length > 0 && <ResultChart result={result} />}
    </section>
  );
}

export function TypingApp() {
  const [config, setConfig] = useState<TypingConfig>(defaultConfig);
  const [settingsReady, setSettingsReady] = useState(false);
  const [session, setSession] = useState<TypingSession>(() => createSession(defaultConfig, buildPrompt(defaultConfig, 1)));
  const sessionRef = useRef(session);
  const [now, setNow] = useState(0);
  const [focused, setFocused] = useState(false);
  const [composing, setComposing] = useState(false);
  const composingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef<TypingSession | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [tab, setTab] = useState<'practice' | 'history' | 'help'>('practice');
  const [historyMode, setHistoryMode] = useState<'all' | TypingConfig['mode']>('all');
  const [historyDays, setHistoryDays] = useState('all');
  const [historyCutoff, setHistoryCutoff] = useState(0);
  const [customSeconds, setCustomSeconds] = useState('');
  const [customWords, setCustomWords] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = (next: TypingSession) => { sessionRef.current = next; setSession(next); };
  const reset = (nextConfig: TypingConfig, sameText = false) => {
    const target = sameText ? sessionRef.current.target.join('') : buildPrompt(nextConfig, newSeed());
    apply(createSession(nextConfig, target));
    setNow(0);
    if (inputRef.current) inputRef.current.value = '';
    setTab('practice');
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const updateConfig = (patch: Partial<TypingConfig>) => {
    if (sessionRef.current.status === 'running') return;
    const next: TypingConfig = { ...config, ...patch };
    setConfig(next);
    if (patch.customText !== undefined) apply(createSession(next, next.customText.trim()));
    else if (next.mode === 'custom' && !next.customText.trim()) apply(createSession(next, ''));
    else if (!validateConfig(next)) reset(next);
  };

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const stored = loadSettings();
      setConfig(stored);
      const loaded = createSession(stored, buildPrompt(stored, newSeed()));
      sessionRef.current = loaded;
      setSession(loaded);
      setSettingsReady(true);
      listHistory().then((entries) => { if (!cancelled) setHistory(entries); }).catch(() => { if (!cancelled) setHistoryError('Local history is unavailable. Practice still works in this tab.'); });
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (settingsReady && !validateConfig(config)) saveSettings(config); }, [config, settingsReady]);

  useEffect(() => {
    if (session.status !== 'running') return;
    const timer = window.setInterval(() => {
      const time = performance.now();
      const next = tick(sessionRef.current, time);
      if (next !== sessionRef.current) apply(next);
      setNow(time);
    }, 100);
    const onHidden = () => {
      if (document.hidden) apply(interrupt(sessionRef.current));
      else {
        const next = tick(sessionRef.current, performance.now());
        if (next !== sessionRef.current) apply(next);
      }
    };
    const onBlur = () => apply(interrupt(sessionRef.current));
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('blur', onBlur);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onHidden); window.removeEventListener('blur', onBlur); };
  }, [session.status]);

  useEffect(() => {
    if (session.status !== 'completed' || savedRef.current === session) return;
    savedRef.current = session;
    const result = getResult(session);
    if (!result) return;
    const entry = makeEntry(result);
    addHistory(entry).then(() => setHistory((list) => [entry, ...list].slice(0, 500))).catch(() => setHistoryError('This result could not be saved to local history.'));
  }, [session]);

  const result = useMemo(() => getResult(session), [session]);
  const best = history.filter((item) => item.key === bestKey(config) && !item.interrupted && item.wpm !== null).reduce<number | null>((top, item) => top === null ? item.wpm : Math.max(top, item.wpm!), null);
  const activeTime = session.startedAt === null ? 0 : Math.max(0, ((session.endedAt ?? now) - session.startedAt) / 1000);
  const timeLeft = config.mode === 'time' ? Math.max(0, config.seconds - activeTime) : activeTime;
  const liveWpm = activeTime >= 1 ? session.correctAttempts * 12 / activeTime : null;
  const liveAccuracy = session.attempts > 0 ? session.correctAttempts / session.attempts * 100 : null;
  const cursor = session.typed.length;
  let start = Math.max(0, cursor - 76);
  if (start > 0) {
    const edge = start;
    while (start > 0 && edge - start < 24 && session.target[start - 1] !== ' ' && session.target[start - 1] !== '\n') start -= 1;
    if (start > 0 && session.target[start - 1] !== ' ' && session.target[start - 1] !== '\n') start = edge;
  }
  let end = Math.min(session.target.length, start + 180);
  if (end < session.target.length) {
    const edge = end;
    while (end < session.target.length && end - edge < 24 && session.target[end] !== ' ' && session.target[end] !== '\n') end += 1;
    if (end < session.target.length && session.target[end] !== ' ' && session.target[end] !== '\n') end = edge;
  }
  const visible = session.target.slice(start, end);
  const configError = validateConfig(config);

  const acceptText = (value: string) => {
    if (configError) return;
    const next = commitText(sessionRef.current, value, performance.now());
    if (next !== sessionRef.current) apply(next);
  };
  const onInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (composingRef.current) return;
    const element = event.currentTarget;
    if ((event.nativeEvent as InputEvent).inputType === 'insertFromPaste') { element.value = ''; return; }
    const value = element.value;
    element.value = '';
    if (value) acceptText(value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Backspace' && !composingRef.current) {
      event.preventDefault();
      const next = backspace(sessionRef.current, performance.now());
      if (next !== sessionRef.current) apply(next);
    }
  };
  const filteredHistory = history.filter((item) => {
    if (historyMode !== 'all' && item.mode !== historyMode) return false;
    if (historyDays !== 'all' && item.at < historyCutoff) return false;
    return true;
  });
  const exportHistory = () => {
    const blob = new Blob([JSON.stringify({ version: 1, entries: history }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'usamatype-history.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importHistory = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 500000) throw new Error('History file is too large.');
      const entries = parseHistoryImport(JSON.parse(await file.text()));
      await mergeHistory(entries);
      setHistory(await listHistory());
      setHistoryError(`Imported ${entries.length} results into this browser.`);
    } catch (error) { setHistoryError(error instanceof Error ? error.message : 'Could not import history.'); }
    event.target.value = '';
  };
  const clear = async () => {
    if (!window.confirm('Clear all typing history stored in this browser? This cannot be undone.')) return;
    try { await clearHistory(); setHistory([]); setHistoryError('Local typing history cleared.'); }
    catch { setHistoryError('Could not clear local history.'); }
  };

  return (
    <div className={`typing-app ${session.status === 'running' ? 'is-running' : ''}`} data-ready={settingsReady} aria-busy={!settingsReady}>
      <div className="typing-tabs" role="tablist" aria-label="UsamaType sections">
        {(['practice', 'history', 'help'] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? 'is-active' : ''} disabled={session.status === 'running' && name !== 'practice'} onClick={() => setTab(name)}>{name === 'practice' ? 'Practice' : name === 'history' ? 'Local history' : 'How it works'}</button>)}
      </div>

      {tab === 'practice' && <div role="tabpanel">
        <div className="typing-setup" hidden={session.status === 'running'}>
          {(config.mode === 'time' || config.mode === 'words') && <div className="typing-modifiers"><label><input type="checkbox" checked={config.punctuation} onChange={(event) => updateConfig({ punctuation: event.target.checked })} /> Punctuation</label><label><input type="checkbox" checked={config.numbers} onChange={(event) => updateConfig({ numbers: event.target.checked })} /> Numbers</label></div>}
          <div className="typing-mode-row" role="group" aria-label="Test mode">
            {(['time', 'words', 'quote', 'custom'] as const).map((mode) => <button key={mode} type="button" className={config.mode === mode ? 'is-active' : ''} aria-pressed={config.mode === mode} onClick={() => updateConfig({ mode })}>{mode === 'time' ? '⏱ Time' : mode === 'words' ? '📝 Words' : mode === 'quote' ? '❝ Quote' : '✍️ Custom'}</button>)}
          </div>
          <div className="typing-options">
            {config.mode === 'time' && <div className="typing-presets" role="group" aria-label="Time length">{[15, 30, 60, 120].map((seconds) => <button key={seconds} type="button" aria-pressed={config.seconds === seconds} onClick={() => { setCustomSeconds(''); updateConfig({ seconds }); }}>{seconds}s</button>)}<label>Custom seconds <input className="input" type="number" min="5" max="300" value={customSeconds} placeholder={String(config.seconds)} onChange={(event) => { setCustomSeconds(event.target.value); updateConfig({ seconds: Number(event.target.value) }); }} /></label></div>}
            {config.mode === 'words' && <div className="typing-presets" role="group" aria-label="Word count">{[10, 25, 50, 100].map((wordCount) => <button key={wordCount} type="button" aria-pressed={config.wordCount === wordCount} onClick={() => { setCustomWords(''); updateConfig({ wordCount }); }}>{wordCount}</button>)}<label>Custom words <input className="input" type="number" min="5" max="500" value={customWords} placeholder={String(config.wordCount)} onChange={(event) => { setCustomWords(event.target.value); updateConfig({ wordCount: Number(event.target.value) }); }} /></label></div>}
            {config.mode === 'quote' && <div className="typing-presets" role="group" aria-label="Quote length">{(['short', 'medium', 'long'] as const).map((quoteLength) => <button key={quoteLength} type="button" aria-pressed={config.quoteLength === quoteLength} onClick={() => updateConfig({ quoteLength })}>{quoteLength}</button>)}</div>}
            {config.mode === 'custom' && <label className="field typing-custom-label"><span className="field-label">Your practice text</span><textarea className="input textarea" value={config.customText} maxLength={5000} placeholder="Paste or write your own text here. It stays in this tab and is never saved to history." onChange={(event) => updateConfig({ customText: event.target.value })} /><span className="field-hint">Setup paste is allowed. Live test paste is blocked.</span></label>}
          </div>
          {configError && <p role="alert" className="typing-error">{configError}</p>}
        </div>

        <div className="typing-status-row" aria-label="Live test metrics">
          <div><span>{config.mode === 'time' ? 'Time left' : 'Elapsed'}</span><strong>{duration(timeLeft)}</strong></div>
          <div><span>WPM</span><strong>{formatNumber(liveWpm, 0)}</strong></div>
          <div><span>Accuracy</span><strong>{liveAccuracy === null ? '—' : `${formatNumber(liveAccuracy, 0)}%`}</strong></div>
          <div><span>Best here</span><strong>{formatNumber(best, 0)}</strong></div>
        </div>
        <p className="typing-state" role="status">{session.status === 'ready' ? 'Ready. The timer starts when you type your first character.' : session.status === 'running' ? session.interrupted ? 'Running · tab/window focus was lost, so this run is not eligible for a personal best.' : 'Running · type the passage below.' : session.status === 'completed' ? 'Completed. Your result is below.' : 'Stopped. Start a new test when ready.'}</p>
        <div className={`typing-surface ${focused ? 'is-focused' : ''}`} onClick={() => inputRef.current?.focus()}>
          <p className="typing-prompt-label">{config.mode === 'time' ? 'Type the words' : config.mode === 'words' ? 'Type all words to finish' : 'Type the passage to finish'}</p>
          <div className="typing-passage-wrap"><p className="typing-passage" aria-hidden="true">
            {start > 0 && <span className="typing-fade">… </span>}
            {visible.map((unit, offset) => {
              const index = start + offset;
              const entered = session.typed[index];
              const kind = entered === undefined ? 'pending' : entered === unit ? 'correct' : 'wrong';
              return <span key={index} className={`typing-char ${kind} ${index === cursor && session.status !== 'completed' ? 'is-caret' : ''}`} title={kind === 'wrong' ? `Expected ${unit === ' ' ? 'space' : unit}` : undefined}>{kind === 'wrong' ? entered : unit}</span>;
            })}
            {end < session.target.length && <span className="typing-fade"> …</span>}
          </p>
          <p className="sr-only" id="typing-full-prompt">Practice text: {session.target.join('')}</p>
          <textarea ref={inputRef} className="typing-input" rows={1} aria-label="Typing input" aria-describedby="typing-input-help" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} disabled={session.status === 'completed' || session.status === 'aborted' || Boolean(configError)} placeholder={session.status === 'ready' ? 'Click or tap here, then type what you see' : 'Keep typing…'} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onInput={onInput} onKeyDown={onKeyDown} onPaste={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()} onCompositionStart={() => { composingRef.current = true; setComposing(true); }} onCompositionEnd={(event) => { composingRef.current = false; setComposing(false); const value = event.currentTarget.value; event.currentTarget.value = ''; if (value) acceptText(value); }} />
          </div>
          <p id="typing-input-help" className="typing-input-help">{composing ? 'Composing text…' : 'Click or tap the passage to type · Backspace to correct · Paste disabled'}</p>
        </div>
        <div className="typing-actions actions"><button type="button" className="btn btn-secondary" onClick={() => reset(config, true)} disabled={Boolean(configError)}>↺ Retry same text</button><button type="button" className="btn btn-ghost" onClick={() => reset(config)} disabled={Boolean(configError)}>New passage</button>{session.status === 'running' && <button type="button" className="btn btn-ghost" onClick={() => apply(abort(sessionRef.current, performance.now()))}>End run</button>}</div>
        {result && <ResultPanel result={result} best={best} onRetry={() => reset(config, true)} onNew={() => reset(config)} />}
        <p className="typing-privacy">Practice happens on this device. Settings and result summaries are stored only in this browser; typed text and key timings are not saved.</p>
      </div>}

      {tab === 'history' && <section className="typing-history" role="tabpanel" aria-labelledby="history-title">
        <div className="section-heading-row"><div><p className="eyebrow">On this device</p><h2 id="history-title" className="h2">Local history</h2><p className="muted">Result summaries stay in this browser. They do not sync to other devices.</p></div><div className="actions"><button type="button" className="btn btn-secondary" onClick={exportHistory} disabled={history.length === 0}>Export JSON</button><button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>Import JSON</button><button type="button" className="btn btn-ghost" onClick={clear} disabled={history.length === 0}>Clear</button><input ref={fileRef} className="visually-hidden-input" type="file" accept="application/json,.json" onChange={importHistory} aria-label="Import typing history JSON" /></div></div>
        {historyError && <p role="status" className="typing-storage-message">{historyError}</p>}
        <div className="typing-history-filters"><label>Mode <select className="input select" value={historyMode} onChange={(event) => setHistoryMode(event.target.value as typeof historyMode)}><option value="all">All modes</option><option value="time">Time</option><option value="words">Words</option><option value="quote">Quote</option><option value="custom">Custom</option></select></label><label>When <select className="input select" value={historyDays} onChange={(event) => { const days = event.target.value; setHistoryDays(days); setHistoryCutoff(days === 'all' ? 0 : Date.now() - Number(days) * 86400000); }}><option value="all">All dates</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label></div>
        <p className="muted">Showing {filteredHistory.length} of {history.length} locally saved result{history.length === 1 ? '' : 's'}.</p>
        {filteredHistory.length === 0 ? <p className="empty-state">No results match this filter yet. Finish a practice test to build your history.</p> : <div className="table-scroll"><table className="data-table"><caption className="sr-only">Local typing practice results</caption><thead><tr><th>Date</th><th>Mode</th><th>WPM</th><th>Raw</th><th>Accuracy</th><th>Time</th><th>Notes</th></tr></thead><tbody>{filteredHistory.map((item) => <tr key={item.id}><td>{new Date(item.at).toLocaleString()}</td><td>{item.length}</td><td>{formatNumber(item.wpm)}</td><td>{formatNumber(item.rawWpm)}</td><td>{item.accuracy === null ? '—' : `${formatNumber(item.accuracy)}%`}</td><td>{duration(item.durationSeconds)}</td><td>{item.interrupted ? 'Interrupted' : 'Local'}</td></tr>)}</tbody></table></div>}
      </section>}

      {tab === 'help' && <section className="typing-help prose" role="tabpanel" aria-labelledby="typing-help-title"><h2 id="typing-help-title" className="h2">How UsamaType scores a run</h2><p>This app uses its own clear scoring rule. It is an original practice experience, not a score imported from another typing service.</p><ul><li>The first committed character starts the timer. Time tests end at the configured deadline. Words, quote and custom tests finish when the final target character is entered.</li><li>Each typed grapheme is an attempt. A matching attempt is correct; a mismatch is wrong. Backspace changes what you see, but does not erase earlier attempts from accuracy.</li><li>WPM = correct attempts ÷ 5 ÷ elapsed minutes. Raw WPM uses all attempts. Accuracy = correct attempts ÷ all attempts × 100. Runs under one second have no rate score.</li><li>Final passage counts describe the visible text at the end: correct, incorrect, extra and untyped missed characters. They differ from historical attempt counts after a correction.</li><li>Hiding or leaving the tab keeps the clock running and marks that run ineligible for a personal best. Custom text is also excluded from personal bests because passages differ.</li><li>Personal bests compare only the same mode, length, language and modifiers. History is local to this device and can be exported or cleared by you.</li></ul><p>Keyboard: click or tap the passage, then type. Backspace corrects your visible text. Tab still moves through controls. Use Retry same text for another attempt on the identical prompt.</p></section>}
    </div>
  );
}
