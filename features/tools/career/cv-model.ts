/**
 * A small, format-neutral CV model. Every converter (Markdown, plain text,
 * JSON Resume, LaTeX, PDF, Word, HTML) reads or writes this shape, so a CV can
 * travel between formats without each pair needing its own converter.
 */

export interface CvBasics {
  name: string;
  /** Headline / job title, e.g. "Frontend Engineer". */
  label: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
  github: string;
  summary: string;
}

export interface CvEntry {
  /** Position, degree or project name. */
  title: string;
  /** Company, institution or project tech stack. */
  org: string;
  location: string;
  start: string;
  end: string;
  /** One-line extra, e.g. GPA, grade or short description. */
  details: string;
  url: string;
  bullets: string[];
}

export interface CvSkillGroup {
  name: string;
  items: string;
}

export type CvSectionKind = 'entries' | 'skills' | 'list' | 'text';

export interface CvSection {
  id: string;
  heading: string;
  kind: CvSectionKind;
  entries: CvEntry[];
  skills: CvSkillGroup[];
  items: string[];
  text: string;
}

export interface CvData {
  basics: CvBasics;
  sections: CvSection[];
}

let seq = 0;
export const newId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

export const emptyBasics = (): CvBasics => ({ name: '', label: '', email: '', phone: '', location: '', website: '', linkedin: '', github: '', summary: '' });
export const emptyEntry = (): CvEntry => ({ title: '', org: '', location: '', start: '', end: '', details: '', url: '', bullets: [] });

export function newSection(heading: string, kind: CvSectionKind): CvSection {
  return { id: newId(), heading, kind, entries: [], skills: [], items: [], text: '' };
}

export const emptyCv = (): CvData => ({ basics: emptyBasics(), sections: [] });

/** What a section most likely holds, judged by its heading (used for JSON Resume and parsing). */
export type SectionRole = 'work' | 'education' | 'projects' | 'skills' | 'languages' | 'certificates' | 'awards' | 'volunteer' | 'publications' | 'interests' | 'references' | 'summary' | 'other';

const ROLE_WORDS: Array<[SectionRole, RegExp]> = [
  ['summary', /\b(summary|profile|objective|about( me)?|career objective|professional summary)\b/i],
  ['work', /\b(experience|employment|work|career history|professional background|internships?|positions?)\b/i],
  ['education', /\b(education|academic|qualifications?|studies)\b/i],
  ['projects', /\bprojects?\b/i],
  ['skills', /\b(skills?|technologies|technical|tools|competencies|expertise|stack)\b/i],
  ['languages', /^\s*languages?\s*$/i],
  ['certificates', /\b(certifications?|certificates?|licen[cs]es?|courses?|training)\b/i],
  ['awards', /\b(awards?|honou?rs?|achievements?|scholarships?)\b/i],
  ['volunteer', /\b(volunteer(ing)?|community|leadership|extracurricular|activities)\b/i],
  ['publications', /\b(publications?|papers?|research)\b/i],
  ['interests', /\b(interests?|hobbies)\b/i],
  ['references', /\breferences?\b/i],
];

export function sectionRole(heading: string): SectionRole {
  for (const [role, re] of ROLE_WORDS) if (re.test(heading)) return role;
  return 'other';
}

/** A sensible kind for a new section with this heading. */
export function defaultKind(heading: string): CvSectionKind {
  switch (sectionRole(heading)) {
    case 'skills':
      return 'skills';
    case 'summary':
      return 'text';
    case 'languages':
    case 'interests':
    case 'references':
    case 'certificates':
    case 'awards':
      return 'list';
    default:
      return 'entries';
  }
}

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const DATE = `(?:(?:${MONTHS})\\.?\\s+\\d{4}|\\d{1,2}[/.-]\\d{4}|\\d{4}[/.-]\\d{1,2}|(?:spring|summer|fall|autumn|winter)\\s+\\d{4}|\\d{4})`;
const END = `(?:${DATE}|present|current|now|ongoing|today)`;
const RANGE_RE = new RegExp(`(${DATE})\\s*(?:-{1,3}|–|—|to|until|\\u2013|\\u2014)\\s*(${END})`, 'i');
const SINGLE_RE = new RegExp(`^(?:${END}|expected\\s+${DATE})$`, 'i');

