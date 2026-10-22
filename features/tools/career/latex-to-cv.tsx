'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { SelectField, Status, TextAreaField } from '@/components/tool-kit/fields';
import { OutputPanel } from '@/components/tool-kit/output';
import { parseCv, writeCv, type CvOutputFormat } from './cv-convert';
import { CvPreview } from './CvPreview';
import { CvExports, CvStyleFields } from './CvExports';
import { defaultCvStyle, type CvStyle } from './cv-pdf';
import { BUILDER_HREF, fileStem, sendToBuilder } from './cv-storage';
import { CvFilePicker } from './CvFilePicker';

const EXAMPLE = String.raw`\documentclass[letterpaper,11pt]{article}
\usepackage[hidelinks]{hyperref}
\newcommand{\resumeItem}[1]{\item\small{#1}}
\newcommand{\resumeSubheading}[4]{\item
  \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
    \textbf{#1} & #2 \\ \textit{\small#3} & \textit{\small #4} \\
  \end{tabular*}}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}}
\begin{document}
\begin{center}
  \textbf{\Huge \scshape Hina Qureshi} \\ \vspace{1pt}
  \small +92 321 555 0147 $|$ \href{mailto:hina@example.com}{\underline{hina@example.com}} $|$
  \href{https://linkedin.com/in/hinaq}{\underline{linkedin.com/in/hinaq}} $|$
  \href{https://github.com/hinaq}{\underline{github.com/hinaq}}
\end{center}

\section{Education}
\resumeSubHeadingListStart
  \resumeSubheading{LUMS}{Lahore, Pakistan}{BS Computer Science; CGPA 3.6}{Sep. 2019 -- Jun. 2023}
\resumeSubHeadingListEnd

\section{Experience}
\resumeSubHeadingListStart
  \resumeSubheading{Software Engineer}{Jul. 2023 -- Present}{Cedar Fintech}{Karachi, Pakistan}
  \resumeItemListStart
    \resumeItem{Built a payments reconciliation service in Go processing 2M records a day}
    \resumeItem{Cut CI time by 35\% by caching Docker layers}
  \resumeItemListEnd
\resumeSubHeadingListEnd

\section{Technical Skills}
\begin{itemize}[leftmargin=0.15in, label={}]
  \small{\item{
    \textbf{Languages}{: Go, Python, TypeScript, SQL} \\
    \textbf{Tools}{: Docker, Kubernetes, PostgreSQL, Git}
  }}
\end{itemize}
\end{document}`;

const OUTPUTS: Array<{ value: CvOutputFormat; label: string; ext: string; mime: string }> = [
  { value: 'markdown', label: 'Markdown', ext: 'md', mime: 'text/markdown' },
  { value: 'text', label: 'Plain text', ext: 'txt', mime: 'text/plain' },
  { value: 'json', label: 'JSON Resume', ext: 'json', mime: 'application/json' },
  { value: 'html', label: 'Web page (HTML)', ext: 'html', mime: 'text/html' },
];

export default function LatexToCv() {
  const [src, setSrc] = useState('');
  const [out, setOut] = useState<CvOutputFormat>('markdown');
  const [style, setStyle] = useState<CvStyle>(defaultCvStyle);
  const [sent, setSent] = useState<null | boolean>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const result = useMemo(() => {
    if (!src.trim()) return null;
    try {
      return { ...parseCv(src, 'latex'), error: null as string | null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e), cv: null, warnings: [] as string[] };
    }
  }, [src]);
  const cv = result?.cv ?? null;
  const fmt = OUTPUTS.find((o) => o.value === out)!;
  const text = useMemo(() => (cv ? writeCv(cv, out) : ''), [cv, out]);
  const entries = cv?.sections.reduce((n, s) => n + s.entries.length, 0) ?? 0;

  return (
    <div className="stack">
      <div className="tool-grid">
        <div className="tool-col">
          <TextAreaField label="LaTeX CV source" hint="Works with Jake’s resume, moderncv, awesome-cv, resume.cls and most hand-written article CVs. Nothing is compiled or uploaded." value={src} onChange={(v) => { setSrc(v); setSent(null); }} rows={18} placeholder={'\\documentclass{article}\n\\begin{document}\n…\n\\end{document}'} />
          <div className="actions">
            <Button variant="ghost" onClick={() => setSrc(EXAMPLE)}>
              Load example
            </Button>
            <CvFilePicker label="Open .tex file" accept=".tex,.txt,text/*" onText={(t) => { setSrc(t); setFileError(null); }} onError={setFileError} />
            <Button variant="ghost" onClick={() => setSrc('')}>
              Reset
            </Button>
          </div>
          {fileError && <Status tone="error">{fileError}</Status>}
        </div>
        <div className="tool-col">
          {result?.error && <Status tone="error">{result.error}</Status>}
          {result?.warnings.map((w) => (
            <Status key={w} tone="warn">
              {w}
            </Status>
          ))}
          {cv && (
            <p className="summary">
              Found <strong>{cv.basics.name || 'no name'}</strong>, {cv.sections.length} sections and {entries} entries: {cv.sections.map((s) => s.heading).join(', ') || '—'}.
            </p>
          )}
          <SelectField label="Convert to" value={out} onChange={(v) => setOut(v as CvOutputFormat)} options={OUTPUTS.map(({ value, label }) => ({ value, label }))} />
          <OutputPanel label={`${fmt.label} output`} value={text} filename={cv ? `${fileStem(cv)}.${fmt.ext}` : `cv.${fmt.ext}`} mime={fmt.mime} rows={14} />
          {cv && (
            <div className="actions">
              <Button onClick={() => setSent(sendToBuilder(cv))}>Send to CV Builder</Button>
              {sent && (
                <Link className="btn btn-ghost" href={BUILDER_HREF}>
                  Open CV Builder →
                </Link>
              )}
            </div>
          )}
          {sent === false && <Status tone="error">This browser blocked local storage, so the CV could not be handed over. Download the JSON instead and import it in the builder.</Status>}
          {sent && <Status tone="success">Saved as your CV Builder draft in this browser — edit it there.</Status>}
        </div>
      </div>
      {cv && (
        <div className="cv-builder-grid cv-convert-preview">
          <div className="stack no-print">
            <CvStyleFields style={style} onChange={setStyle} />
            <CvExports cv={cv} style={style} />
          </div>
          <CvPreview cv={cv} style={style} />
        </div>
      )}
    </div>
  );
}
