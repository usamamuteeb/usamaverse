'use client';

import { useEffect, useState } from 'react';
import { Button, CopyButton, DownloadTextButton } from '@/components/tool-kit/actions';
import { SelectField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { downloadBlob } from '@/lib/tools/shared/download';
import { coverLetter, type LetterFields, type LetterTone } from './job-logic';
import { loadDraft } from './cv-storage';
import { printPlainText } from './cv-print';

const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const EMPTY: LetterFields = { name: '', email: '', phone: '', location: '', date: '', company: '', manager: '', role: '', source: '', years: '', skills: '', achievement: '', motivation: '', tone: 'professional' };

const EXAMPLE: LetterFields = {
  name: 'Aisha Khan',
  email: 'aisha.khan@example.com',
  phone: '+49 151 2345 6789',
  location: 'Berlin, Germany',
  date: '',
  company: 'Lumen Health',
  manager: 'Ms. Weber',
  role: 'Senior Frontend Engineer',
  source: 'LinkedIn',
  years: '6',
  skills: 'React, TypeScript, accessibility, design systems',
  achievement: 'I led the rebuild of a customer dashboard that cut load time by 48% and halved support tickets',
  motivation: 'you are making medical records easier for patients to understand',
  tone: 'professional',
};

export default function CoverLetterGenerator() {
  const [f, setF] = useState<LetterFields>(EMPTY);
  const [letter, setLetter] = useState('');
  const [edited, setEdited] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof LetterFields>(k: K) => (v: LetterFields[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => setF((x) => (x.date ? x : { ...x, date: today() })), []);
  useEffect(() => {
    setLetter(coverLetter(f));
    setEdited(false);
  }, [f]);

  const fromCv = () => {
    const cv = loadDraft();
    if (!cv) {
      setMsg('No CV Builder draft was found in this browser.');
      return;
    }
    const b = cv.basics;
    const skills = cv.sections.find((s) => s.kind === 'skills')?.skills.map((g) => g.items).join(', ') ?? '';
    const firstJob = cv.sections.find((s) => s.kind === 'entries' && /experience|work|employment/i.test(s.heading))?.entries[0];
    setF((x) => ({ ...x, name: b.name, email: b.email, phone: b.phone, location: b.location, skills: skills.split(/\s*,\s*/).slice(0, 4).join(', ') || x.skills, achievement: x.achievement || firstJob?.bullets[0] || '' }));
    setMsg('Filled from your CV Builder draft.');
  };

  const stem = `cover-letter-${(f.company || 'draft').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div className="actions">
          <Button variant="ghost" onClick={() => setF({ ...EXAMPLE, date: today() })}>
            Load example
          </Button>
          <Button variant="ghost" onClick={fromCv}>
            Fill from my CV draft
          </Button>
          <Button variant="ghost" onClick={() => setF({ ...EMPTY, date: today() })}>
            Reset
          </Button>
        </div>
        {msg && <Status tone="info">{msg}</Status>}
        <fieldset className="options">
          <legend>The job</legend>
          <TextField label="Job title" value={f.role} onChange={set('role')} placeholder="Marketing Coordinator" />
          <TextField label="Company" value={f.company} onChange={set('company')} />
          <TextField label="Hiring manager (optional)" value={f.manager} onChange={set('manager')} placeholder="Hiring Manager" />
          <TextField label="Where you saw it (optional)" value={f.source} onChange={set('source')} placeholder="LinkedIn" />
          <SelectField label="Tone" value={f.tone} onChange={(v) => set('tone')(v as LetterTone)} options={[{ value: 'professional', label: 'Professional' }, { value: 'enthusiastic', label: 'Enthusiastic' }, { value: 'concise', label: 'Short and direct' }]} />
        </fieldset>
        <fieldset className="options">
          <legend>About you</legend>
          <TextField label="Your name" value={f.name} onChange={set('name')} />
          <TextField label="Email" value={f.email} onChange={set('email')} />
          <TextField label="Phone" value={f.phone} onChange={set('phone')} />
          <TextField label="City" value={f.location} onChange={set('location')} />
          <TextField label="Years of experience" value={f.years} onChange={set('years')} inputMode="numeric" />
          <TextField label="Date" value={f.date} onChange={set('date')} />
        </fieldset>
        <TextField label="Top skills for this job (comma separated)" value={f.skills} onChange={set('skills')} placeholder="Excel, campaign planning, copywriting" />
        <TextAreaField label="Your best result (one sentence)" mono={false} rows={2} value={f.achievement} onChange={set('achievement')} placeholder="I grew newsletter sign-ups by 35% in six months" />
        <TextAreaField label="Why this company? (optional)" mono={false} rows={2} value={f.motivation} onChange={set('motivation')} placeholder="your products help small shops sell online" />
      </div>
      <div className="tool-col">
        <div className="output-head">
          <span className="field-label">Your letter</span>
          <div className="actions">
            <CopyButton text={letter} />
            <DownloadTextButton text={letter} filename={`${stem}.txt`} label=".txt" />
            <Button
              onClick={async () => {
                const { textToDocx } = await import('./cv-docx');
                downloadBlob(await textToDocx(letter, 'Cover letter'), `${stem}.docx`);
              }}
            >
              Word
            </Button>
            <Button onClick={() => printPlainText('Cover letter', letter)}>Print / PDF</Button>
          </div>
        </div>
        <TextAreaField label="Edit the letter freely" mono={false} rows={26} value={letter} onChange={(v) => { setLetter(v); setEdited(true); }} />
        <p className="field-hint">{edited ? 'You edited the letter — changing a field on the left rebuilds it.' : 'Built from fixed templates with your words — nothing is generated by AI or sent anywhere. Read it through and make it yours.'}</p>
      </div>
    </div>
  );
}
