'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { emptyCv, emptyEntry, newSection, sampleCv, defaultKind, type CvBasics, type CvData, type CvEntry, type CvSection, type CvSectionKind } from './cv-model';
import { CvPreview } from './CvPreview';
import { CvExports, CvStyleFields } from './CvExports';
import { defaultCvStyle, type CvStyle } from './cv-pdf';
import { clearDraft, loadDraft, rememberPref, saveDraft, setRememberPref } from './cv-storage';
import { parseCv } from './cv-convert';
import { CV_FILE_ACCEPT, readCvFile } from './cv-import';

const KINDS = [
  { value: 'entries', label: 'Entries (jobs, degrees, projects)' },
  { value: 'skills', label: 'Skill groups' },
  { value: 'list', label: 'Simple list' },
  { value: 'text', label: 'Paragraph' },
];

const QUICK_SECTIONS = ['Experience', 'Education', 'Projects', 'Skills', 'Certifications', 'Languages', 'Awards', 'Volunteering', 'Publications', 'Interests'];

function starter(): CvData {
  const cv = emptyCv();
  const exp = newSection('Experience', 'entries');
  exp.entries = [emptyEntry()];
  const edu = newSection('Education', 'entries');
  edu.entries = [emptyEntry()];
  const sk = newSection('Skills', 'skills');
  sk.skills = [{ name: '', items: '' }];
  cv.sections = [exp, edu, sk];
  return cv;
}

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function EntryEditor({ e, onChange, onRemove, onMove, index, count, kindHint }: { e: CvEntry; onChange: (e: CvEntry) => void; onRemove: () => void; onMove: (d: number) => void; index: number; count: number; kindHint: string }) {
  const set = <K extends keyof CvEntry>(k: K, v: CvEntry[K]) => onChange({ ...e, [k]: v });
  const edu = /educat|academ|qualif/i.test(kindHint);
  const proj = /project/i.test(kindHint);
  return (
    <div className="cv-edit-entry">
      <div className="cv-edit-entry-head">
        <strong>{e.title || e.org || `Entry ${index + 1}`}</strong>
        <span className="actions tight">
          <button type="button" className="icon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move entry up">
            ↑
          </button>
          <button type="button" className="icon-btn" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move entry down">
            ↓
          </button>
          <button type="button" className="icon-btn danger" onClick={onRemove} aria-label="Remove entry">
            ✕
          </button>
        </span>
      </div>
      <div className="form-grid">
        <TextField label={edu ? 'Degree / qualification' : proj ? 'Project name' : 'Job title'} value={e.title} onChange={(v) => set('title', v)} />
        <TextField label={edu ? 'School / university' : proj ? 'Tech stack or role' : 'Company / organisation'} value={e.org} onChange={(v) => set('org', v)} />
        <TextField label="Location" value={e.location} onChange={(v) => set('location', v)} />
        <TextField label="Start" placeholder="Jan 2022" value={e.start} onChange={(v) => set('start', v)} />
        <TextField label="End" placeholder="Present" value={e.end} onChange={(v) => set('end', v)} />
        <TextField label={edu ? 'Grade / GPA (optional)' : 'One-line note (optional)'} value={e.details} onChange={(v) => set('details', v)} />
        <TextField label="Link (optional)" type="url" placeholder="github.com/you/project" value={e.url} onChange={(v) => set('url', v)} />
      </div>
      <TextAreaField
        label="Bullet points — one per line"
        mono={false}
        rows={Math.min(8, Math.max(3, e.bullets.length + 1))}
        placeholder={'Led … resulting in …\nBuilt … used by …'}
        value={e.bullets.join('\n')}
        onChange={(v) => set('bullets', v.split('\n').map((x) => x.replace(/^\s*[-•*]\s+/, '')))}
      />
    </div>
  );
}