/** Finds "Jan 2020 – Present" style ranges. Returns the range and the text without it. */
export function extractDateRange(text: string): { start: string; end: string; rest: string } | null {
  const m = RANGE_RE.exec(text);
  if (!m) return null;
  const rest = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s*[|·•,;()–—-]\s*$/, '').replace(/^\s*[|·•,;()–—-]\s*/, '').replace(/\(\s*\)/g, '').trim();
  return { start: m[1].trim(), end: capitalizePresent(m[2].trim()), rest };
}

export function isLoneDate(text: string): boolean {
  return SINGLE_RE.test(text.trim()) || Boolean(RANGE_RE.exec(text) && RANGE_RE.exec(text)![0].length >= text.trim().length - 2);
}

function capitalizePresent(s: string) {
  return /^(present|current|now|ongoing|today)$/i.test(s) ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}

/** "Jan 2020 – Present", "2019", or "" — the way dates are shown everywhere. */
export function dateRange(e: Pick<CvEntry, 'start' | 'end'>): string {
  const s = e.start.trim();
  const t = e.end.trim();
  if (s && t) return `${s} – ${t}`;
  return s || t;
}

export function isEntryEmpty(e: CvEntry): boolean {
  return !e.title.trim() && !e.org.trim() && !e.bullets.some((b) => b.trim()) && !e.details.trim();
}

export function isSectionEmpty(s: CvSection): boolean {
  switch (s.kind) {
    case 'entries':
      return s.entries.every(isEntryEmpty);
    case 'skills':
      return s.skills.every((g) => !g.name.trim() && !g.items.trim());
    case 'list':
      return s.items.every((i) => !i.trim());
    case 'text':
      return !s.text.trim();
  }
}

/** Removes blank bullets, entries and sections so exports stay tidy. */
export function cleanCv(cv: CvData): CvData {
  const sections = cv.sections
    .map((s) => ({
      ...s,
      heading: s.heading.trim(),
      entries: s.entries.filter((e) => !isEntryEmpty(e)).map((e) => ({ ...e, bullets: e.bullets.map((b) => b.trim()).filter(Boolean) })),
      skills: s.skills.filter((g) => g.name.trim() || g.items.trim()),
      items: s.items.map((i) => i.trim()).filter(Boolean),
      text: s.text.trim(),
    }))
    .filter((s) => !isSectionEmpty(s));
  return { basics: { ...cv.basics }, sections };
}

/** Contact items in display order, with a link target when there is one. */
export function contactItems(b: CvBasics): Array<{ text: string; href?: string; kind: string }> {
  const out: Array<{ text: string; href?: string; kind: string }> = [];
  if (b.email.trim()) out.push({ kind: 'email', text: b.email.trim(), href: `mailto:${b.email.trim()}` });
  if (b.phone.trim()) out.push({ kind: 'phone', text: b.phone.trim(), href: `tel:${b.phone.replace(/[^\d+]/g, '')}` });
  if (b.location.trim()) out.push({ kind: 'location', text: b.location.trim() });
  for (const [kind, v] of [['website', b.website], ['linkedin', b.linkedin], ['github', b.github]] as const) {
    const t = v.trim();
    if (t) out.push({ kind, text: displayUrl(t), href: toUrl(t) });
  }
  return out;
}

export function toUrl(s: string): string {
  const t = s.trim();
  if (!t) return '';
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t;
  return `https://${t.replace(/^\/+/, '')}`;
}

export function displayUrl(s: string): string {
  return s.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/;
const URL_RE = /(?:https?:\/\/|www\.)[^\s|·•,;<>()]+|\b(?:linkedin\.com|github\.com|gitlab\.com)\/[^\s|·•,;<>()]+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|dev|io|org|net|app|me|co|ai|tech|site|page|info|xyz|blog|pk|de|uk|in|eu|ca|au)(?:\/[^\s|·•,;<>()]*)?(?![\w@])/i;

/**
 * Sorts loose header text ("a@b.com | +1 555 0100 | Berlin | github.com/x")
 * into contact fields. Unknown parts are returned so callers can keep them.
 */
