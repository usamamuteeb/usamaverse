/**
 * CV ⇄ Markdown and CV ⇄ plain text. The parsers are forgiving: they accept the
 * output of the writers below, most hand-written Markdown CVs, and text copied
 * out of a PDF or Word CV (headings, bullets and date ranges are recognised).
 */
import {
  absorbContacts,
  contactItems,
  dateRange,
  defaultKind,
  displayUrl,
  emptyBasics,
  emptyEntry,
  extractDateRange,
  newSection,
  sectionRole,
  toUrl,
  cleanCv,
  type CvData,
  type CvEntry,
  type CvSection,
} from './cv-model';

/* ---------------------------------------------------------------- writers */

const mdEscape = (s: string) => s.replace(/([\\*_`[\]#<>])/g, '\\$1');

export function cvToMarkdown(input: CvData): string {
  const cv = cleanCv(input);
  const b = cv.basics;
  const out: string[] = [];
  out.push(`# ${mdEscape(b.name || 'Your Name')}`);
  if (b.label.trim()) out.push('', `**${mdEscape(b.label.trim())}**`);
  const contacts = contactItems(b).map((c) => (c.href && c.kind !== 'phone' && c.kind !== 'email' ? `[${c.text}](${c.href})` : c.text));
  if (contacts.length) out.push('', contacts.join(' · '));
  if (b.summary.trim()) out.push('', '## Summary', '', b.summary.trim());
  for (const s of cv.sections) {
    out.push('', `## ${mdEscape(s.heading || 'Section')}`, '');
    if (s.kind === 'text') out.push(s.text);
    if (s.kind === 'list') for (const i of s.items) out.push(`- ${i}`);
    if (s.kind === 'skills') for (const g of s.skills) out.push(g.name.trim() ? `- **${mdEscape(g.name.trim())}:** ${g.items.trim()}` : `- ${g.items.trim()}`);
    if (s.kind === 'entries') {
      s.entries.forEach((e, i) => {
        if (i) out.push('');
        out.push(`### ${[e.title, e.org].map((x) => x.trim()).filter(Boolean).map(mdEscape).join(' — ')}`);
        const meta = [e.location.trim(), dateRange(e)].filter(Boolean).join(' · ');
        if (meta) out.push(`*${meta}*`);
        if (e.details.trim()) out.push('', e.details.trim());
        if (e.url.trim()) out.push('', `<${toUrl(e.url)}>`);
        if (e.bullets.length) {
          out.push('');
          for (const bl of e.bullets) out.push(`- ${bl}`);
        }
      });
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

export function cvToPlainText(input: CvData): string {
  const cv = cleanCv(input);
  const b = cv.basics;
  const out: string[] = [(b.name || 'Your Name').toUpperCase()];
  if (b.label.trim()) out.push(b.label.trim());
  const contacts = contactItems(b).map((c) => c.text);
  if (contacts.length) out.push(contacts.join(' | '));
  if (b.summary.trim()) out.push('', 'SUMMARY', b.summary.trim());
  for (const s of cv.sections) {
    out.push('', (s.heading || 'Section').toUpperCase());
    if (s.kind === 'text') out.push(s.text);
    if (s.kind === 'list') for (const i of s.items) out.push(`• ${i}`);
    if (s.kind === 'skills') for (const g of s.skills) out.push(g.name.trim() ? `${g.name.trim()}: ${g.items.trim()}` : g.items.trim());
    if (s.kind === 'entries') {
      s.entries.forEach((e, i) => {
        if (i) out.push('');
        out.push([e.title, e.org].map((x) => x.trim()).filter(Boolean).join(' — '));
        const meta = [e.location.trim(), dateRange(e)].filter(Boolean).join(' | ');
        if (meta) out.push(meta);
        if (e.details.trim()) out.push(e.details.trim());
        if (e.url.trim()) out.push(toUrl(e.url));
        for (const bl of e.bullets) out.push(`  • ${bl}`);
      });
    }
  }
  return out.join('\n') + '\n';
}

/* ---------------------------------------------------------------- parsing */

type Tok = { t: 'h3' | 'bullet' | 'line' | 'blank'; s: string };

/** Removes Markdown emphasis, code and links (keeping link text), and unescapes. */
export function stripInline(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t: string, u: string) => (u.startsWith('mailto:') || u.startsWith('tel:') || t.includes('.') ? t : `${t} (${u})`))
    .replace(/<((?:https?|mailto):[^>]+)>/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\\*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^\\\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\([\\*_`[\]#<>-])/g, '$1')
    .trim();
}

const BULLET_RE = /^\s*(?:[-*+•●▪◦‣■□➢➤►✓✔]|\d{1,2}[.)])\s+/;
const URL_ONLY = /^<?(?:https?:\/\/|www\.)\S+>?$|^[\w-]+\.(?:com|dev|io|org|net|app|me|co)\/\S*$/i;

function splitTitleOrg(line: string): { title: string; org: string; extra: string } {
  const parts = line.split(/\s+(?:—|–|\||@|at)\s+|\s+-\s+|\s*·\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { title: parts[0], org: parts[1], extra: parts.slice(2).join(', ') };
  return { title: line.trim(), org: '', extra: '' };
}

function splitOrgLocation(line: string): { org: string; location: string } {
  const parts = line.split(/\s*(?:\||·|—|–)\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { org: parts[0], location: parts.slice(1).join(', ') };
  const c = line.indexOf(', ');
  if (c > 0) return { org: line.slice(0, c).trim(), location: line.slice(c + 2).trim() };
  return { org: line.trim(), location: '' };
}

/** Builds one entry from its header lines (title/org/meta) and bullets. */
function buildEntry(headers: string[], bullets: string[], explicitHeader: boolean): CvEntry {
  const e = emptyEntry();
  const rest: string[] = [];
  // Pull "… | site.dev" link segments out of header lines.
  const expanded: string[] = [];
  for (const h of headers) {
    const segs = h.split(/\s+\|\s+/);
    const links = segs.filter((x) => URL_ONLY.test(x.trim()));
    if (links.length && links.length < segs.length) {
      e.url ||= displayUrl(links[0].trim().replace(/^<|>$/g, ''));
      expanded.push(segs.filter((x) => !URL_ONLY.test(x.trim())).join(' | '));
    } else expanded.push(h);
  }
  expanded.forEach((raw, i) => {
    let line = raw.trim();
    if (!line) return;
    if (URL_ONLY.test(line)) {
      e.url ||= displayUrl(line.replace(/^<|>$/g, ''));
      return;
    }
    const dr = extractDateRange(line);
    if (dr && !e.start) {
      e.start = dr.start;
      e.end = dr.end;
      line = dr.rest;
    } else if (!e.start && /^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}$|^(?:present|expected .*)$/i.test(line.split(/\s*[|·]\s*/).pop() ?? '')) {
      const segs = line.split(/\s*[|·]\s*/);
      e.end = segs.pop()!.trim();
      line = segs.join(' · ');
    }
    if (!line) return;
    if (i === 0) {
      const { title, org, extra } = splitTitleOrg(line);
      e.title = title;
      e.org = org;
      if (extra) e.location = extra;
      return;
    }
    if (!e.org && !explicitHeader) {
      const ol = splitOrgLocation(line);
      e.org = ol.org;
      e.location ||= ol.location;
      return;
    }
    if (!e.location && line.length < 60 && !/[.!?]$/.test(line) && (i === 1 || explicitHeader) && !/\b(gpa|cgpa|grade|score|thesis)\b/i.test(line)) {
      // "Berlin, Germany" or "Remote" style meta line
      if (/^[^\d]*$/.test(line) || /,/.test(line)) {
        e.location = line;
        return;
      }
    }
    rest.push(line);
  });
  e.details = rest.join(' ');
  e.bullets = bullets.map((b) => b.trim()).filter(Boolean);
  return e;
}

const SKILL_LINE = /^([^:]{1,40}):\s*(.+)$/;

function interpretSection(heading: string, toks: Tok[], explicit: boolean): CvSection {
  const role = sectionRole(heading);
  const content = toks.filter((t) => t.t !== 'blank');
  const hasH3 = content.some((t) => t.t === 'h3');
  const bullets = content.filter((t) => t.t === 'bullet');
  const lines = content.filter((t) => t.t === 'line');
  const datey = content.filter((t) => extractDateRange(t.s)).length;

  let kind = defaultKind(heading);
  if (hasH3) kind = 'entries';
  else if (role === 'summary') kind = 'text';
  else if (role === 'skills' || (content.length > 0 && content.every((t) => SKILL_LINE.test(t.s)) && kind !== 'entries')) kind = 'skills';
  else if (kind === 'entries' && datey === 0 && lines.length === 0) kind = 'list';
  else if (kind === 'entries' && datey === 0 && bullets.length === 0 && lines.every((l) => l.s.length > 90)) kind = 'text';
  else if (kind === 'list' && datey > 0 && lines.length > 0) kind = 'entries';
  else if (role === 'other' && bullets.length === 0 && datey === 0) kind = 'text';

  const sec = newSection(heading, kind);
  if (kind === 'text') {
    if (content.length === 1) {
      sec.text = content[0].s;
      return sec;
    }
    sec.text = toks
      .map((t) => (t.t === 'blank' ? '' : t.t === 'bullet' ? `• ${t.s}` : t.s))
      .join('\n')
      .replace(/([^\n])\n(?=[^\n•])/g, '$1 ')
      .replace(/\n{2,}/g, '\n\n')
      .trim();
    return sec;
  }
  if (kind === 'list') {
    sec.items = content.map((t) => t.s);
    if (sec.items.length === 1 && (role === 'languages' || role === 'interests' || role === 'certificates') && /,/.test(sec.items[0])) sec.items = sec.items[0].split(/\s*,\s*/).filter(Boolean);
    return sec;
  }
  if (kind === 'skills') {
    for (const t of content) {
      const m = SKILL_LINE.exec(t.s);
      if (m) sec.skills.push({ name: m[1].trim(), items: m[2].trim() });
      else sec.skills.push({ name: '', items: t.s.trim() });
    }
    return sec;
  }
  // entries
  let headers: string[] = [];
  let bl: string[] = [];
  let open = false;
  let headerHasDate = false;
  let gap = false;
  const flush = () => {
    if (open && (headers.length || bl.length)) sec.entries.push(buildEntry(headers, bl, explicit && hasH3));
    headers = [];
    bl = [];
    open = false;
    headerHasDate = false;
  };
  for (const t of toks) {
    if (t.t === 'h3') {
      flush();
      open = true;
      headers = [t.s];
      headerHasDate = Boolean(extractDateRange(t.s));
      continue;
    }
    if (t.t === 'blank') {
      gap = true;
      continue;
    }
    if (t.t === 'bullet') {
      gap = false;
      if (!open) open = true;
      bl.push(t.s);
      continue;
    }
    // a plain line
    const lineHasDate = Boolean(extractDateRange(t.s));
    if (explicit && hasH3) {
      if (!open) {
        open = true;
        headers = [];
      }
      if (bl.length) bl.push(t.s); // text after bullets: keep as a bullet
      else headers.push(t.s);
      continue;
    }
    const isLink = URL_ONLY.test(t.s);
    const startNew = !open || bl.length > 0 || (lineHasDate && headerHasDate) || (headers.length >= 4 && !isLink) || (gap && headers.length > 0 && !isLink);
    gap = false;
    if (startNew) {
      flush();
      open = true;
    }
    headers.push(t.s);
    if (lineHasDate) headerHasDate = true;
  }
  flush();
  return sec;
}

interface RawSection {
  heading: string;
  toks: Tok[];
}

function assemble(name: string, header: string[], raws: RawSection[], explicit: boolean): CvData {
  const basics = emptyBasics();
  basics.name = name;
  const leftovers: string[] = [];
  for (const h of header) leftovers.push(...absorbContacts(h, basics));
  if (leftovers.length) {
    // The first short leftover is the headline; longer text is a summary.
    const i = leftovers.findIndex((l) => l.length <= 80);
    if (i >= 0) basics.label = leftovers.splice(i, 1)[0];
    if (leftovers.length) basics.summary = leftovers.join(' ');
  }
  const sections: CvSection[] = [];
  for (const r of raws) {
    if (!r.toks.some((t) => t.t !== 'blank')) continue;
    if (sectionRole(r.heading) === 'summary' && !basics.summary) {
      basics.summary = interpretSection(r.heading, r.toks, explicit).text;
      continue;
    }
    sections.push(interpretSection(r.heading, r.toks, explicit));
  }
  return { basics, sections };
}

/** Parses a Markdown CV (## sections, ### entries, - bullets). */
export function markdownToCv(md: string): CvData {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  let name = '';
  const header: string[] = [];
  const raws: RawSection[] = [];
  let cur: RawSection | null = null;
  let inCode = false;
  for (const raw of lines) {
    if (/^\s*```/.test(raw)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const line = raw.replace(/\s+$/, '');
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) continue; // horizontal rules
    const h = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = stripInline(h[2]);
      if (level === 1 && !name && !cur) {
        name = text;
        continue;
      }
      if (level <= 2) {
        cur = { heading: text, toks: [] };
        raws.push(cur);
        continue;
      }
      if (cur) cur.toks.push({ t: 'h3', s: text });
      else header.push(text);
      continue;
    }
    // setext headings (Title\n=====)
    if (/^\s*=+\s*$/.test(line) && header.length && !name && !cur) {
      name = header.pop()!;
      continue;
    }
    if (/^\s*-{2,}\s*$/.test(line) && cur && cur.toks.length && cur.toks[cur.toks.length - 1].t === 'line') {
      const last: Tok = cur.toks.pop()!;
      cur = { heading: last.s, toks: [] };
      raws.push(cur);
      continue;
    }
    if (!cur) {
      if (!line.trim()) continue;
      if (!name) {
        name = stripInline(line);
        continue;
      }
      header.push(stripInline(line.replace(BULLET_RE, '')));
      continue;
    }
    if (!line.trim()) cur.toks.push({ t: 'blank', s: '' });
    else if (BULLET_RE.test(line)) {
      const indent = /^\s*/.exec(line)![0].length;
      const text = stripInline(line.replace(BULLET_RE, ''));
      cur.toks.push({ t: 'bullet', s: indent >= 2 ? text : text });
    } else cur.toks.push({ t: 'line', s: stripInline(line) });
  }
  return assemble(name, header, raws, true);
}

const KNOWN_HEADING = /^(summary|profile|professional summary|career objective|objective|about me|about|experience|work experience|professional experience|employment|employment history|work history|relevant experience|internships?|education|academic background|qualifications|projects?|personal projects|selected projects|skills|technical skills|key skills|core competencies|competencies|technologies|tools|languages|certifications?|certificates|licenses|awards|honors|honours|achievements|awards (?:and|&) honors|volunteer(?:ing)?|volunteer experience|leadership|activities|extracurricular activities|publications|research|interests|hobbies|references|courses|training)\s*:?$/i;

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 42 || BULLET_RE.test(t)) return false;
  if (KNOWN_HEADING.test(t)) return true;
  const letters = t.replace(/[^A-Za-z]/g, '');
  return letters.length >= 4 && letters === letters.toUpperCase() && t.split(/\s+/).length <= 4 && !/\d/.test(t) && !/[@|]/.test(t);
}

const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\b(And|Of|The|In|For)\b/g, (w) => w.toLowerCase()) : s);

