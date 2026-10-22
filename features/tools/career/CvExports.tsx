'use client';

import { useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { SelectField, Status } from '@/components/tool-kit/fields';
import { downloadBlob, downloadText } from '@/lib/tools/shared/download';
import { writeCv, type CvOutputFormat } from './cv-convert';
import { ACCENTS, type AccentName, type LatexTemplate } from './cv-latex';
import type { CvData } from './cv-model';
import { cvToPdf, type CvStyle } from './cv-pdf';
import { fileStem } from './cv-storage';
import { printCvPreview } from './cv-print';

export const ACCENT_CHOICES = [
  { value: '#b3263e', label: 'Crimson' },
  { value: '#1f4e9a', label: 'Blue' },
  { value: '#2e7d32', label: 'Green' },
  { value: '#5e35b1', label: 'Purple' },
  { value: '#c75000', label: 'Orange' },
  { value: '#4a4a4a', label: 'Grey' },
  { value: '#111111', label: 'Black' },
];

/** Picks the LaTeX accent closest to the chosen hex color. */
export function accentName(hex: string): AccentName {
  const found = (Object.keys(ACCENTS) as AccentName[]).find((k) => `#${ACCENTS[k].hex}`.toLowerCase() === hex.toLowerCase());
  return found ?? 'crimson';
}

export function CvStyleFields({ style, onChange }: { style: CvStyle; onChange: (s: CvStyle) => void }) {
  const set = <K extends keyof CvStyle>(k: K, v: CvStyle[K]) => onChange({ ...style, [k]: v });
  return (
    <fieldset className="options cv-style">
      <legend>Look</legend>
      <SelectField label="Font" value={style.font} onChange={(v) => set('font', v as CvStyle['font'])} options={[{ value: 'serif', label: 'Serif' }, { value: 'sans', label: 'Sans-serif' }]} />
      <SelectField label="Accent" value={style.accent} onChange={(v) => set('accent', v)} options={ACCENT_CHOICES} />
      <SelectField label="Header" value={style.align} onChange={(v) => set('align', v as CvStyle['align'])} options={[{ value: 'center', label: 'Centered' }, { value: 'left', label: 'Left aligned' }]} />
      <SelectField label="Spacing" value={style.density} onChange={(v) => set('density', v as CvStyle['density'])} options={[{ value: 'normal', label: 'Comfortable' }, { value: 'compact', label: 'Compact (fit one page)' }]} />
      <SelectField label="Paper" value={style.paper} onChange={(v) => set('paper', v as CvStyle['paper'])} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }]} />
    </fieldset>
  );
}

type TextExport = `latex-${LatexTemplate}` | Exclude<CvOutputFormat, 'latex'>;
const TEXT_EXPORTS: Array<{ value: TextExport; label: string; ext: string; mime: string }> = [
  { value: 'latex-classic', label: 'LaTeX — Classic (.tex)', ext: 'tex', mime: 'application/x-tex' },
  { value: 'latex-compact', label: 'LaTeX — Compact one-page (.tex)', ext: 'tex', mime: 'application/x-tex' },
  { value: 'latex-moderncv', label: 'LaTeX — moderncv (.tex)', ext: 'tex', mime: 'application/x-tex' },
  { value: 'markdown', label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown' },
  { value: 'text', label: 'Plain text (.txt)', ext: 'txt', mime: 'text/plain' },
  { value: 'json', label: 'JSON Resume (.json)', ext: 'json', mime: 'application/json' },
  { value: 'cvjson', label: 'UsamaVerse CV data (.json)', ext: 'json', mime: 'application/json' },
  { value: 'html', label: 'Web page (.html)', ext: 'html', mime: 'text/html' },
];

export function exportText(cv: CvData, kind: TextExport, style: CvStyle): string {
  if (kind.startsWith('latex-')) return writeCv(cv, 'latex', { template: kind.slice(6) as LatexTemplate, paper: style.paper, accent: accentName(style.accent), fontSize: style.density === 'compact' ? '10' : '11' });
  return writeCv(cv, kind as CvOutputFormat);
}

export function CvExports({ cv, style, disabled }: { cv: CvData; style: CvStyle; disabled?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'error' | 'warn' | 'success'; text: string } | null>(null);
  const [kind, setKind] = useState<TextExport>('latex-classic');
  const stem = fileStem(cv);
  const fmt = TEXT_EXPORTS.find((t) => t.value === kind)!;

  const pdf = async () => {
    setBusy('pdf');
    setMsg(null);
    try {
      const r = await cvToPdf(cv, style);
      downloadBlob(new Blob([r.bytes as BlobPart], { type: 'application/pdf' }), `${stem}.pdf`);
      if (r.missing.length) setMsg({ tone: 'warn', text: `The PDF fonts cannot show ${r.missing.slice(0, 8).join(' ')} — they appear as “?”. Use “Print / Save as PDF” for those characters.` });
      else setMsg({ tone: 'success', text: `${stem}.pdf saved (${r.pages} page${r.pages === 1 ? '' : 's'}).` });
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };
  const docx = async () => {
    setBusy('docx');
    setMsg(null);
    try {
      const { cvToDocx } = await import('./cv-docx');
      downloadBlob(await cvToDocx(cv, style), `${stem}.docx`);
      setMsg({ tone: 'success', text: `${stem}.docx saved.` });
    } catch (e) {
      setMsg({ tone: 'error', text: `The Word file could not be created (${e instanceof Error ? e.message : String(e)}).` });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="cv-exports no-print">
      <div className="actions">
        <Button variant="primary" onClick={() => void pdf()} disabled={disabled || busy !== null}>
          {busy === 'pdf' ? 'Making PDF…' : 'Download PDF'}
        </Button>
        <Button onClick={() => void docx()} disabled={disabled || busy !== null}>
          {busy === 'docx' ? 'Making Word file…' : 'Word (.docx)'}
        </Button>
        <Button variant="ghost" onClick={() => printCvPreview(style) || setMsg({ tone: 'error', text: 'There is no preview to print yet.' })} disabled={disabled}>
          Print / Save as PDF
        </Button>
      </div>
      <div className="cv-export-more">
        <SelectField label="Other formats" value={kind} onChange={(v) => setKind(v as TextExport)} options={TEXT_EXPORTS.map(({ value, label }) => ({ value, label }))} />
        <div className="actions">
          <Button onClick={() => downloadText(exportText(cv, kind, style), `${stem}.${fmt.ext}`, fmt.mime)} disabled={disabled}>
            Download
          </Button>
          <CopyButton text={disabled ? '' : exportText(cv, kind, style)} />
        </div>
      </div>
      {msg && <Status tone={msg.tone}>{msg.text}</Status>}
    </div>
  );
}
