import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToLatex, inlineToLatex, gridToLatex, latexWordCount } from '@/features/tools/latex/latex-tools';
import { latexToMarkdownDoc, markdownToPlain } from '@/features/tools/latex/latex-parse';
import { parseBibtex, formatEntry, runsToText, toBibtex, makeKey, parseNames } from '@/features/tools/latex/bib';
import { SYMBOLS } from '@/features/tools/latex/symbols';

test('inline Markdown becomes escaped LaTeX', () => {
  assert.equal(inlineToLatex('**bold** and *it* with `a_b` and $x_1$ costs 5% & #1'), '\\textbf{bold} and \\emph{it} with \\texttt{a\\_b} and $x_1$ costs 5\\% \\& \\#1');
  assert.equal(inlineToLatex('[site](https://x.io/a%20b)'), '\\href{https://x.io/a\\%20b}{site}');
  assert.equal(inlineToLatex('snake_case_name stays'), 'snake\\_case\\_name stays');
});

test('Markdown blocks: headings, lists, tables, code, quotes, math', () => {
  const { latex } = markdownToLatex('# Title\n\n## Part\n\n- a\n  - b\n1. one\n\n| x | y |\n|:-|-:|\n| 1 | 2 |\n\n```\ncode\n```\n\n> quote\n\n$$\nE=mc^2\n$$', { fullDocument: true, docClass: 'article', titleFromH1: true, tables: 'booktabs', code: 'verbatim' });
  assert.match(latex, /\\title\{Title\}/);
  assert.match(latex, /\\section\{Part\}/);
  assert.match(latex, /\\begin\{itemize\}\n {2}\\item a\n {2}\\begin\{itemize\}\n {4}\\item b\n {2}\\end\{itemize\}\n\\end\{itemize\}\n\\begin\{enumerate\}/);
  assert.match(latex, /\\begin\{tabular\}\{lr\}/);
  assert.match(latex, /\\toprule[\s\S]*\\midrule[\s\S]*\\bottomrule/);
  assert.match(latex, /\\begin\{verbatim\}\ncode\n\\end\{verbatim\}/);
  assert.match(latex, /\\begin\{quote\}\nquote\n\\end\{quote\}/);
  assert.match(latex, /\\\[\nE=mc\^2\n\\\]/);
  assert.ok(!latex.includes('ulem'));
  const body = markdownToLatex('## A', { fullDocument: false, docClass: 'report', titleFromH1: false, tables: 'grid', code: 'verbatim' }).latex;
  assert.equal(body.trim(), '\\section{A}');
});

test('LaTeX documents convert to Markdown and text', () => {
  const src = String.raw`\documentclass{article}
\newcommand{\term}[1]{\textbf{#1}}
\title{Notes}
\begin{document}
\maketitle
\section{Intro}
A \term{key} idea in $O(n)$ time~\cite{k1,k2}.\footnote{Really.}
\begin{enumerate}\item first\item second\end{enumerate}
\begin{tabular}{ll} a & b \\ c & d \\ \end{tabular}
\end{document}`;
  const md = latexToMarkdownDoc(src, { mode: 'doc' }).markdown;
  assert.match(md, /^# Notes/);
  assert.match(md, /## Intro/);
  assert.match(md, /A \*\*key\*\* idea in \$O\(n\)\$ time \[k1, k2\]\. ?\(Really\.\)/);
  assert.match(md, /1\. first\n2\. second/);
  assert.match(md, /\| a \| b \|\n\| --- \| --- \|\n\| c \| d \|/);
  assert.match(markdownToPlain(md), /^NOTES/);
});

test('tables from a grid', () => {
  const t = gridToLatex([['Name', 'Value'], ['A&B', '50%']], { header: true, aligns: ['l', 'r'], style: 'grid', float: false });
  assert.match(t, /\\begin\{tabular\}\{\|l\|r\|\}/);
  assert.ok(t.includes('A\\&B & 50\\% \\\\'));
  assert.equal((t.match(/\\hline/g) ?? []).length, 3);
});

test('word count ignores commands, preamble and math', () => {
  const c = latexWordCount(String.raw`\documentclass{article}\usepackage{amsmath}
\begin{document}
\section{Two words}
One two three $x+y$ four.\footnote{five}
\begin{figure}\caption{Six seven}\end{figure}
\begin{equation}a=b\end{equation}
\end{document}`);
  assert.equal(c.headingWords, 2);
  assert.equal(c.captionWords, 2);
  assert.equal(c.words, 5);
  assert.equal(c.inlineMath, 1);
  assert.equal(c.displayMath, 1);
  assert.equal(c.footnotes, 1);
});

test('BibTeX parsing, names and keys', () => {
  const { entries, errors } = parseBibtex('@string{jmi = "J. Med. Imaging"}\n@article{a1, author = {van der Berg, Pieter and Jane Doe and {World Health Organization}}, title = "On {NASA} data", journal = jmi, year = 2020, pages = {1--9}}');
  assert.deepEqual(errors, []);
  assert.equal(entries[0].fields.journal, 'J. Med. Imaging');
  assert.deepEqual(parseNames(entries[0].fields.author), [{ last: 'van der Berg', first: 'Pieter' }, { first: 'Jane', last: 'Doe' }, { first: '', last: 'World Health Organization', corporate: true }]);
  assert.equal(makeKey(entries[0]), 'vanderberg2020nasa');
  assert.match(toBibtex(entries[0]), /^@article\{a1,\n {2}author {2}= \{/);
  assert.ok(parseBibtex('@article{x, title = {open').errors.length > 0);
});

test('reference styles', () => {
  const [e] = parseBibtex('@article{s, author = {Smith, John A. and Doe, Jane}, title = {Deep learning for {COVID-19} detection}, journal = {Journal of Imaging}, year = {2020}, volume = {7}, number = {3}, pages = {101--115}, doi = {10.1/abc}}').entries;
  assert.equal(runsToText(formatEntry(e, 'apa')), 'Smith, J. A., & Doe, J. (2020). Deep learning for COVID-19 detection. Journal of Imaging, 7(3), 101–115. https://doi.org/10.1/abc');
  assert.equal(runsToText(formatEntry(e, 'ieee', 4)), '[4] J. A. Smith and J. Doe, “Deep learning for COVID-19 detection,” Journal of Imaging, vol. 7, no. 3, pp. 101–115, 2020, doi: 10.1/abc.');
  assert.match(runsToText(formatEntry(e, 'mla')), /^Smith, John A\., and Jane Doe\. “Deep learning for COVID-19 detection\.” Journal of Imaging, vol\. 7, no\. 3, 2020, pp\. 101–115\./);
  assert.match(runsToText(formatEntry(e, 'harvard')), /^Smith, J\.A\. and Doe, J\. \(2020\) ‘Deep learning/);
  assert.match(runsToText(formatEntry(e, 'chicago')), /^Smith, John A\., and Jane Doe\. 2020\./);
  assert.ok(formatEntry(e, 'apa').some((r) => r.i && r.t === 'Journal of Imaging'));
});

test('symbol table is complete', () => {
  assert.ok(SYMBOLS.length > 200);
  for (const s of SYMBOLS) assert.ok(s.cmd && s.char && s.name, JSON.stringify(s));
  assert.equal(new Set(SYMBOLS.map((s) => s.group + s.cmd)).size, SYMBOLS.length);
});
