'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { latexToMarkdownDoc, markdownToPlain } from './latex-parse';

const options: OptionDef[] = [
  { type: 'select', key: 'to', label: 'Convert to', default: 'markdown', choices: [{ value: 'markdown', label: 'Markdown (keeps $math$, tables, links)' }, { value: 'text', label: 'Plain text' }] },
];

const EXAMPLE = String.raw`\documentclass{article}
\newcommand{\term}[1]{\textbf{#1}}
\title{Notes on Sorting}
\author{A. Student}
\begin{document}
\maketitle
\section{Introduction}
Sorting puts items in order. \term{Merge sort} runs in $O(n \log n)$ time~\cite{knuth1997}.
\subsection{Algorithms}
\begin{itemize}
  \item \emph{Insertion sort} --- simple, good for small inputs.
  \item \textbf{Quicksort}, fast on average.
\end{itemize}
\begin{table}[h]
\centering
\begin{tabular}{lr}
\toprule
Algorithm & Average \\ \midrule
Merge sort & $n \log n$ \\
Insertion sort & $n^2$ \\
\bottomrule
\end{tabular}
\caption{Running times}
\end{table}
\begin{equation}
T(n) = 2T(n/2) + O(n)
\end{equation}
See \href{https://en.wikipedia.org/wiki/Sorting_algorithm}{Wikipedia} for more.
\end{document}`;

export default function LatexToMarkdown() {
  return (
    <TransformTool
      inputLabel="LaTeX source"
      placeholder={'\\section{Introduction}\nPaste LaTeX here…'}
      example={EXAMPLE}
      options={options}
      filename="converted.md"
      mime="text/markdown"
      transform={(t, v) => {
        const doc = latexToMarkdownDoc(t, { mode: 'doc' });
        const out = str(v.to) === 'text' ? markdownToPlain(doc.markdown) : doc.markdown;
        return { output: out + '\n', warning: doc.warnings.join(' ') || undefined, summary: `${(doc.markdown.match(/^#{1,6} /gm) ?? []).length} headings · ${out.split(/\s+/).filter(Boolean).length} words` };
      }}
    />
  );
}
