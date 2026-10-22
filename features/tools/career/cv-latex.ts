/**
 * CV → LaTeX source. Three original templates that compile on Overleaf or any
 * TeX Live / MiKTeX install with pdfLaTeX (also XeLaTeX / LuaLaTeX):
 *  - classic:  article class, centred header, coloured section rules
 *  - compact:  dense one-page layout that ATS parsers read well
 *  - moderncv: the popular moderncv class (\cventry, \cvitem…)
 */
import { latexEscape as esc, latexUrl } from '@/features/tools/latex/escape';
import { cleanCv, contactItems, displayUrl, toUrl, type CvData, type CvEntry, type CvSection } from './cv-model';

export type LatexTemplate = 'classic' | 'compact' | 'moderncv';
export type AccentName = 'crimson' | 'blue' | 'green' | 'purple' | 'orange' | 'grey' | 'black';

export const ACCENTS: Record<AccentName, { hex: string; moderncv: string; label: string }> = {
  crimson: { hex: 'B3263E', moderncv: 'burgundy', label: 'Crimson' },
  blue: { hex: '1F4E9A', moderncv: 'blue', label: 'Blue' },
  green: { hex: '2E7D32', moderncv: 'green', label: 'Green' },
  purple: { hex: '5E35B1', moderncv: 'purple', label: 'Purple' },
  orange: { hex: 'C75000', moderncv: 'orange', label: 'Orange' },
  grey: { hex: '4A4A4A', moderncv: 'grey', label: 'Grey' },
  black: { hex: '111111', moderncv: 'black', label: 'Black' },
};

export interface LatexOptions {
  template: LatexTemplate;
  paper: 'a4' | 'letter';
  fontSize: '10' | '11' | '12';
  accent: AccentName;
}

export const defaultLatexOptions: LatexOptions = { template: 'classic', paper: 'a4', fontSize: '11', accent: 'crimson' };

const texDates = (e: Pick<CvEntry, 'start' | 'end'>) => {
  const s = esc(e.start.trim());
  const t = esc(e.end.trim());
  return s && t ? `${s} -- ${t}` : s || t;
};

const bullets = (items: string[], indent = '') =>
  items.length ? `${indent}\\begin{itemize}\n${items.map((b) => `${indent}  \\item ${esc(b)}`).join('\n')}\n${indent}\\end{itemize}\n` : '';

const link = (url: string, text?: string) => `\\href{${latexUrl(toUrl(url))}}{${esc(text ?? displayUrl(url))}}`;

function contactLine(cv: CvData, sep: string): string {
  return contactItems(cv.basics)
    .map((c) => (c.href ? `\\href{${latexUrl(c.href)}}{${esc(c.text)}}` : esc(c.text)))
    .join(sep);
}

const header = (o: LatexOptions, cls: string, extra = '') => `% CV generated with UsamaVerse (browser-only tools). Compile with pdfLaTeX, XeLaTeX or LuaLaTeX — e.g. paste into Overleaf.
\\documentclass[${o.fontSize}pt,${o.paper}paper]{${cls}}
${extra}`;

const commonPackages = `\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\IfFileExists{lmodern.sty}{\\usepackage{lmodern}}{}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{tabularx}
\\usepackage{xcolor}
\\usepackage[hidelinks]{hyperref}
\\ifdefined\\pdfgentounicode\\pdfgentounicode=1\\fi % searchable, ATS-friendly PDF text`;

function sectionBody(s: CvSection, entry: (e: CvEntry) => string): string {
  switch (s.kind) {
    case 'text':
      return `${esc(s.text, { keepNewlines: true })}\n`;
    case 'list':
      return bullets(s.items);
    case 'skills':
      return s.skills.map((g) => (g.name.trim() ? `\\textbf{${esc(g.name.trim())}:} ${esc(g.items.trim())}` : esc(g.items.trim()))).join(' \\\\\n') + '\n';
    case 'entries':
      return s.entries.map(entry).join('\n');
  }
}