function SectionEditor({ s, onChange, onRemove, onMove, index, count }: { s: CvSection; onChange: (s: CvSection) => void; onRemove: () => void; onMove: (d: number) => void; index: number; count: number }) {
  const set = <K extends keyof CvSection>(k: K, v: CvSection[K]) => onChange({ ...s, [k]: v });
  return (
    <details className="cv-edit-sec" open>
      <summary>
        <span className="cv-edit-sec-title">{s.heading || 'Untitled section'}</span>
        <span className="count">{s.kind === 'entries' ? `${s.entries.length} entr${s.entries.length === 1 ? 'y' : 'ies'}` : KINDS.find((k) => k.value === s.kind)?.label.split(' ')[0]}</span>
      </summary>
      <div className="cv-edit-sec-body">
        <div className="cv-edit-sec-bar">
          <TextField label="Section heading" value={s.heading} onChange={(v) => set('heading', v)} />
          <SelectField label="Layout" value={s.kind} onChange={(v) => onChange({ ...s, kind: v as CvSectionKind, entries: s.entries.length || v !== 'entries' ? s.entries : [emptyEntry()], skills: s.skills.length || v !== 'skills' ? s.skills : [{ name: '', items: '' }] })} options={KINDS} />
          <span className="actions tight">
            <button type="button" className="icon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${s.heading} up`}>
              ↑
            </button>
            <button type="button" className="icon-btn" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${s.heading} down`}>
              ↓
            </button>
            <button type="button" className="icon-btn danger" onClick={onRemove} aria-label={`Remove ${s.heading}`}>
              ✕
            </button>
          </span>
        </div>
        {s.kind === 'entries' && (
          <>
            {s.entries.map((e, i) => (
              <EntryEditor
                key={i}
                e={e}
                index={i}
                count={s.entries.length}
                kindHint={s.heading}
                onChange={(ne) => set('entries', s.entries.map((x, j) => (j === i ? ne : x)))}
                onRemove={() => set('entries', s.entries.filter((_, j) => j !== i))}
                onMove={(d) => set('entries', move(s.entries, i, d))}
              />
            ))}
            <Button variant="ghost" onClick={() => set('entries', [...s.entries, emptyEntry()])}>
              + Add entry
            </Button>
          </>
        )}
        {s.kind === 'skills' && (
          <>
            {s.skills.map((g, i) => (
              <div className="cv-edit-skill" key={i}>
                <TextField label="Group" placeholder="Languages" value={g.name} onChange={(v) => set('skills', s.skills.map((x, j) => (j === i ? { ...x, name: v } : x)))} />
                <TextField label="Skills (comma separated)" placeholder="Python, SQL, Excel" value={g.items} onChange={(v) => set('skills', s.skills.map((x, j) => (j === i ? { ...x, items: v } : x)))} />
                <button type="button" className="icon-btn danger" onClick={() => set('skills', s.skills.filter((_, j) => j !== i))} aria-label="Remove skill group">
                  ✕
                </button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => set('skills', [...s.skills, { name: '', items: '' }])}>
              + Add skill group
            </Button>
          </>
        )}
        {s.kind === 'list' && <TextAreaField label="Items — one per line" mono={false} rows={4} value={s.items.join('\n')} onChange={(v) => set('items', v.split('\n'))} />}
        {s.kind === 'text' && <TextAreaField label="Text" mono={false} rows={4} value={s.text} onChange={(v) => set('text', v)} />}
      </div>
    </details>
  );
}

function BasicsEditor({ b, onChange }: { b: CvBasics; onChange: (b: CvBasics) => void }) {
  const set = (k: keyof CvBasics) => (v: string) => onChange({ ...b, [k]: v });
  return (
    <details className="cv-edit-sec" open>
      <summary>
        <span className="cv-edit-sec-title">Personal details</span>
      </summary>
      <div className="cv-edit-sec-body">
        <div className="form-grid">
          <TextField label="Full name" value={b.name} onChange={set('name')} />
          <TextField label="Headline / job title" placeholder="Data Analyst" value={b.label} onChange={set('label')} />
          <TextField label="Email" value={b.email} onChange={set('email')} />
          <TextField label="Phone" value={b.phone} onChange={set('phone')} />
          <TextField label="City, country" value={b.location} onChange={set('location')} />
          <TextField label="Website" placeholder="yourname.dev" value={b.website} onChange={set('website')} />
          <TextField label="LinkedIn" placeholder="linkedin.com/in/you" value={b.linkedin} onChange={set('linkedin')} />
          <TextField label="GitHub" placeholder="github.com/you" value={b.github} onChange={set('github')} />
        </div>
        <TextAreaField label="Professional summary" mono={false} rows={3} value={b.summary} onChange={set('summary')} hint="2–3 sentences: who you are, your strongest skills and what you want next." />
      </div>
    </details>
  );
}

export default function CvBuilder() {
  const [cv, setCv] = useState<CvData>(starter);
  const [style, setStyle] = useState<CvStyle>(defaultCvStyle);
  const [remember, setRemember] = useState(false);
  const [note, setNote] = useState<{ tone: 'error' | 'warn' | 'success' | 'info'; text: string } | null>(null);
  const [newHeading, setNewHeading] = useState('');
  const loaded = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pref = rememberPref();
    setRemember(pref);
    const d = pref ? loadDraft() : null;
    if (d) {
      setCv(d);
      setNote({ tone: 'info', text: 'Your saved draft was restored from this browser.' });
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current || !remember) return;
    const t = setTimeout(() => saveDraft(cv), 400);
    return () => clearTimeout(t);
  }, [cv, remember]);

  const updateSection = (i: number, s: CvSection) => setCv((c) => ({ ...c, sections: c.sections.map((x, j) => (j === i ? s : x)) }));
  const addSection = (heading: string) => {
    const h = heading.trim() || 'New section';
    const kind = defaultKind(h);
    const s = newSection(h, kind);
    if (kind === 'entries') s.entries = [emptyEntry()];
    if (kind === 'skills') s.skills = [{ name: '', items: '' }];
    setCv((c) => ({ ...c, sections: [...c.sections, s] }));
    setNewHeading('');
  };

  const importFile = async (f: File) => {
    try {
      const { text, format, note: n } = await readCvFile(f);
      const r = parseCv(text, format);
      setCv(r.cv);
      setNote({ tone: r.warnings.length ? 'warn' : 'success', text: [`Imported ${f.name} (${r.format === 'latex' ? 'LaTeX' : r.format === 'json' ? 'JSON' : r.format === 'markdown' ? 'Markdown' : 'text'}).`, n, ...r.warnings, 'Please check every field — imports are best effort.'].filter(Boolean).join(' ') });
    } catch (e) {
      setNote({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const used = new Set(cv.sections.map((s) => s.heading.toLowerCase()));

  return (
    <div className="cv-builder">
      <div className="cv-builder-bar no-print">
        <Button variant="ghost" onClick={() => setCv(sampleCv())}>
          Load example
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          Import CV (PDF, Word, LaTeX…)
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={CV_FILE_ACCEPT}
          className="visually-hidden-input"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void importFile(f);
          }}
        />
        <Button
          variant="ghost"
          onClick={() => {
            setCv(starter());
            clearDraft();
            setNote({ tone: 'info', text: 'Started a blank CV and removed the saved draft.' });
          }}
        >
          Start over
        </Button>
        <CheckboxField
          label="Remember my draft in this browser"
          checked={remember}
          onChange={(v) => {
            setRemember(v);
            setRememberPref(v);
            if (!v) clearDraft();
            else saveDraft(cv);
          }}
        />
      </div>
      {note && <Status tone={note.tone}>{note.text}</Status>}
      <div className="cv-builder-grid">
        <div className="cv-editor no-print">
          <BasicsEditor b={cv.basics} onChange={(b) => setCv((c) => ({ ...c, basics: b }))} />
          {cv.sections.map((s, i) => (
            <SectionEditor
              key={s.id}
              s={s}
              index={i}
              count={cv.sections.length}
              onChange={(ns) => updateSection(i, ns)}
              onRemove={() => setCv((c) => ({ ...c, sections: c.sections.filter((_, j) => j !== i) }))}
              onMove={(d) => setCv((c) => ({ ...c, sections: move(c.sections, i, d) }))}
            />
          ))}
          <div className="cv-add-sec">
            <p className="field-label">Add a section</p>
            <ul className="cat-chips" role="list">
              {QUICK_SECTIONS.filter((h) => !used.has(h.toLowerCase())).map((h) => (
                <li key={h}>
                  <button type="button" className="chip" onClick={() => addSection(h)}>
                    + {h}
                  </button>
                </li>
              ))}
            </ul>
            <div className="cv-add-custom">
              <TextField label="Custom section" placeholder="e.g. Research, Leadership" value={newHeading} onChange={setNewHeading} />
              <Button onClick={() => addSection(newHeading)} disabled={!newHeading.trim()}>
                Add
              </Button>
            </div>
          </div>
        </div>
        <div className="cv-side">
          <CvStyleFields style={style} onChange={setStyle} />
          <CvExports cv={cv} style={style} />
          <CvPreview cv={cv} style={style} />
        </div>
      </div>
    </div>
  );
}
