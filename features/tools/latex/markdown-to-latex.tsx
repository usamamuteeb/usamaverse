'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { markdownToLatex, type MdToLatexOptions } from './latex-tools';

const options: OptionDef[] = [
  { type: 'checkbox', key: 'full', label: 'Full document (preamble + \\begin{document})', default: true },
  { type: 'checkbox', key: 'title', label: 'Use the first # heading as the title', default: true },
  { type: 'select', key: 'cls', label: 'Document class', default: 'article', choices: [{ value: 'article', label: 'article (## → \\section)' }, { value: 'report', label: 'report (## → \\chapter)' }] },
  { type: 'select', key: 'tables', label: 'Tables', default: 'booktabs', choices: [{ value: 'booktabs', label: 'booktabs rules' }, { value: 'grid', label: 'Grid lines' }] },
  { type: 'select', key: 'code', label: 'Code blocks', default: 'verbatim', choices: [{ value: 'verbatim', label: 'verbatim' }, { value: 'lstlisting', label: 'listings (with language)' }] },
];

const EXAMPLE = `# Project Report

This report covers **results** from the *pilot*, including costs (about 15% under budget) and the formula $E = mc^2$.

## Findings

1. Uptime improved to 99.9%.
2. Support tickets fell by a third.

| Metric | Before | After |
|:-------|-------:|------:|
| Uptime | 98.1% | 99.9% |
| Tickets | 120 | 80 |

> Measure first, then optimise.

\`\`\`python
print("done")
\`\`\`

See [the dashboard](https://example.com/dashboard) for details.`;

export default function MarkdownToLatex() {
  return (
    <TransformTool
      inputLabel="Markdown"
      placeholder="# Title&#10;&#10;Write or paste Markdown…"
      example={EXAMPLE}
      options={options}
      outputLabel="LaTeX"
      filename="document.tex"
      mime="application/x-tex"
      transform={(t, v) => {
        const o: MdToLatexOptions = { fullDocument: bool(v.full), titleFromH1: bool(v.title), docClass: str(v.cls) as MdToLatexOptions['docClass'], tables: str(v.tables) as MdToLatexOptions['tables'], code: str(v.code) as MdToLatexOptions['code'] };
        const r = markdownToLatex(t, o);
        return { output: r.latex, warning: r.warnings.join(' ') || undefined };
      }}
    />
  );
}