function classic(cv: CvData, o: LatexOptions): string {
  const b = cv.basics;
  const out: string[] = [];
  out.push(
    header(o, 'article'),
    commonPackages,
    `\\usepackage[margin=${o.paper === 'a4' ? '1.8cm' : '0.75in'}]{geometry}`,
    `\\definecolor{accent}{HTML}{${ACCENTS[o.accent].hex}}`,
    '\\pagestyle{empty}',
    '\\setlength{\\parindent}{0pt}',
    '\\titleformat{\\section}{\\large\\bfseries\\color{accent}}{}{0pt}{}[\\vspace{1pt}{\\color{accent}\\titlerule}]',
    '\\titlespacing*{\\section}{0pt}{10pt}{5pt}',
    '\\setlist[itemize]{leftmargin=1.2em, itemsep=1pt, topsep=2pt, parsep=0pt}',
    '% \\cvEntry{title}{organisation}{location}{dates}',
    '\\newcommand{\\cvEntry}[4]{\\textbf{#1}\\hfill #4\\\\\\textit{#2}\\hfill\\textit{#3}\\par}',
    '\\newcommand{\\cvEntryShort}[2]{\\textbf{#1}\\hfill #2\\par}',
    '',
    '\\begin{document}',
    '',
    '\\begin{center}',
    `  {\\LARGE\\bfseries ${esc(b.name || 'Your Name')}}\\\\[3pt]`,
  );
  if (b.label.trim()) out.push(`  {\\large ${esc(b.label.trim())}}\\\\[4pt]`);
  const cl = contactLine(cv, ' \\textbar{} ');
  if (cl) out.push(`  \\small ${cl}`);
  out.push('\\end{center}', '');
  if (b.summary.trim()) out.push('\\section*{Summary}', esc(b.summary.trim(), { keepNewlines: true }), '');
  for (const s of cv.sections) {
    out.push(`\\section*{${esc(s.heading)}}`);
    out.push(
      sectionBody(s, (e) => {
        const title = esc(e.title.trim());
        const lines: string[] = [];
        if (e.org.trim() || e.location.trim()) lines.push(`\\cvEntry{${title}}{${esc(e.org.trim())}}{${esc(e.location.trim())}}{${texDates(e)}}`);
        else lines.push(`\\cvEntryShort{${title}}{${texDates(e)}}`);
        const extra = [e.details.trim() && esc(e.details.trim()), e.url.trim() && link(e.url)].filter(Boolean).join(' \\textbar{} ');
        if (extra) lines.push(`${extra}\\par`);
        if (e.bullets.length) lines.push(bullets(e.bullets).trimEnd());
        return lines.join('\n') + '\n\\medskip\n';
      }),
    );
  }
  out.push('\\end{document}', '');
  return out.join('\n');
}

function compact(cv: CvData, o: LatexOptions): string {
  const b = cv.basics;
  const out: string[] = [];
  out.push(
    header(o, 'article'),
    commonPackages,
    `\\usepackage[margin=${o.paper === 'a4' ? '1.5cm' : '0.6in'}]{geometry}`,
    `\\definecolor{accent}{HTML}{${ACCENTS[o.accent].hex}}`,
    '\\pagestyle{empty}',
    '\\setlength{\\parindent}{0pt}',
    '\\setlength{\\tabcolsep}{0pt}',
    '\\titleformat{\\section}{\\scshape\\large\\color{accent}}{}{0pt}{}[\\vspace{-5pt}\\titlerule\\vspace{-2pt}]',
    '\\titlespacing*{\\section}{0pt}{8pt}{4pt}',
    '\\setlist[itemize]{leftmargin=1em, itemsep=0pt, topsep=1pt, parsep=0pt, label=\\textbullet}',
    '% \\entryHead{title}{dates}{organisation}{location}',
    '\\newcommand{\\entryHead}[4]{\\begin{tabularx}{\\linewidth}{@{}X r@{}}\\textbf{#1} & #2 \\\\ \\textit{\\small #3} & \\textit{\\small #4}\\end{tabularx}\\par}',
    '\\newcommand{\\entryHeadOne}[2]{\\begin{tabularx}{\\linewidth}{@{}X r@{}}\\textbf{#1} & #2\\end{tabularx}\\par}',
    '',
    '\\begin{document}',
    '',
    '\\begin{center}',
    `  {\\Huge\\scshape ${esc(b.name || 'Your Name')}}\\\\[2pt]`,
  );
  if (b.label.trim()) out.push(`  ${esc(b.label.trim())}\\\\[2pt]`);
  const cl = contactLine(cv, ' $|$ ');
  if (cl) out.push(`  \\small ${cl}`);
  out.push('\\end{center}', '\\vspace{-6pt}', '');
  if (b.summary.trim()) out.push('\\section{Summary}', `{\\small ${esc(b.summary.trim(), { keepNewlines: true })}}`, '');
  for (const s of cv.sections) {
    out.push(`\\section{${esc(s.heading)}}`);
    if (s.kind === 'skills') {
      out.push('{\\small');
      out.push(sectionBody(s, () => '').trimEnd() + '}', '');
      continue;
    }
    out.push(
      sectionBody(s, (e) => {
        const lines: string[] = [];
        const titleBits = [esc(e.title.trim()), e.url.trim() ? `\\small\\,(${link(e.url)})` : ''].filter(Boolean).join(' ');
        if (e.org.trim() || e.location.trim()) lines.push(`\\entryHead{${titleBits}}{${texDates(e)}}{${esc(e.org.trim())}}{${esc(e.location.trim())}}`);
        else lines.push(`\\entryHeadOne{${titleBits}}{${texDates(e)}}`);
        if (e.details.trim()) lines.push(`{\\small ${esc(e.details.trim())}}\\par`);
        if (e.bullets.length) lines.push(`{\\small\n${bullets(e.bullets).trimEnd()}}`);
        return lines.join('\n') + '\n\\vspace{3pt}\n';
      }),
    );
  }
  out.push('\\end{document}', '');
  return out.join('\n');
}

