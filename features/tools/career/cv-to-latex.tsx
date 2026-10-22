'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { SelectField, Status, TextAreaField } from '@/components/tool-kit/fields';
import { OutputPanel } from '@/components/tool-kit/output';
import { parseCv, type CvInputFormat } from './cv-convert';
import { cvToLatex, ACCENTS, type AccentName, type LatexOptions, defaultLatexOptions } from './cv-latex';
import { cvToMarkdown } from './cv-text';
import { sampleCv } from './cv-model';
import { loadDraft } from './cv-storage';
import { CvFilePicker as FilePicker } from './CvFilePicker';

const FORMATS = [
  { value: 'auto', label: 'Detect automatically' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'text', label: 'Plain text (copied from PDF / Word)' },
  { value: 'json', label: 'JSON Resume' },
];

export default function CvToLatex() {
  const [src, setSrc] = useState('');
  const [format, setFormat] = useState<CvInputFormat>('auto');
  const [opts, setOpts] = useState<LatexOptions>(defaultLatexOptions);
  const [note, setNote] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => setHasDraft(Boolean(loadDraft())), []);

  const result = useMemo(() => {
    if (!src.trim()) return null;
    try {
      const r = parseCv(src, format);
      return { ...r, tex: cvToLatex(r.cv, opts), error: null as string | null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e), tex: '', warnings: [], cv: null, format: 'text' as const };
    }
  }, [src, format, opts]);

  const set = <K extends keyof LatexOptions>(k: K, v: LatexOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));
  const sections = result?.cv?.sections ?? [];

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField
          label="Your CV"
          hint="Paste Markdown, plain text copied from a PDF or Word CV, or JSON Resume — or open a .pdf / .docx file."
          value={src}
          onChange={(v) => {
            setSrc(v);
            setNote(null);
          }}
          rows={16}
          mono
          placeholder={'# Your Name\nData Analyst\nyou@example.com · +44 7700 900123 · London\n\n## Experience\n### Analyst — Acme\n*London · 2021 – Present*\n- Built dashboards used by 40 managers'}
        />
        <div className="actions">
          <Button variant="ghost" onClick={() => setSrc(cvToMarkdown(sampleCv()))}>
            Load example
          </Button>
          {hasDraft && (
            <Button
              variant="ghost"
              onClick={() => {
                const d = loadDraft();
                if (d) setSrc(cvToMarkdown(d));
              }}
            >
              Use my CV Builder draft
            </Button>
          )}
          <FilePicker
            label="Open CV file (PDF, Word, text)"
            onText={(t, f, n) => {
              setSrc(t);
              setFormat(f === 'latex' ? 'auto' : f);
              setNote(n ?? null);
              setFileError(null);
            }}
            onError={setFileError}
          />
          <Button variant="ghost" onClick={() => setSrc('')}>
            Reset
          </Button>
        </div>
        {fileError && <Status tone="error">{fileError}</Status>}
        {note && <Status tone="info">{note}</Status>}
        <fieldset className="options">
          <legend>LaTeX options</legend>
          <SelectField label="Input format" value={format} onChange={(v) => setFormat(v as CvInputFormat)} options={FORMATS} />
          <SelectField
            label="Template"
            value={opts.template}
            onChange={(v) => set('template', v as LatexOptions['template'])}
            options={[
              { value: 'classic', label: 'Classic (article, coloured rules)' },
              { value: 'compact', label: 'Compact one-page (ATS-friendly)' },
              { value: 'moderncv', label: 'moderncv class' },
            ]}
          />
          <SelectField label="Accent colour" value={opts.accent} onChange={(v) => set('accent', v as AccentName)} options={(Object.keys(ACCENTS) as AccentName[]).map((k) => ({ value: k, label: ACCENTS[k].label }))} />
          <SelectField label="Paper" value={opts.paper} onChange={(v) => set('paper', v as LatexOptions['paper'])} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }]} />
          <SelectField label="Font size" value={opts.fontSize} onChange={(v) => set('fontSize', v as LatexOptions['fontSize'])} options={[{ value: '10', label: '10 pt' }, { value: '11', label: '11 pt' }, { value: '12', label: '12 pt' }]} />
        </fieldset>
      </div>
      <div className="tool-col">
        {result?.error && <Status tone="error">{result.error}</Status>}
        {result?.warnings.map((w) => (
          <Status key={w} tone="warn">
            {w}
          </Status>
        ))}
        {result?.cv && (
          <p className="summary">
            Read as <strong>{result.format === 'json' ? 'JSON Resume' : result.format === 'markdown' ? 'Markdown' : 'plain text'}</strong>: {result.cv.basics.name || 'no name'} · {sections.length} section{sections.length === 1 ? '' : 's'} ({sections.map((s) => s.heading).join(', ') || 'none'}).
          </p>
        )}
        <OutputPanel label="LaTeX source (.tex)" value={result?.tex ?? ''} filename={`${(result?.cv?.basics.name || 'cv').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.tex`} mime="application/x-tex" rows={22} />
        <p className="field-hint">
          Compile with pdfLaTeX, XeLaTeX or LuaLaTeX — for example upload the .tex file to Overleaf (New project → Upload). The moderncv template needs the moderncv class, which Overleaf and TeX Live include.
        </p>
      </div>
    </div>
  );
}
