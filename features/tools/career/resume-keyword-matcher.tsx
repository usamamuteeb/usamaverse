'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { SelectField, Status, TextAreaField } from '@/components/tool-kit/fields';
import { matchKeywords } from './job-logic';
import { loadDraft } from './cv-storage';
import { cvToPlainText } from './cv-text';
import { CvFilePicker } from './CvFilePicker';
import { parseCv } from './cv-convert';
import { sampleCv } from './cv-model';

const EXAMPLE_JD = `Senior Frontend Engineer — Lumen Health (Berlin, hybrid)

What you will do
- Build accessible, fast interfaces in React and TypeScript for our patient app.
- Own our design system and Storybook component library.
- Work with product and design to ship features every two weeks.
- Write unit and end-to-end tests (Jest, Playwright) and improve CI/CD pipelines.

What we look for
- 5+ years of frontend experience with React, TypeScript and Next.js.
- Strong knowledge of web accessibility (WCAG) and performance optimization.
- Experience with GraphQL, Node.js and design systems.
- Mentoring other engineers; excellent communication skills in English (German is a plus).`;

export default function ResumeKeywordMatcher() {
  const [cv, setCv] = useState('');
  const [jd, setJd] = useState('');
  const [max, setMax] = useState('40');
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const r = useMemo(() => (cv.trim() && jd.trim() ? matchKeywords(cv, jd, Number(max)) : null), [cv, jd, max]);
  const verdict = !r ? '' : r.score >= 75 ? 'Strong match' : r.score >= 50 ? 'Decent match — add the missing terms you genuinely have' : 'Weak match — tailor your CV to this job';

  return (
    <div className="stack">
      <div className="tool-grid">
        <div className="tool-col">
          <TextAreaField label="Job description" value={jd} onChange={setJd} rows={12} mono={false} placeholder="Paste the full job posting…" />
          <div className="actions">
            <Button
              variant="ghost"
              onClick={() => {
                setJd(EXAMPLE_JD);
                setCv(cvToPlainText(sampleCv()));
              }}
            >
              Load example
            </Button>
            <Button variant="ghost" onClick={() => { setJd(''); setCv(''); }}>
              Reset
            </Button>
          </div>
        </div>
        <div className="tool-col">
          <TextAreaField label="Your CV" value={cv} onChange={setCv} rows={12} mono={false} placeholder="Paste your CV text, open a file, or use your CV Builder draft…" />
          <div className="actions">
            <CvFilePicker
              label="Open CV (PDF, Word, text)"
              onText={(t, fmt) => {
                setCv(fmt === 'latex' || fmt === 'json' ? cvToPlainText(parseCv(t, fmt).cv) : t);
                setNote(null);
              }}
              onError={(m) => setNote({ tone: 'error', text: m })}
            />
            <Button
              variant="ghost"
              onClick={() => {
                const d = loadDraft();
                if (d) setCv(cvToPlainText(d));
                else setNote({ tone: 'info', text: 'No CV Builder draft was found in this browser.' });
              }}
            >
              Use my CV draft
            </Button>
          </div>
          {note && <Status tone={note.tone}>{note.text}</Status>}
        </div>
      </div>
      {r ? (
        <section className="kw-results" aria-live="polite">
          <div className="kw-head">
            <div className="big-result">
              <span className="big-result-label">Keyword match</span>
              <span className="big-result-value">{r.score}%</span>
              <span className="big-result-label">{verdict}</span>
            </div>
            <SelectField label="Keywords to compare" value={max} onChange={setMax} options={[{ value: '20', label: 'Top 20' }, { value: '40', label: 'Top 40' }, { value: '60', label: 'Top 60' }]} />
          </div>
          <div className="tool-grid">
            <div>
              <h3 className="h3">Missing from your CV ({r.missing.length})</h3>
              {r.missing.length ? (
                <ul className="cat-chips kw-chips" role="list">
                  {r.missing.map((k) => (
                    <li key={k.term} className="chip chip-miss" title={`Mentioned ${k.count}× in the job description`}>
                      {k.term} <span className="count">×{k.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nothing important is missing.</p>
              )}
            </div>
            <div>
              <h3 className="h3">Found in your CV ({r.matched.length})</h3>
              <ul className="cat-chips kw-chips" role="list">
                {r.matched.map((k) => (
                  <li key={k.term} className="chip chip-ok" title={`${k.count}× in the job, ${k.inCv}× in your CV`}>
                    ✓ {k.term} <span className="count">×{k.inCv}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="field-hint">Keywords are ranked by how often and how prominently the posting uses them (phrases and product names count more). Only add skills you really have — and use the posting’s exact wording, since many applicant-tracking systems match words literally.</p>
        </section>
      ) : (
        <p className="empty-state">Paste a job description and your CV to see which keywords match.</p>
      )}
    </div>
  );
}