const handle = (s: string, domain: RegExp) => displayUrl(s).replace(domain, '').replace(/^\/+|\/+$/g, '');

function moderncv(cv: CvData, o: LatexOptions): string {
  const b = cv.basics;
  const parts = (b.name || 'Your Name').trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : '';
  const out: string[] = [
    header(o, 'moderncv', ''),
    '\\moderncvstyle{classic} % other styles: casual, banking, oldstyle, fancy',
    `\\moderncvcolor{${ACCENTS[o.accent].moderncv}}`,
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[scale=0.8]{geometry}',
    '',
    `\\name{${esc(parts.join(' '))}}{${esc(last)}}`,
  ];
  if (b.label.trim()) out.push(`\\title{${esc(b.label.trim())}}`);
  if (b.location.trim()) out.push(`\\address{${esc(b.location.trim())}}{}{}`);
  if (b.phone.trim()) out.push(`\\phone[mobile]{${esc(b.phone.trim())}}`);
  if (b.email.trim()) out.push(`\\email{${esc(b.email.trim())}}`);
  if (b.website.trim()) out.push(`\\homepage{${esc(displayUrl(b.website))}}`);
  if (b.linkedin.trim()) out.push(`\\social[linkedin]{${esc(handle(b.linkedin, /^linkedin\.com\/in\//i))}}`);
  if (b.github.trim()) out.push(`\\social[github]{${esc(handle(b.github, /^github\.com\//i))}}`);
  out.push('', '\\begin{document}', '\\makecvtitle', '');
  if (b.summary.trim()) out.push('\\section{Summary}', `\\cvitem{}{${esc(b.summary.trim())}}`, '');
  for (const s of cv.sections) {
    out.push(`\\section{${esc(s.heading)}}`);
    switch (s.kind) {
      case 'text':
        out.push(`\\cvitem{}{${esc(s.text)}}`);
        break;
      case 'list':
        for (const i of s.items) out.push(`\\cvlistitem{${esc(i)}}`);
        break;
      case 'skills':
        for (const g of s.skills) out.push(`\\cvitem{${esc(g.name.trim())}}{${esc(g.items.trim())}}`);
        break;
      case 'entries':
        for (const e of s.entries) {
          const desc = [e.url.trim() && link(e.url), e.bullets.length ? `\n${bullets(e.bullets, '  ').trimEnd()}\n` : ''].filter(Boolean).join(' ');
          out.push(`\\cventry{${texDates(e)}}{${esc(e.title.trim())}}{${esc(e.org.trim())}}{${esc(e.location.trim())}}{${esc(e.details.trim())}}{${desc}}`);
        }
        break;
    }
    out.push('');
  }
  out.push('\\end{document}', '');
  return out.join('\n');
}

export function cvToLatex(input: CvData, opts: Partial<LatexOptions> = {}): string {
  const o = { ...defaultLatexOptions, ...opts };
  const cv = cleanCv(input);
  if (o.template === 'compact') return compact(cv, o);
  if (o.template === 'moderncv') return moderncv(cv, o);
  return classic(cv, o);
}
