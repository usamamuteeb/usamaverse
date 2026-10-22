/** One entry point for reading a CV in any supported format, and for writing it out. */
import { latexToMarkdownDoc } from '@/features/tools/latex/latex-parse';
import { cleanCv, type CvData } from './cv-model';
import { cvToJsonResume, jsonToCv } from './cv-json';
import { cvToLatex, type LatexOptions } from './cv-latex';
import { cvToMarkdown, cvToPlainText, detectCvFormat, markdownToCv, plainTextToCv } from './cv-text';

export type CvInputFormat = 'auto' | 'markdown' | 'text' | 'json' | 'latex';
export type CvOutputFormat = 'latex' | 'markdown' | 'text' | 'json' | 'cvjson' | 'html';

export interface ParsedCv {
  cv: CvData;
  format: Exclude<CvInputFormat, 'auto'>;
  warnings: string[];
}

/** Reads a LaTeX CV (Jake's resume, moderncv, awesome-cv, resume.cls or a hand-made article). */
export function latexToCv(tex: string): { cv: CvData; warnings: string[] } {
  const doc = latexToMarkdownDoc(tex, { mode: 'cv' });
  const h = doc.header;
  const head: string[] = [];
  if (h.name) {
    head.push(`# ${h.name}`);
    if (h.label) head.push(h.label);
    const contacts = [h.email, h.phone, h.location, h.homepage, h.linkedin, h.github].filter(Boolean);
    if (contacts.length) head.push(contacts.join(' · '));
  }
  const md = [head.join('\n\n'), doc.markdown].filter(Boolean).join('\n\n');
  const cv = markdownToCv(md);
  // Header commands are exact, so they win over what the text parser guessed.
  const b = cv.basics;
  if (h.name) {
    b.label = h.label ?? '';
    b.summary = cv.basics.summary === [h.email, h.phone, h.location].filter(Boolean).join(' ') ? '' : b.summary;
    if (h.location) {
      b.location = h.location;
      if (b.summary.includes(h.location)) b.summary = b.summary.replace(h.location, '').trim();
    }
    if (h.email) b.email = h.email;
    if (h.phone) b.phone = h.phone;
    if (h.homepage) b.website = h.homepage;
    if (h.linkedin) b.linkedin = h.linkedin;
    if (h.github) b.github = h.github;
  }
  return { cv, warnings: doc.warnings };
}

export function parseCv(text: string, format: CvInputFormat = 'auto'): ParsedCv {
  const f = format === 'auto' ? detectCvFormat(text) : format;
  const warnings: string[] = [];
  let cv: CvData;
  switch (f) {
    case 'json':
      cv = jsonToCv(text);
      break;
    case 'latex': {
      const r = latexToCv(text);
      cv = r.cv;
      warnings.push(...r.warnings);
      break;
    }
    case 'markdown':
      cv = markdownToCv(text);
      break;
    default:
      cv = plainTextToCv(text);
  }
  cv = cleanCv(cv);
  if (!cv.basics.name) warnings.push('No name was found — check the first line.');
  if (!cv.sections.length) warnings.push('No sections were recognised. Headings such as “Experience”, “Education” and “Skills” help the converter.');
  return { cv, format: f, warnings };
}

export function writeCv(cv: CvData, format: CvOutputFormat, latex?: Partial<LatexOptions>): string {
  switch (format) {
    case 'latex':
      return cvToLatex(cv, latex);
    case 'markdown':
      return cvToMarkdown(cv);
    case 'text':
      return cvToPlainText(cv);
    case 'json':
      return JSON.stringify(cvToJsonResume(cv), null, 2) + '\n';
    case 'cvjson':
      return JSON.stringify(cleanCv(cv), null, 2) + '\n';
    case 'html':
      return cvToHtmlDocument(cv);
  }
}

const he = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A standalone, printable HTML file of the CV (inline CSS, no scripts). */
export function cvToHtmlDocument(input: CvData): string {
  const cv = cleanCv(input);
  const b = cv.basics;
  const contacts = [b.email && `<a href="mailto:${he(b.email)}">${he(b.email)}</a>`, b.phone && he(b.phone), b.location && he(b.location), ...[b.website, b.linkedin, b.github].filter(Boolean).map((u) => `<a href="${he(/^https?:/i.test(u) ? u : `https://${u}`)}">${he(u.replace(/^https?:\/\//, ''))}</a>`)].filter(Boolean);
  const body: string[] = [];
  if (b.summary) body.push(`<section><h2>Summary</h2><p>${he(b.summary)}</p></section>`);
  for (const s of cv.sections) {
    const inner: string[] = [];
    if (s.kind === 'text') inner.push(...s.text.split(/\n{2,}/).map((p) => `<p>${he(p)}</p>`));
    if (s.kind === 'list') inner.push(`<ul>${s.items.map((i) => `<li>${he(i)}</li>`).join('')}</ul>`);
    if (s.kind === 'skills') inner.push(`<ul class="skills">${s.skills.map((g) => `<li>${g.name ? `<strong>${he(g.name)}:</strong> ` : ''}${he(g.items)}</li>`).join('')}</ul>`);
    if (s.kind === 'entries')
      for (const e of s.entries) {
        const dates = [e.start, e.end].filter(Boolean).join(' – ');
        inner.push(
          `<article><div class="row"><strong>${he(e.title)}</strong><span>${he(dates)}</span></div>` +
            (e.org || e.location ? `<div class="row sub"><em>${he(e.org)}</em><em>${he(e.location)}</em></div>` : '') +
            (e.details ? `<p>${he(e.details)}</p>` : '') +
            (e.url ? `<p><a href="${he(/^https?:/i.test(e.url) ? e.url : `https://${e.url}`)}">${he(e.url.replace(/^https?:\/\//, ''))}</a></p>` : '') +
            (e.bullets.length ? `<ul>${e.bullets.map((x) => `<li>${he(x)}</li>`).join('')}</ul>` : '') +
            `</article>`,
        );
      }
    body.push(`<section><h2>${he(s.heading)}</h2>${inner.join('')}</section>`);
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${he(b.name || 'CV')}</title>
<style>
  body { font: 15px/1.45 Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 780px; margin: 32px auto; padding: 0 20px; }
  header { text-align: center; margin-bottom: 18px; }
  h1 { font-size: 28px; margin: 0; letter-spacing: .02em; }
  .label { font-size: 16px; margin: 4px 0; }
  .contacts { font-size: 13px; color: #444; }
  .contacts span + span::before { content: ' · '; }
  a { color: inherit; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .08em; color: #8f1f33; border-bottom: 1px solid #8f1f33; padding-bottom: 2px; margin: 18px 0 8px; }
  article { margin-bottom: 10px; }
  .row { display: flex; justify-content: space-between; gap: 12px; }
  .sub { font-size: 14px; color: #333; }
  ul { margin: 4px 0; padding-left: 20px; }
  p { margin: 4px 0; }
  @media print { body { margin: 0; } a { text-decoration: none; } }
</style>
</head>
<body>
<header>
  <h1>${he(b.name || 'Your Name')}</h1>
  ${b.label ? `<p class="label">${he(b.label)}</p>` : ''}
  <p class="contacts">${contacts.map((c) => `<span>${c}</span>`).join('')}</p>
</header>
${body.join('\n')}
</body>
</html>
`;
}
