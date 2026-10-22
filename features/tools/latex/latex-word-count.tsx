'use client';

import { useMemo, useState } from 'react';
import { Button, OpenTextFileButton } from '@/components/tool-kit/actions';
import { Status, TextAreaField } from '@/components/tool-kit/fields';
import { latexWordCount } from './latex-tools';

const EXAMPLE = String.raw`\documentclass{article}
\begin{document}
\section{Introduction}
Large language models are trained on text~\cite{a,b}. We measure how the loss $L$ changes with data size.\footnote{All runs use the same seed.}
\begin{figure}[h]\centering\includegraphics{loss.png}\caption{Training loss over time}\end{figure}
\begin{equation} L(D) = A D^{-\alpha} \end{equation}
\section{Results}
The fitted exponent is $\alpha \approx 0.1$, matching earlier work~\cite{c}.
\end{document}`;

export default function LatexWordCount() {
  const [src, setSrc] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const c = useMemo(() => (src.trim() ? latexWordCount(src) : null), [src]);
  const minutes = c ? Math.max(1, Math.round((c.words + c.headingWords) / 230)) : 0;
  const stats: Array<[string, string | number]> = c
    ? [
        ['Words in text', c.words],
        ['Words in headings', c.headingWords],
        ['Words in captions', c.captionWords],
        ['Total words', c.words + c.headingWords + c.captionWords],
        ['Headings', c.headings],
        ['Inline math', c.inlineMath],
        ['Display equations', c.displayMath],
        ['Figures', c.figures],
        ['Tables', c.tables],
        ['Citations', c.citations],
        ['Footnotes', c.footnotes],
        ['Reading time', `~${minutes} min`],
      ]
    : [];
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField label="LaTeX source" value={src} onChange={setSrc} rows={16} placeholder="Paste a .tex file…" />
        <div className="actions">
          <Button variant="ghost" onClick={() => setSrc(EXAMPLE)}>
            Load example
          </Button>
          <OpenTextFileButton accept=".tex,.txt,text/*" onText={(t) => { setSrc(t); setErr(null); }} onError={setErr} />
          <Button variant="ghost" onClick={() => setSrc('')}>
            Reset
          </Button>
        </div>
        {err && <Status tone="error">{err}</Status>}
      </div>
      <div className="tool-col">
        {c ? (
          <dl className="stat-grid">
            {stats.map(([k, v]) => (
              <div className="stat" key={k}>
                <dt>{k}</dt>
                <dd>{typeof v === 'number' ? v.toLocaleString() : v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="empty-state">Paste LaTeX to count words the way a reader sees them.</p>
        )}
        <p className="field-hint">Commands, comments, the preamble and math are not counted as words; macros defined with \newcommand are expanded first. Results are close to texcount’s defaults but can differ for unusual packages.</p>
      </div>
    </div>
  );
}
