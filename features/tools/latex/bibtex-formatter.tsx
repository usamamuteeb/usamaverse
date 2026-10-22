'use client';

import { useMemo, useState } from 'react';
import { Button, CopyButton, DownloadTextButton, OpenTextFileButton } from '@/components/tool-kit/actions';
import { SelectField, Status, TextAreaField } from '@/components/tool-kit/fields';
import { formatEntry, parseBibtex, runsToHtml, runsToText, sortForStyle, type CiteStyle } from './bib';
import { CITE_STYLES, RichCopyButton } from './CiteShared';

const EXAMPLE = `@article{smith2020deep,
  author  = {Smith, John A. and Doe, Jane and van der Berg, Pieter},
  title   = {Deep learning for {COVID-19} detection: A systematic review},
  journal = {Journal of Medical Imaging},
  year    = {2020}, volume = {7}, number = {3}, pages = {101--115},
  doi     = {10.1117/1.JMI.7.3.031000}
}
@book{knuth1997,
  author    = {Donald E. Knuth},
  title     = {The Art of Computer Programming},
  publisher = {Addison-Wesley}, year = {1997}, edition = {3rd}
}
@inproceedings{lee2019,
  author    = {Lee, Min-Ji and Park, Joon},
  title     = {Mobile health in rural clinics},
  booktitle = {Proceedings of the CHI Conference on Human Factors in Computing Systems},
  pages     = {1--10}, publisher = {ACM}, year = {2019}
}
@misc{who2023,
  author  = {{World Health Organization}},
  title   = {Air quality guidelines},
  year    = {2023}, url = {https://www.who.int/air}, urldate = {2026-10-01}
}`;

export default function BibtexFormatter() {
  const [src, setSrc] = useState('');
  const [style, setStyle] = useState<CiteStyle>('apa');
  const [err, setErr] = useState<string | null>(null);
  const parsed = useMemo(() => (src.trim() ? parseBibtex(src) : null), [src]);
  const list = useMemo(() => (parsed ? sortForStyle(parsed.entries, style).map((e, i) => ({ key: e.key, runs: formatEntry(e, style, i + 1) })) : []), [parsed, style]);
  const html = list.map((x) => `<p>${runsToHtml(x.runs)}</p>`).join('');
  const text = list.map((x) => runsToText(x.runs)).join('\n\n');

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField label="BibTeX (.bib)" value={src} onChange={setSrc} rows={18} placeholder="@article{key, author = {…}, title = {…}, …}" />
        <div className="actions">
          <Button variant="ghost" onClick={() => setSrc(EXAMPLE)}>
            Load example
          </Button>
          <OpenTextFileButton accept=".bib,.txt,text/*" onText={(t) => { setSrc(t); setErr(null); }} onError={setErr} />
          <Button variant="ghost" onClick={() => setSrc('')}>
            Reset
          </Button>
        </div>
        {err && <Status tone="error">{err}</Status>}
      </div>
      <div className="tool-col">
        <SelectField label="Citation style" value={style} onChange={(v) => setStyle(v as CiteStyle)} options={CITE_STYLES} />
        {parsed?.errors.map((e) => (
          <Status key={e} tone="warn">
            {e}
          </Status>
        ))}
        {list.length > 0 && <p className="summary">{list.length} reference{list.length === 1 ? '' : 's'}, {style === 'ieee' ? 'numbered in file order' : 'sorted by author'}.</p>}
        <div className="cite-list" aria-live="polite">
          {list.length ? list.map((x) => <p key={x.key} className="cite-preview" dangerouslySetInnerHTML={{ __html: runsToHtml(x.runs) }} />) : <p className="empty-state">Paste BibTeX entries to format a reference list.</p>}
        </div>
        <div className="actions">
          <RichCopyButton html={html} text={text} disabled={!list.length} />
          <CopyButton text={text} label="Copy as plain text" />
          <DownloadTextButton text={text} filename={`references-${style}.txt`} />
        </div>
        <p className="field-hint">Titles are kept as written, except APA, which uses sentence case — protect proper nouns with braces in BibTeX, e.g. {'{'}Sindh{'}'}. Always check references against your style guide.</p>
      </div>
    </div>
  );
}