/** Parses a plain-text CV, e.g. text copied from a PDF or Word document. */
export function plainTextToCv(text: string): CvData {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\t/g, '   ').split('\n');
  let name = '';
  const header: string[] = [];
  const raws: RawSection[] = [];
  let cur: RawSection | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*[-=_*]{3,}\s*$/.test(line)) continue;
    if (!cur && !line.trim()) continue;
    if (!name && !cur) {
      name = titleCase(line.trim());
      continue;
    }
    if (isHeadingLine(line)) {
      cur = { heading: titleCase(line.trim().replace(/:$/, '')), toks: [] };
      raws.push(cur);
      continue;
    }
    if (!cur) {
      header.push(line.trim());
      continue;
    }
    if (!line.trim()) cur.toks.push({ t: 'blank', s: '' });
    else if (BULLET_RE.test(line)) cur.toks.push({ t: 'bullet', s: line.replace(BULLET_RE, '').trim() });
    else if (/^\s{2,}\S/.test(line) && cur.toks.length && cur.toks[cur.toks.length - 1].t === 'bullet') {
      // wrapped continuation of the previous bullet
      cur.toks[cur.toks.length - 1].s += ` ${line.trim()}`;
    } else {
      // Multi-column PDF text: "Title      Jan 2020 – Present" keeps both on one line.
      cur.toks.push({ t: 'line', s: line.trim().replace(/\s{3,}/g, ' · ') });
    }
  }
  return assemble(name, header, raws, false);
}

/** Picks the parser by looking at the text. */
export function detectCvFormat(text: string): 'json' | 'latex' | 'markdown' | 'text' {
  const t = text.trim();
  if (/^[{[]/.test(t)) return 'json';
  if (/\\(documentclass|begin\{document\}|section\*?\{|cventry|resumeSubheading|textbf\{)/.test(t)) return 'latex';
  if (/^#{1,3}\s/m.test(t) || /\*\*[^*]+\*\*/.test(t)) return 'markdown';
  return 'text';
}
