'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { downloadText } from '@/lib/tools/shared/download';
import { lineDiff } from '@/features/tools/text/logic';
import { parseCv } from '@/features/tools/career/cv-convert';
import { CvPreview } from '@/features/tools/career/CvPreview';
import { CvExports, CvStyleFields } from '@/features/tools/career/CvExports';
import { defaultCvStyle, type CvStyle } from '@/features/tools/career/cv-pdf';
import { sendToBuilder, BUILDER_HREF } from '@/features/tools/career/cv-storage';
import { detectJob, tailor, type TailorResult, type TailorSettings } from './engine';
import { DEFAULT_TEX, EXAMPLE_JD } from './defaults';
import { defaultSettings, fileStemFor, loadHistory, loadSettings, resetSettings, runId, saveHistory, saveSettings, type RunRecord } from './storage';

type Tab = 'tailor' | 'history' | 'setup';
type View = 'tex' | 'diff' | 'preview';

interface Current {
  record: RunRecord;
  result?: TailorResult;
}

function ScoreCard({ before, after }: { before: number; after: number }) {
  const delta = after - before;
  return (
    <div className="rt-score">
      <div>
        <span className="rt-score-label">Match before</span>
        <span className="rt-score-num">{before}%</span>
      </div>
      <span className="rt-score-arrow" aria-hidden="true">
        →
      </span>
      <div>
        <span className="rt-score-label">Match after</span>
        <span className="rt-score-num rt-after">{after}%</span>
      </div>
      <span className={`rt-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>{delta > 0 ? `+${delta}` : delta} pts</span>
    </div>
  );
}

function DiffView({ a, b }: { a: string; b: string }) {
  const ops = useMemo(() => lineDiff(a, b), [a, b]);
  const rows: Array<{ type: string; text: string; n?: number }> = [];
  ops.forEach((op, i) => {
    if (op.type !== 'equal') rows.push({ type: op.type, text: op.text, n: op.b ?? op.a });
    else {
      const near = ops.slice(Math.max(0, i - 2), i + 3).some((o) => o.type !== 'equal');
      if (near) rows.push({ type: 'equal', text: op.text, n: op.b });
      else if (rows.length && rows[rows.length - 1].type !== 'gap') rows.push({ type: 'gap', text: '⋯' });
    }
  });
  const changed = ops.filter((o) => o.type !== 'equal').length;
  if (!changed) return <p className="empty-state">No line changed.</p>;
  return (
    <div className="diff rt-diff" role="table" aria-label="Changes between your base resume and the tailored one">
      {rows.map((r, i) => (
        <div key={i} className={`diff-line ${r.type === 'add' ? 'diff-add' : r.type === 'remove' ? 'diff-remove' : r.type === 'gap' ? 'diff-meta' : ''}`} role="row">
          <span className="diff-num">{r.n ?? ''}</span>
          <span className="diff-num" />
          <span className="diff-sign">{r.type === 'add' ? '+' : r.type === 'remove' ? '−' : ''}</span>
          <span className="diff-text">{r.text}</span>
        </div>
      ))}
    </div>
  );
}

export function ResumeTailorApp() {
  const [tab, setTab] = useState<Tab>('tailor');
  const [settings, setSettings] = useState<TailorSettings>(defaultSettings);
  const [hasSaved, setHasSaved] = useState(false);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [jd, setJd] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [touched, setTouched] = useState(false);
  const [current, setCurrent] = useState<Current | null>(null);
  const [view, setView] = useState<View>('tex');
  const [style, setStyle] = useState<CvStyle>(defaultCvStyle);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'error' | 'warn' | 'success' | 'info'; text: string } | null>(null);
  const [storeOk, setStoreOk] = useState(true);
  const loaded = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s.settings);
    setHasSaved(s.saved);
    setHistory(loadHistory());
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => setStoreOk(saveSettings(settings)), 400);
    return () => clearTimeout(t);
  }, [settings]);
  useEffect(() => {
    if (touched) return;
    const d = detectJob(jd);
    setRole(d.role);
    setCompany(d.company);
  }, [jd, touched]);

  const set = <K extends keyof TailorSettings>(k: K) => (v: TailorSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const run = () => {
    if (!jd.trim()) return setNote({ tone: 'error', text: 'Paste a job description first.' });
    setBusy(true);
    setNote(null);
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const r = tailor(settings, { jd, role, company });
        const record: RunRecord = {
          id: runId(),
          at: new Date().toISOString(),
          role: role || 'Untitled role',
          company,
          jd,
          tex: r.tex,
          scoreBefore: r.before.score,
          scoreAfter: r.after.score,
          missing: r.after.missing.map((m) => m.term),
          changes: r.changes,
          warnings: r.warnings,
          bullets: r.bullets,
          certsUsed: r.certsUsed,
          durationMs: Math.round(performance.now() - t0),
        };
        const next = [record, ...history];
        const saved = saveHistory(next);
        setHistory(next.slice(0, saved.saved ? saved.kept : next.length));
        setCurrent({ record, result: r });
        setView('tex');
        if (!saved.saved) setNote({ tone: 'warn', text: 'Done — but this browser blocked storage, so the run is not saved in History.' });
      } catch (e) {
        setNote({ tone: 'error', text: `Tailoring failed: ${e instanceof Error ? e.message : String(e)}` });
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  const parsed = useMemo(() => {
    if (!current || view !== 'preview') return null;
    try {
      return parseCv(current.record.tex, 'latex').cv;
    } catch {
      return null;
    }
  }, [current, view]);

  const rec = current?.record;
  const stem = rec ? fileStemFor(rec) : 'resume';

  return (
    <div className="rt-app">
      <div className="rt-tabs" role="tablist" aria-label="Resume Tailor">
        {(['tailor', 'history', 'setup'] as Tab[]).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
            {t === 'tailor' ? 'Tailor' : t === 'history' ? `History (${history.length})` : 'Setup'}
          </button>
        ))}
        <span className="rt-local">● Runs in your browser · no AI model · nothing uploaded</span>
      </div>

      {tab === 'tailor' && (
        <div className="rt-grid">
          <section className="rt-input" aria-label="Job description">
            <TextAreaField label="Job description" value={jd} onChange={setJd} rows={14} mono={false} placeholder="Paste the full job posting here…" />
            <div className="form-grid">
              <TextField label="Job title" value={role} onChange={(v) => { setRole(v); setTouched(true); }} />
              <TextField label="Company" value={company} onChange={(v) => { setCompany(v); setTouched(true); }} />
            </div>
            <div className="actions">
              <Button variant="primary" onClick={run} disabled={busy}>
                {busy ? 'Tailoring…' : 'Tailor my resume'}
              </Button>
              <Button variant="ghost" onClick={() => { setJd(EXAMPLE_JD); setTouched(false); }}>
                Example job
              </Button>
              <Button variant="ghost" onClick={() => { setJd(''); setTouched(false); setCurrent(null); }}>
                Clear
              </Button>
            </div>
            {note && <Status tone={note.tone}>{note.text}</Status>}
            <p className="field-hint">
              Uses your base resume and rules from <button type="button" className="link-button" onClick={() => setTab('setup')}>Setup</button>
              {settings.baseTex === DEFAULT_TEX ? ' — currently the built-in sample resume. Paste your own .tex there first.' : hasSaved || storeOk ? ' (saved in this browser).' : '.'}
            </p>
          </section>

          <section className="rt-output" aria-label="Result" aria-live="polite">
            {!rec ? (
              <div className="empty-state rt-empty">
                <strong>How it works</strong>
                <ol>
                  <li>Set your base LaTeX resume, bullet bank, skills and certifications once in Setup.</li>
                  <li>Paste a job description and press “Tailor my resume”.</li>
                  <li>Get the tailored .tex, a PDF, the change summary and the match score — every run is kept in History.</li>
                </ol>
              </div>
            ) : (
              <>
                <div className="rt-head">
                  <div>
                    <h2 className="h3">{rec.role}{rec.company ? ` · ${rec.company}` : ''}</h2>
                    <p className="muted rt-when">{new Date(rec.at).toLocaleString()} · {rec.durationMs} ms</p>
                  </div>
                  <ScoreCard before={rec.scoreBefore} after={rec.scoreAfter} />
                </div>
                {rec.warnings.map((w) => (
                  <Status key={w} tone="warn">
                    {w}
                  </Status>
                ))}
                <details className="rt-box" open>
                  <summary>What changed ({rec.changes.length})</summary>
                  <ul className="rt-changes">
                    {rec.changes.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </details>
                {rec.missing.length > 0 && (
                  <details className="rt-box">
                    <summary>Still missing from the job ({rec.missing.length})</summary>
                    <ul className="cat-chips kw-chips" role="list">
                      {rec.missing.map((m) => (
                        <li key={m} className="chip chip-miss">{m}</li>
                      ))}
                    </ul>
                    <p className="field-hint">Add a term to your skill bank or bullet bank only if it is true for you — the next run will use it.</p>
                  </details>
                )}
                {rec.bullets.length > 0 && (
                  <details className="rt-box">
                    <summary>Bullet lengths ({rec.bullets.filter((b) => b.status === 'ok').length}/{rec.bullets.length} in your {settings.minChars}–{settings.maxChars} character range)</summary>
                    <table className="data-table compact">
                      <thead>
                        <tr><th>Where</th><th>Chars</th><th>Bullet</th></tr>
                      </thead>
                      <tbody>
                        {rec.bullets.map((b, i) => (
                          <tr key={i}>
                            <td className="rt-where">{b.where}</td>
                            <td><span className={`score-badge is-${b.status === 'ok' ? 'good' : 'fair'}`}>{b.chars}</span></td>
                            <td>{b.fromBank && <em className="muted">bank · </em>}{b.text}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
                {current.result && current.result.certSuggestions.length > 0 && (
                  <details className="rt-box">
                    <summary>Certifications this job often asks for</summary>
                    <ul className="cat-chips" role="list">
                      {current.result.certSuggestions.map((c) => (
                        <li key={c}>
                          <button type="button" className="chip" onClick={() => setSettings((s) => ({ ...s, certs: `${s.certs.trim()}\n${c}`.trim() }))} title="Adds it to your certifications list in Setup">
                            + {c}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="field-hint">Only add a certification you hold or are actively working towards — employers check.</p>
                  </details>
                )}

                <div className="rt-views" role="tablist" aria-label="Output">
                  {(['tex', 'diff', 'preview'] as View[]).map((v) => (
                    <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'is-active' : ''} onClick={() => setView(v)}>
                      {v === 'tex' ? 'Tailored .tex' : v === 'diff' ? 'Line changes' : 'PDF & preview'}
                    </button>
                  ))}
                </div>
                {view === 'tex' && (
                  <div className="stack">
                    <div className="actions">
                      <Button variant="primary" onClick={() => downloadText(rec.tex, `${stem}.tex`, 'application/x-tex')}>
                        Download .tex
                      </Button>
                      <CopyButton text={rec.tex} label="Copy LaTeX" />
                      <Button variant="ghost" onClick={() => downloadText([`Tailored resume — ${rec.role}${rec.company ? ` at ${rec.company}` : ''}`, `Match score: ${rec.scoreBefore}% → ${rec.scoreAfter}%`, '', 'Changes:', ...rec.changes.map((c) => `- ${c}`), '', 'Still missing:', rec.missing.join(', ') || '—'].join('\n'), `${stem}-summary.txt`)}>
                        Change summary (.txt)
                      </Button>
                    </div>
                    <pre className="code-block rt-code">{rec.tex}</pre>
                    <p className="field-hint">For the exact design of your template, compile this .tex with pdfLaTeX — e.g. upload it to Overleaf. The PDF tab makes a PDF right here without LaTeX.</p>
                  </div>
                )}
                {view === 'diff' && <DiffView a={settings.baseTex} b={rec.tex} />}
                {view === 'preview' && (
                  <div className="stack">
                    {parsed ? (
                      <>
                        <CvStyleFields style={style} onChange={setStyle} />
                        <CvExports cv={parsed} style={style} />
                        <div className="actions">
                          <Button variant="ghost" onClick={() => setNote(sendToBuilder(parsed) ? { tone: 'success', text: 'Sent to the CV Builder — open it from Tools › CV & career.' } : { tone: 'error', text: 'Storage is blocked in this browser.' })}>
                            Edit in CV Builder
                          </Button>
                          <a className="btn btn-ghost" href={BUILDER_HREF}>Open CV Builder ↗</a>
                        </div>
                        <CvPreview cv={parsed} style={style} />
                        <p className="field-hint">This PDF re-lays out your tailored content in a clean UsamaVerse design (no TeX needed). Your own template’s look comes from compiling the .tex.</p>
                      </>
                    ) : (
                      <p className="empty-state">The tailored resume could not be read for a preview — the .tex download still works.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {tab === 'history' && (
        <section className="rt-history" aria-label="History">
          <div className="actions">
            <Button variant="ghost" onClick={() => downloadText(JSON.stringify(history, null, 2), 'resume-tailor-history.json', 'application/json')} disabled={!history.length}>
              Export log (.json)
            </Button>
            <Button
              variant="ghost"
              disabled={!history.length}
              onClick={() => {
                if (!window.confirm('Delete all saved runs from this browser?')) return;
                saveHistory([]);
                setHistory([]);
              }}
            >
              Clear history
            </Button>
            <span className="muted">Last {history.length} of up to 40 runs, newest first. Stored only in this browser.</span>
          </div>
          {history.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>When</th><th>Role</th><th>Company</th><th>Match</th><th>Changes</th><th /></tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className={rec?.id === h.id ? 'is-selected' : ''}>
                      <td>{new Date(h.at).toLocaleString()}</td>
                      <td>{h.role}</td>
                      <td>{h.company || '—'}</td>
                      <td>{h.scoreBefore}% → <strong>{h.scoreAfter}%</strong></td>
                      <td>{h.changes.length}</td>
                      <td>
                        <span className="actions tight">
                          <Button variant="ghost" onClick={() => { setCurrent({ record: h }); setJd(h.jd); setRole(h.role); setCompany(h.company); setTouched(true); setTab('tailor'); }}>Open</Button>
                          <Button variant="ghost" onClick={() => downloadText(h.tex, `${fileStemFor(h)}.tex`, 'application/x-tex')}>.tex</Button>
                          <button type="button" className="icon-btn danger" aria-label={`Delete run for ${h.role}`} onClick={() => { const next = history.filter((x) => x.id !== h.id); saveHistory(next); setHistory(next); }}>✕</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">No runs yet. Each tailoring run is saved here with its job description, .tex, score and changes.</p>
          )}
        </section>
      )}

      {tab === 'setup' && (
        <section className="rt-setup" aria-label="Setup">
          {!storeOk && <Status tone="warn">This browser blocks storage, so your setup is kept only until you close the page. Use “Back up setup” to keep it.</Status>}
          <div className="rt-grid">
            <div className="stack">
              <TextAreaField label="Base resume (LaTeX)" hint="Your full .tex file. It is edited in place, so your template and design stay exactly as they are." value={settings.baseTex} onChange={set('baseTex')} rows={20} />
              <div className="actions">
                <Button variant="ghost" onClick={() => fileRef.current?.click()}>Open .tex file</Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".tex,.txt,text/*"
                  className="visually-hidden-input"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) set('baseTex')(await f.text());
                  }}
                />
                <Button variant="ghost" onClick={() => set('baseTex')(defaultSettings().baseTex)}>Use sample resume</Button>
              </div>
              <TextAreaField
                label="Bullet bank — extra bullets per job"
                hint="Write [Company] on its own line, then “- bullet” lines. The app swaps these in when they fit a job better than your current bullets. Aim for your target length so all bullets come out even."
                value={settings.bulletBank}
                onChange={set('bulletBank')}
                rows={10}
                mono={false}
              />
            </div>
            <div className="stack">
              <TextAreaField label="Skill bank — skills you have but don’t always list" hint="“Group: skill, skill” per line. Group names match your resume’s skill lines (e.g. Tools). Added only when the job mentions them." value={settings.skillBank} onChange={set('skillBank')} rows={4} mono={false} />
              <TextAreaField label="Your certifications — one per line" hint="The app picks the 2–3 that best fit each job and lists them as plain titles." value={settings.certs} onChange={set('certs')} rows={5} mono={false} />
              <fieldset className="options">
                <legend>Rules</legend>
                <CheckboxField label="Reorder bullets by relevance" checked={settings.reorderBullets} onChange={set('reorderBullets')} />
                <CheckboxField label="Swap in bullets from the bank" checked={settings.useBank} onChange={set('useBank')} />
                <CheckboxField label="Reorder skills (job matches first)" checked={settings.reorderSkills} onChange={set('reorderSkills')} />
                <CheckboxField label="Add matching skills from the bank" checked={settings.addSkills} onChange={set('addSkills')} />
                <CheckboxField label="Add certifications" checked={settings.addCerts} onChange={set('addCerts')} />
                <SelectField label="How many certifications" value={String(settings.certCount)} onChange={(v) => set('certCount')(Number(v))} options={[{ value: '2', label: '2' }, { value: '3', label: '3' }]} />
                <TextField label="Bullet length from (chars)" value={String(settings.minChars)} onChange={(v) => set('minChars')(Number(v) || 0)} inputMode="numeric" hint="≈1½ lines in an 11pt one-page template is about 140–190." />
                <TextField label="to (chars)" value={String(settings.maxChars)} onChange={(v) => set('maxChars')(Number(v) || 0)} inputMode="numeric" />
              </fieldset>
              <fieldset className="options">
                <legend>Summary and headline</legend>
                <CheckboxField label="Rewrite the summary from this template" checked={settings.rewriteSummary} onChange={set('rewriteSummary')} />
                <TextField label="Years of experience" value={settings.years} onChange={set('years')} inputMode="numeric" />
                <TextAreaField label="Summary template" hint="Placeholders: {role} {company} {years} {skills} — {skills} becomes the job’s top keywords that your resume or skill bank can back up." value={settings.summaryTemplate} onChange={set('summaryTemplate')} rows={3} mono={false} />
                <CheckboxField label="Replace my headline with the job title" checked={settings.replaceHeadline} onChange={set('replaceHeadline')} />
                <TextField label="Headline text as it appears in your resume" value={settings.headline} onChange={set('headline')} placeholder="Data Analyst" />
              </fieldset>
              <div className="actions">
                <Button variant="ghost" onClick={() => downloadText(JSON.stringify(settings, null, 2), 'resume-tailor-setup.json', 'application/json')}>Back up setup (.json)</Button>
                <Button variant="ghost" onClick={() => backupRef.current?.click()}>Restore setup</Button>
                <input
                  ref={backupRef}
                  type="file"
                  accept=".json,application/json"
                  className="visually-hidden-input"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    try {
                      const { normaliseSettings } = await import('./storage');
                      setSettings(normaliseSettings(JSON.parse(await f.text())));
                      setNote({ tone: 'success', text: 'Setup restored.' });
                    } catch {
                      setNote({ tone: 'error', text: 'That file is not a Resume Tailor setup backup.' });
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!window.confirm('Reset setup to the built-in sample? Your saved base resume and banks will be replaced.')) return;
                    resetSettings();
                    setSettings(defaultSettings());
                    setHasSaved(false);
                  }}
                >
                  Reset to sample
                </Button>
              </div>
              <p className="field-hint">Everything here saves automatically in this browser as your defaults; each run only needs a new job description.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