export function absorbContacts(text: string, b: CvBasics): string[] {
  const leftovers: string[] = [];
  const parts = text
    .split(/\s*(?:\||·|•|•|;|\s{3,}|\n|\\\\)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (let p of parts) {
    p = p.replace(/^(e-?mail|phone|tel|mobile|cell|linkedin|github|website|web|portfolio|address|location)\s*:\s*/i, '');
    const email = EMAIL_RE.exec(p);
    if (email && !b.email) {
      b.email = email[0];
      continue;
    }
    const url = URL_RE.exec(p);
    if (url) {
      const u = url[0];
      if (/linkedin\.com/i.test(u)) b.linkedin ||= displayUrl(u);
      else if (/github\.com/i.test(u)) b.github ||= displayUrl(u);
      else b.website ||= displayUrl(u);
      continue;
    }
    const phone = PHONE_RE.exec(p);
    if (phone && phone[0].replace(/\D/g, '').length >= 7 && !b.phone && !/^\d{4}\s*[-–]\s*\d{4}$/.test(p)) {
      b.phone = phone[0].trim();
      continue;
    }
    if (!b.location && /^[A-Za-zÀ-ÿ .'-]+,\s*[A-Za-zÀ-ÿ .'-]+$/.test(p) && p.length < 60) {
      b.location = p;
      continue;
    }
    leftovers.push(p);
  }
  return leftovers;
}

/** A filled-in example CV used by "Load example" buttons and tests. */
export function sampleCv(): CvData {
  const exp = newSection('Experience', 'entries');
  exp.entries = [
    {
      title: 'Senior Frontend Engineer',
      org: 'Northwind Labs',
      location: 'Berlin, Germany',
      start: 'Mar 2022',
      end: 'Present',
      details: '',
      url: '',
      bullets: [
        'Led the rebuild of the customer dashboard in React and TypeScript, cutting load time by 48%.',
        'Introduced visual regression tests that caught 30+ UI bugs before release.',
        'Mentored 4 engineers and ran the weekly frontend guild.',
      ],
    },
    {
      title: 'Web Developer',
      org: 'Blue Harbor Studio',
      location: 'Lahore, Pakistan',
      start: 'Jul 2019',
      end: 'Feb 2022',
      details: '',
      url: '',
      bullets: ['Shipped 25 client websites with accessible, responsive layouts.', 'Built a reusable component library used across 12 projects.'],
    },
  ];
  const edu = newSection('Education', 'entries');
  edu.entries = [{ title: 'BSc Computer Science', org: 'University of the Punjab', location: 'Lahore, Pakistan', start: '2015', end: '2019', details: 'CGPA 3.7 / 4.0', url: '', bullets: [] }];
  const proj = newSection('Projects', 'entries');
  proj.entries = [{ title: 'UsamaVerse', org: 'Next.js, TypeScript', location: '', start: '2025', end: 'Present', details: 'A free toolbox where every tool runs in the browser.', url: 'github.com/usamamuteeb/usamaverse', bullets: ['180+ tools with no sign-up and no uploads.'] }];
  const skills = newSection('Skills', 'skills');
  skills.skills = [
    { name: 'Languages', items: 'TypeScript, JavaScript, Python, SQL' },
    { name: 'Frameworks', items: 'React, Next.js, Node.js, Tailwind CSS' },
    { name: 'Tools', items: 'Git, Docker, Playwright, Figma' },
  ];
  const langs = newSection('Languages', 'list');
  langs.items = ['English (fluent)', 'Urdu (native)', 'German (B1)'];
  return {
    basics: {
      name: 'Aisha Khan',
      label: 'Senior Frontend Engineer',
      email: 'aisha.khan@example.com',
      phone: '+49 151 2345 6789',
      location: 'Berlin, Germany',
      website: 'aishakhan.dev',
      linkedin: 'linkedin.com/in/aishakhan',
      github: 'github.com/aishakhan',
      summary: 'Frontend engineer with 6+ years building fast, accessible web apps. Enjoys turning complex workflows into simple interfaces.',
    },
    sections: [exp, edu, proj, skills, langs],
  };
}
