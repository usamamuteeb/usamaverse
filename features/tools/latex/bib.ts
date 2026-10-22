/**
 * BibTeX reading/writing and reference formatting (APA 7, MLA 9, Chicago
 * author-date, Harvard and IEEE). Output is a list of styled runs so the UI can
 * show italics and copy both rich text and plain text.
 */
import { latexUnescape } from './escape';

export type BibType = 'article' | 'book' | 'inproceedings' | 'incollection' | 'phdthesis' | 'mastersthesis' | 'techreport' | 'misc' | 'online';

export interface BibEntry {
  type: string;
  key: string;
  fields: Record<string, string>;
}

export interface Person {
  first: string;
  last: string;
  /** Organisation names like {World Health Organization} keep their braces. */
  corporate?: boolean;
}

/* ---------------------------------------------------------------- parsing */

export function parseBibtex(src: string): { entries: BibEntry[]; errors: string[] } {
  const entries: BibEntry[] = [];
  const errors: string[] = [];
  const strings: Record<string, string> = { jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June', jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December' };
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf('@', i);
    if (at < 0) break;
    const m = /^@\s*([A-Za-z]+)\s*([{(])/.exec(src.slice(at));
    if (!m) {
      i = at + 1;
      continue;
    }
    const type = m[1].toLowerCase();
    const open = m[2];
    const close = open === '{' ? '}' : ')';
    const j = at + m[0].length;
    // find the end of the entry by brace depth
    let depth = 1;
    let k = j;
    let inQuote = false;
    for (; k < src.length && depth > 0; k++) {
      const c = src[k];
      if (c === '\\') {
        k++;
        continue;
      }
      if (c === '"' && depth === 1) inQuote = !inQuote;
      else if (!inQuote && (c === '{' || (c === '(' && open === '('))) depth++;
      else if (!inQuote && (c === '}' || (c === ')' && open === '('))) depth--;
    }
    const body = src.slice(j, k - 1);
    i = k;
    if (depth !== 0) {
      errors.push(`An @${type} entry is not closed with “${close}”.`);
      break;
    }
    if (type === 'comment' || type === 'preamble') continue;
    if (type === 'string') {
      const sm = /^\s*([\w-]+)\s*=\s*([{"])([\s\S]*)[}"]\s*$/.exec(body);
      if (sm) strings[sm[1].toLowerCase()] = sm[3];
      continue;
    }
    const comma = body.indexOf(',');
    const key = (comma < 0 ? body : body.slice(0, comma)).trim();
    const fields: Record<string, string> = {};
    let p = comma < 0 ? body.length : comma + 1;
    while (p < body.length) {
      const fm = /^\s*([\w:.+-]+)\s*=\s*/.exec(body.slice(p));
      if (!fm) {
        if (body.slice(p).trim()) errors.push(`Could not read part of “${key}”: ${body.slice(p, p + 30).trim()}…`);
        break;
      }
      const name = fm[1].toLowerCase();
      p += fm[0].length;
      const parts: string[] = [];
      for (;;) {
        while (/\s/.test(body[p] ?? '')) p++;
        const c = body[p];
        if (c === '{') {
          let d = 0;
          let q = p;
          for (; q < body.length; q++) {
            if (body[q] === '\\') {
              q++;
              continue;
            }
            if (body[q] === '{') d++;
            else if (body[q] === '}' && --d === 0) break;
          }
          parts.push(body.slice(p + 1, q));
          p = q + 1;
        } else if (c === '"') {
          let q = p + 1;
          let d = 0;
          for (; q < body.length; q++) {
            if (body[q] === '\\') {
              q++;
              continue;
            }
            if (body[q] === '{') d++;
            else if (body[q] === '}') d--;
            else if (body[q] === '"' && d === 0) break;
          }
          parts.push(body.slice(p + 1, q));
          p = q + 1;
        } else {
          const w = /^[\w-]+/.exec(body.slice(p));
          if (!w) break;
          parts.push(strings[w[0].toLowerCase()] ?? w[0]);
          p += w[0].length;
        }
        while (/\s/.test(body[p] ?? '')) p++;
        if (body[p] === '#') {
          p++;
          continue;
        }
        break;
      }
      fields[name] = parts.join('').replace(/\s+/g, ' ').trim();
      while (/[\s,]/.test(body[p] ?? '')) p++;
    }
    entries.push({ type, key, fields });
  }
  if (!entries.length && !errors.length && src.trim()) errors.push('No @type{key, …} entries were found.');
  return { entries, errors };
}

/* ---------------------------------------------------------------- names */

/** Removes BibTeX braces and common LaTeX accents/commands from a field value. */
export function bibText(s: string): string {
  return latexUnescape(
    s
      .replace(/\\(?:textit|textbf|emph|textsc|textrm|mathrm|text)\{([^{}]*)\}/g, '$1')
      .replace(/\\(['`"^~=.])\{?([A-Za-z])\}?/g, (_m, a: string, l: string) => (l + ({ "'": '́', '`': '̀', '"': '̈', '^': '̂', '~': '̃', '=': '̄', '.': '̇' } as Record<string, string>)[a]).normalize('NFC'))
      .replace(/\\c\{?c\}?/g, 'ç')
      .replace(/\\ss\b\{?\}?/g, 'ß')
      .replace(/---/g, '—')
      .replace(/--/g, '–')
      .replace(/[{}]/g, ''),
  ).trim();
}

function splitTopLevel(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  const words = s.split(/(\s+)/);
  for (const w of words) {
    for (const c of w) depth += c === '{' ? 1 : c === '}' ? -1 : 0;
    if (depth === 0 && sep.test(w)) {
      out.push(cur.trim());
      cur = '';
    } else cur += w;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function parseNames(field: string): Person[] {
  if (!field.trim()) return [];
  return splitTopLevel(field, /^and$/i)
    .filter(Boolean)
    .map((raw) => {
      if (/^\{[\s\S]*\}$/.test(raw.trim())) return { first: '', last: bibText(raw), corporate: true };
      if (raw.toLowerCase() === 'others') return { first: '', last: 'others' };
      const commaIdx = raw.indexOf(',');
      if (commaIdx >= 0 && !/^\{/.test(raw)) {
        const [last, ...rest] = raw.split(',');
        return { last: bibText(last), first: bibText(rest.join(',').trim()) };
      }
      const words = raw.split(/\s+/);
      // "von" particles stay with the last name
      let k = words.length - 1;
      while (k > 1 && /^[a-z]/.test(words[k - 1])) k--;
      return { first: bibText(words.slice(0, k).join(' ')), last: bibText(words.slice(k).join(' ')) };
    });
}

const initials = (first: string, withSpace = true) =>
  first
    .split(/[\s]+/)
    .filter(Boolean)
    .map((w) => w.split('-').map((p) => `${p[0].toUpperCase()}.`).join('-'))
    .join(withSpace ? ' ' : '');

/* ---------------------------------------------------------------- building */

export function makeKey(e: { fields: Record<string, string> }): string {
  const first = parseNames(e.fields.author ?? e.fields.editor ?? '')[0];
  const last = (first?.last ?? 'anon').normalize('NFKD').replace(/[^\w]/g, '').toLowerCase().slice(0, 20) || 'anon';
  const year = (e.fields.year ?? '').replace(/\D/g, '').slice(0, 4) || 'nd';
  const word = bibText(e.fields.title ?? '')
    .toLowerCase()
    .split(/\s+/)
    .find((w) => w.length > 3 && !['the', 'and', 'with', 'from', 'into', 'about', 'what', 'when', 'this', 'that', 'towards'].includes(w))
    ?.replace(/[^a-z0-9]/g, '');
  return `${last}${year}${word ?? ''}`;
}

const ORDER = ['author', 'editor', 'title', 'journal', 'booktitle', 'publisher', 'school', 'institution', 'year', 'month', 'volume', 'number', 'pages', 'edition', 'address', 'doi', 'isbn', 'url', 'urldate', 'note'];

export function toBibtex(e: BibEntry): string {
  const keys = Object.keys(e.fields).filter((k) => e.fields[k]?.trim());
  keys.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  const w = Math.max(0, ...keys.map((k) => k.length));
  const lines = keys.map((k) => `  ${k.padEnd(w)} = {${e.fields[k].trim().replace(/[{}]/g, (c) => c)}}`);
  return `@${e.type}{${e.key || makeKey(e)},\n${lines.join(',\n')}\n}\n`;
}

/* ---------------------------------------------------------------- formatting */

export type CiteStyle = 'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee';
export type Run = { t: string; i?: boolean };

const F = (e: BibEntry, k: string) => bibText(e.fields[k] ?? '');
const end = (s: string) => (!s ? '' : /[.?!]$/.test(s) ? s : `${s}.`);
const pages = (p: string) => p.replace(/\s*-+\s*/g, '–');
const doiUrl = (d: string) => (!d ? '' : /^https?:/.test(d) ? d : `https://doi.org/${d.replace(/^doi:\s*/i, '')}`);

function sentenceCase(title: string, raw: string): string {
  // Keep words that were protected with braces in BibTeX (e.g. {NASA}, {COVID}).
  const protectedWords = new Set([...raw.matchAll(/\{([^{}]+)\}/g)].map((m) => bibText(m[1])));
  return title
    .split(/(\s+)/)
    .map((w, i) => {
      if (i === 0 || /^\s+$/.test(w) || protectedWords.has(w.replace(/[^\p{L}\p{N}]/gu, '')) || /[A-Z].*[A-Z]/.test(w.slice(1)) || /\d/.test(w)) return w;
      const prev = title.split(/(\s+)/).slice(0, i).join('').trim();
      return /[:?!.]$/.test(prev) ? w : w.toLowerCase();
    })
    .join('');
}

function apaNames(ps: Person[]): string {
  const n = ps.map((p) => (p.corporate || !p.first ? p.last : `${p.last}, ${initials(p.first)}`));
  if (!n.length) return '';
  if (n.length === 1) return n[0];
  if (n.length <= 20) return `${n.slice(0, -1).join(', ')}, & ${n[n.length - 1]}`;
  return `${n.slice(0, 19).join(', ')}, … ${n[n.length - 1]}`;
}

function mlaNames(ps: Person[]): string {
  if (!ps.length) return '';
  const full = (p: Person, inverted: boolean) => (p.corporate || !p.first ? p.last : inverted ? `${p.last}, ${p.first}` : `${p.first} ${p.last}`);
  if (ps.length === 1) return full(ps[0], true);
  if (ps.length === 2) return `${full(ps[0], true)}, and ${full(ps[1], false)}`;
  return `${full(ps[0], true)}, et al`;
}

function chicagoNames(ps: Person[]): string {
  const full = (p: Person, i: number) => (p.corporate || !p.first ? p.last : i === 0 ? `${p.last}, ${p.first}` : `${p.first} ${p.last}`);
  const n = ps.slice(0, 10).map(full);
  if (n.length <= 1) return n.join('');
  return `${n.slice(0, -1).join(', ')}, and ${n[n.length - 1]}`;
}

function harvardNames(ps: Person[]): string {
  const n = ps.map((p) => (p.corporate || !p.first ? p.last : `${p.last}, ${initials(p.first, false)}`));
  if (n.length <= 1) return n.join('');
  if (n.length >= 4) return `${n[0]} et al.`;
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

function ieeeNames(ps: Person[]): string {
  const n = ps.map((p) => (p.corporate || !p.first ? p.last : `${initials(p.first)} ${p.last}`));
  if (n.length > 6) return `${n[0]} et al.`;
  if (n.length <= 2) return n.join(' and ');
  return `${n.slice(0, -1).join(', ')}, and ${n[n.length - 1]}`;
}

export function formatEntry(e: BibEntry, style: CiteStyle, index = 1): Run[] {
  const authors = parseNames(e.fields.author ?? '');
  const editors = parseNames(e.fields.editor ?? '');
  const who = authors.length ? authors : editors;
  const title = F(e, 'title');
  const year = F(e, 'year') || 'n.d.';
  const journal = F(e, 'journal') || F(e, 'journaltitle');
  const book = F(e, 'booktitle');
  const vol = F(e, 'volume');
  const num = F(e, 'number') || F(e, 'issue');
  const pg = pages(F(e, 'pages'));
  const pub = F(e, 'publisher') || F(e, 'institution') || F(e, 'organization');
  const school = F(e, 'school');
  const doi = F(e, 'doi');
  const url = F(e, 'url');
  const link = doi ? doiUrl(doi) : url;
  const ed = F(e, 'edition');
  const type = e.type.toLowerCase();
  const isArticle = type === 'article';
  const isBook = type === 'book';
  const isChapter = type === 'inproceedings' || type === 'incollection' || type === 'conference';
  const isThesis = type === 'phdthesis' || type === 'mastersthesis' || type === 'thesis';
  const thesisKind = type === 'phdthesis' ? 'Doctoral dissertation' : "Master's thesis";
  const r: Run[] = [];
  const t = (s: string) => s && r.push({ t: s });
  const it = (s: string) => s && r.push({ t: s, i: true });

  switch (style) {
    case 'apa': {
      const sTitle = sentenceCase(title, e.fields.title ?? '');
      t(`${end(apaNames(who) + (editors.length && !authors.length ? ` (Ed${editors.length > 1 ? 's' : ''}.)` : ''))} (${year}). `);
      if (isArticle) {
        t(`${end(sTitle)} `);
        it(journal);
        if (vol) {
          t(', ');
          it(vol);
        }
        if (num) t(`(${num})`);
        if (pg) t(`, ${pg}`);
        t('. ');
      } else if (isChapter) {
        t(`${end(sTitle)} In `);
        it(book);
        t(`${pg ? ` (pp. ${pg})` : ''}. ${pub ? end(pub) + ' ' : ''}`);
      } else if (isThesis) {
        it(sTitle);
        t(` [${thesisKind}${school ? `, ${school}` : ''}]. `);
      } else {
        it(sTitle);
        t(`${ed ? ` (${ed} ed.)` : ''}. ${pub ? end(pub) + ' ' : ''}`);
      }
      if (link) t(link);
      break;
    }
    case 'mla': {
      t(`${end(mlaNames(who))} `);
      if (isArticle || isChapter) {
        t(`“${end(title)}” `);
        it(isArticle ? journal : book);
        const bits = [vol && `vol. ${vol}`, num && `no. ${num}`, isChapter && pub, year, pg && `pp. ${pg}`].filter(Boolean);
        t(`${bits.length ? `, ${bits.join(', ')}` : ''}. `);
      } else {
        it(end(title));
        t(` ${[isThesis ? `${school}` : pub, year].filter(Boolean).join(', ')}${isThesis ? `. ${thesisKind}` : ''}. `);
      }
      if (doi) t(end(doiUrl(doi)));
      else if (url) t(end(url.replace(/^https?:\/\//, '')));
      break;
    }
    case 'chicago': {
      t(`${end(chicagoNames(who))} ${year}. `);
      if (isArticle) {
        t(`“${end(title)}” `);
        it(journal);
        t(`${vol ? ` ${vol}` : ''}${num ? ` (${num})` : ''}${pg ? `: ${pg}` : ''}. `);
      } else if (isChapter) {
        t(`“${end(title)}” In `);
        it(book);
        t(`${pg ? `, ${pg}` : ''}. ${pub ? end(pub) + ' ' : ''}`);
      } else if (isThesis) {
        t(`“${end(title)}” ${thesisKind}, ${end(school)} `);
      } else {
        it(end(title));
        t(` ${pub ? end(pub) + ' ' : ''}`);
      }
      if (link) t(end(link));
      break;
    }
    case 'harvard': {
      t(`${harvardNames(who)} (${year}) `);
      if (isArticle) {
        t(`‘${title}’, `);
        it(journal);
        t(`${vol ? `, ${vol}` : ''}${num ? `(${num})` : ''}${pg ? `, pp. ${pg}` : ''}. `);
      } else if (isChapter) {
        t(`‘${title}’, in `);
        it(book);
        t(`. ${pub ? `${pub}${pg ? `, pp. ${pg}` : ''}. ` : pg ? `pp. ${pg}. ` : ''}`);
      } else if (isThesis) {
        it(title);
        t(`. ${thesisKind}. ${end(school)} `);
      } else {
        it(title);
        t(`. ${ed ? `${ed} edn. ` : ''}${pub ? end(pub) + ' ' : ''}`);
      }
      if (doi) t(`doi:${doi.replace(/^https?:\/\/doi\.org\//, '')}.`);
      else if (url) t(`Available at: ${url}${F(e, 'urldate') ? ` (Accessed: ${F(e, 'urldate')})` : ''}.`);
      break;
    }
    case 'ieee': {
      t(`[${index}] ${ieeeNames(who)}, `);
      if (isArticle) {
        t(`“${title},” `);
        it(journal);
        t(`${vol ? `, vol. ${vol}` : ''}${num ? `, no. ${num}` : ''}${pg ? `, pp. ${pg}` : ''}, ${year}`);
      } else if (isChapter) {
        t(`“${title},” in `);
        it(book);
        t(`${pub ? `, ${pub}` : ''}, ${year}${pg ? `, pp. ${pg}` : ''}`);
      } else if (isThesis) {
        t(`“${title},” ${type === 'phdthesis' ? 'Ph.D. dissertation' : 'M.S. thesis'}, ${school}, ${year}`);
      } else {
        it(title);
        t(`${ed ? `, ${ed} ed.` : ''}${pub ? `. ${pub}` : ''}, ${year}`);
      }
      t(doi ? `, doi: ${doi.replace(/^https?:\/\/doi\.org\//, '')}.` : url ? `. [Online]. Available: ${url}` : '.');
      break;
    }
  }
  return r.map((x) => ({ ...x, t: x.t.replace(/\s{2,}/g, ' ').replace(/\.\./g, '.').replace(/ ,/g, ',') }));
}

export const runsToText = (r: Run[]) => r.map((x) => x.t).join('').trim();
export const runsToHtml = (r: Run[]) =>
  r
    .map((x) => {
      const s = x.t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
      return x.i ? `<i>${s}</i>` : s;
    })
    .join('')
    .trim();

/** Author–date order for APA/MLA/Chicago/Harvard reference lists; IEEE keeps the given order. */
export function sortForStyle(entries: BibEntry[], style: CiteStyle): BibEntry[] {
  if (style === 'ieee') return entries;
  return entries.slice().sort((a, b) => {
    const na = parseNames(a.fields.author ?? a.fields.editor ?? '')[0]?.last ?? bibText(a.fields.title ?? '');
    const nb = parseNames(b.fields.author ?? b.fields.editor ?? '')[0]?.last ?? bibText(b.fields.title ?? '');
    return na.localeCompare(nb) || (a.fields.year ?? '').localeCompare(b.fields.year ?? '');
  });
}
