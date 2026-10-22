'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { Status, TextAreaField } from '@/components/tool-kit/fields';
import { bulletLines, checkBullet } from './job-logic';
import { loadDraft } from './cv-storage';

const EXAMPLE = `- Responsible for managing the company website and social media accounts
- Led a team of 5 to rebuild checkout, lifting conversion by 12% in one quarter
- I worked on many different projects with various teams
- Reports were created weekly for senior managers
- Cut cloud costs by $18k a year by right-sizing 40 servers
- Hard-working team player with great communication skills`;

function tone(score: number) {
  return score >= 80 ? 'good' : score >= 55 ? 'fair' : 'weak';
}

export default function ResumeBulletChecker() {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const results = useMemo(() => bulletLines(text).map(checkBullet), [text]);
  const avg = results.length ? Math.round(results.reduce((n, r) => n + r.score, 0) / results.length) : 0;
  const withNum = results.filter((r) => r.good.some((g) => g.startsWith('Has a number'))).length;
  const withVerb = results.filter((r) => r.good.includes('Starts with an action verb')).length;

  return (
    <div className="stack">
      <div className="tool-grid">
        <div className="tool-col">
          <TextAreaField label="CV bullet points" hint="One per line. Headings, dates and contact lines are skipped." value={text} onChange={setText} rows={10} mono={false} placeholder="- Led …&#10;- Built …" />
          <div className="actions">
            <Button variant="ghost" onClick={() => setText(EXAMPLE)}>
              Load example
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                const d = loadDraft();
                const lines = d?.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).filter(Boolean) ?? [];
                if (lines.length) {
                  setText(lines.map((l) => `- ${l}`).join('\n'));
                  setMsg(null);
                } else setMsg('No bullet points were found in a CV Builder draft in this browser.');
              }}
            >
              Use my CV draft
            </Button>
            <Button variant="ghost" onClick={() => setText('')}>
              Reset
            </Button>
          </div>
          {msg && <Status tone="info">{msg}</Status>}
        </div>
        <div className="tool-col">
          {results.length ? (
            <dl className="stat-grid">
              <div className="stat">
                <dt>Average score</dt>
                <dd>{avg}/100</dd>
              </div>
              <div className="stat">
                <dt>Bullets checked</dt>
                <dd>{results.length}</dd>
              </div>
              <div className="stat">
                <dt>With numbers</dt>
                <dd>
                  {withNum}/{results.length}
                </dd>
              </div>
              <div className="stat">
                <dt>Action-verb start</dt>
                <dd>
                  {withVerb}/{results.length}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="empty-state">Paste bullet points to check them.</p>
          )}
          <p className="field-hint">Strong bullets start with an action verb, show a measurable result, stay under ~30 words and skip “I”, passive voice and buzzwords. These are style rules, not a guarantee — some good bullets break them on purpose.</p>
        </div>
      </div>
      {results.length > 0 && (
        <ol className="bullet-results">
          {results.map((r, i) => (
            <li key={i} className={`bullet-card is-${tone(r.score)}`}>
              <div className="bullet-card-head">
                <span className={`score-badge is-${tone(r.score)}`}>{r.score}</span>
                <p>{r.text}</p>
              </div>
              {(r.issues.length > 0 || r.good.length > 0) && (
                <ul className="bullet-notes">
                  {r.issues.map((x, j) => (
                    <li key={`i${j}`} className="note-bad">
                      <span aria-hidden="true">✕</span> {x}
                      {r.tips[j] && <em> — {r.tips[j]}</em>}
                    </li>
                  ))}
                  {r.good.map((x) => (
                    <li key={x} className="note-good">
                      <span aria-hidden="true">✓</span> {x}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
