'use client';

import { useMemo, useState } from 'react';
import { Button, CopyButton, DownloadTextButton } from '@/components/tool-kit/actions';
import { SelectField, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { formatEntry, makeKey, runsToHtml, runsToText, toBibtex, type BibEntry, type CiteStyle } from './bib';
import { CITE_STYLES, RichCopyButton } from './CiteShared';

type Kind = 'article' | 'book' | 'inproceedings' | 'phdthesis' | 'mastersthesis' | 'misc';
const KINDS: Array<{ value: Kind; label: string }> = [
  { value: 'article', label: 'Journal article' },
  { value: 'book', label: 'Book' },
  { value: 'inproceedings', label: 'Conference paper' },
  { value: 'phdthesis', label: 'PhD thesis' },
  { value: 'mastersthesis', label: 'Master’s thesis' },
  { value: 'misc', label: 'Website / other' },
];

interface Form {
  authors: string;
  title: string;
  year: string;
  container: string;
  publisher: string;
  volume: string;
  number: string;
  pages: string;
  edition: string;
  doi: string;
  url: string;
  urldate: string;
  key: string;
}
const EMPTY: Form = { authors: '', title: '', year: '', container: '', publisher: '', volume: '', number: '', pages: '', edition: '', doi: '', url: '', urldate: '', key: '' };

/** "Jane Q. Doe" or "Doe, Jane Q." per line → BibTeX "Doe, Jane Q. and …". Organisations in {braces} are kept. */
export function authorsToBib(text: string): string {
  return text
    .split(/\n|;/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      if (/^\{.*\}$/.test(a) || a.includes(',')) return a;
      const parts = a.split(/\s+/);
      if (parts.length === 1) return a;
      let k = parts.length - 1;
      while (k > 1 && /^(van|von|der|de|da|di|del|la|le|bin|al)$/i.test(parts[k - 1])) k--;
      return `${parts.slice(k).join(' ')}, ${parts.slice(0, k).join(' ')}`;
    })
    .join(' and ');
}

export default function BibtexGenerator() {
  const [kind, setKind] = useState<Kind>('article');
  const [f, setF] = useState<Form>(EMPTY);
  const [style, setStyle] = useState<CiteStyle>('apa');
  const set = (k: keyof Form) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const entry: BibEntry = useMemo(() => {
    const fields: Record<string, string> = { author: authorsToBib(f.authors), title: f.title, year: f.year, volume: f.volume, number: f.number, pages: f.pages.replace(/\s*[-–—]\s*/, '--'), doi: f.doi.replace(/^https?:\/\/doi\.org\//, ''), url: f.url, urldate: f.urldate };
    if (kind === 'article') fields.journal = f.container;
    if (kind === 'inproceedings') fields.booktitle = f.container;
    if (kind === 'book' || kind === 'inproceedings') fields.publisher = f.publisher;
    if (kind === 'book') fields.edition = f.edition;
    if (kind === 'phdthesis' || kind === 'mastersthesis') fields.school = f.publisher;
    if (kind === 'misc') fields.howpublished = f.container;
    const e = { type: kind, key: '', fields };
    return { ...e, key: f.key.trim() || makeKey(e) };
  }, [f, kind]);
  const filled = Boolean(f.title.trim() || f.authors.trim());
  const bib = filled ? toBibtex(entry) : '';
  const runs = filled ? formatEntry(entry, style) : [];

  const containerLabel = kind === 'article' ? 'Journal' : kind === 'inproceedings' ? 'Conference / proceedings title' : kind === 'misc' ? 'Website or publisher name' : '';
  const publisherLabel = kind === 'book' || kind === 'inproceedings' ? 'Publisher' : kind === 'phdthesis' || kind === 'mastersthesis' ? 'University' : '';

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div className="actions">
          <Button variant="ghost" onClick={() => { setKind('article'); setF({ ...EMPTY, authors: 'John A. Smith\nJane Doe', title: 'Deep learning for {COVID-19} detection: A systematic review', year: '2020', container: 'Journal of Medical Imaging', volume: '7', number: '3', pages: '101-115', doi: '10.1117/1.JMI.7.3.031000' }); }}>
            Load example
          </Button>
          <Button variant="ghost" onClick={() => setF(EMPTY)}>
            Reset
          </Button>
        </div>
        <fieldset className="options">
          <legend>Source</legend>
          <SelectField label="Type" value={kind} onChange={(v) => setKind(v as Kind)} options={KINDS} />
          <TextField label="Year" value={f.year} onChange={set('year')} inputMode="numeric" />
          <TextField label="Citation key (optional)" value={f.key} onChange={set('key')} placeholder={makeKey(entry)} />
        </fieldset>
        <TextAreaField label="Authors — one per line" hint="“First Last” or “Last, First”. Put organisations in {braces}." mono={false} rows={3} value={f.authors} onChange={set('authors')} />
        <TextField label="Title" value={f.title} onChange={set('title')} hint="Wrap words that must keep capitals in {braces}, e.g. {NASA}." />
        <fieldset className="options">
          <legend>Details</legend>
          {containerLabel && <TextField label={containerLabel} value={f.container} onChange={set('container')} />}
          {publisherLabel && <TextField label={publisherLabel} value={f.publisher} onChange={set('publisher')} />}
          {kind === 'article' && <TextField label="Volume" value={f.volume} onChange={set('volume')} />}
          {kind === 'article' && <TextField label="Issue" value={f.number} onChange={set('number')} />}
          {(kind === 'article' || kind === 'inproceedings') && <TextField label="Pages" value={f.pages} onChange={set('pages')} placeholder="101-115" />}
          {kind === 'book' && <TextField label="Edition" value={f.edition} onChange={set('edition')} placeholder="2nd" />}
          <TextField label="DOI" value={f.doi} onChange={set('doi')} placeholder="10.1000/xyz123" />
          <TextField label="URL" value={f.url} onChange={set('url')} />
          {kind === 'misc' && <TextField label="Accessed on" type="date" value={f.urldate} onChange={set('urldate')} />}
        </fieldset>
      </div>
      <div className="tool-col">
        <div className="output-head">
          <span className="field-label">BibTeX</span>
          <div className="actions">
            <CopyButton text={bib} />
            <DownloadTextButton text={bib} filename={`${entry.key}.bib`} mime="application/x-bibtex" />
          </div>
        </div>
        <pre className="code-block">{bib || 'Fill in the form to build a BibTeX entry.'}</pre>
        <SelectField label="Formatted reference" value={style} onChange={(v) => setStyle(v as CiteStyle)} options={CITE_STYLES} />
        <p className="cite-preview" dangerouslySetInnerHTML={{ __html: runs.length ? runsToHtml(runs) : '—' }} />
        <div className="actions">
          <RichCopyButton html={runsToHtml(runs)} text={runsToText(runs)} disabled={!runs.length} />
          <CopyButton text={runsToText(runs)} label="Copy as plain text" />
        </div>
      </div>
    </div>
  );
}
